const { WebSocketServer } = require('ws');
const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 3001;

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}
const MAX_NAME_LENGTH = 20;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I, avoids ambiguity

const COLORS = [0xff6666, 0x66ccff, 0x66ff88, 0xffcc66, 0xcc88ff, 0xff88cc, 0x88ffee, 0xffaa44];

// Multiple rooms, each keyed by a short shareable code (see server/PROTOCOL.md).
const rooms = new Map(); // code -> { hostId, clients, started, mapSeed }

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, exceptId) {
  for (const [id, client] of room.clients) {
    if (id === exceptId) continue;
    send(client.ws, msg);
  }
}

function playerList(room) {
  return Array.from(room.clients.entries()).map(([id, c]) => ({
    id,
    color: c.color,
    name: c.name,
    isHost: id === room.hostId
  }));
}

function generateRoomCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('shooter-game relay server\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const id = crypto.randomUUID();
  const query = new URL(req.url, 'http://localhost').searchParams;
  const name = (query.get('name') || 'Player').slice(0, MAX_NAME_LENGTH);
  const requestedCode = (query.get('room') || '').toUpperCase().trim();

  log(`connection ${id} name="${name}" requestedRoom="${requestedCode || '(new)'}"`);

  let code = requestedCode;
  let room;

  if (requestedCode) {
    room = rooms.get(requestedCode);
    if (!room) {
      log(`join-failed ${id}: room ${requestedCode} not found`);
      send(ws, { type: 'join-failed', reason: 'Room not found' });
      ws.close();
      return;
    }
    if (room.clients.size >= 8) {
      log(`join-failed ${id}: room ${requestedCode} full`);
      send(ws, { type: 'join-failed', reason: 'Room is full' });
      ws.close();
      return;
    }
    if (room.started) {
      log(`join-failed ${id}: room ${requestedCode} already started`);
      send(ws, { type: 'join-failed', reason: 'Game already started' });
      ws.close();
      return;
    }
  } else {
    code = generateRoomCode();
    room = {
      hostId: null,
      clients: new Map(),
      started: false,
      mapSeed: crypto.randomInt(1, 0x7fffffff)
    };
    rooms.set(code, room);
    log(`created room ${code}`);
  }

  const color = COLORS[room.clients.size % COLORS.length];
  const isHost = room.clients.size === 0;

  room.clients.set(id, { ws, color, name });
  if (isHost) room.hostId = id;
  ws.roomCode = code;
  ws.clientId = id;

  log(`room ${code}: ${id} joined as ${isHost ? 'host' : 'player'} (${room.clients.size} in room)`);

  send(ws, {
    type: 'welcome', id, isHost, color, name, code,
    players: playerList(room), started: room.started, mapSeed: room.mapSeed
  });
  broadcast(room, { type: 'player-joined', id, color, name, isHost }, id);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      log(`room ${ws.roomCode}: malformed message from ${id}`);
      return;
    }

    const room = rooms.get(ws.roomCode);
    if (!room) return;

    switch (msg.type) {
      case 'start-game':
        if (id === room.hostId && !room.started) {
          room.started = true;
          log(`room ${ws.roomCode}: start-game from host ${id}`);
          broadcast(room, { type: 'start-game', mapSeed: room.mapSeed }, id);
        }
        break;

      case 'player-state':
      case 'bullet-fired':
        broadcast(room, { ...msg, id }, id);
        break;

      case 'enemy-state':
        if (id === room.hostId) broadcast(room, msg, id);
        break;

      case 'enemy-died':
      case 'game-over':
      case 'new-game':
      case 'enemy-bullet-fired':
        if (id === room.hostId) {
          if (msg.type !== 'enemy-bullet-fired') log(`room ${ws.roomCode}: ${msg.type} from host ${id}`);
          broadcast(room, msg, id);
        }
        break;

      case 'damage-event': {
        const host = room.clients.get(room.hostId);
        if (host) send(host.ws, { ...msg, fromId: id });
        break;
      }

      case 'player-died':
        log(`room ${ws.roomCode}: player-died ${id}`);
        broadcast(room, { ...msg, id }, id);
        break;

      default:
        log(`room ${ws.roomCode}: unknown message type "${msg.type}" from ${id}`);
        break;
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.roomCode);
    if (!room) return;

    room.clients.delete(id);

    if (id === room.hostId) {
      log(`room ${ws.roomCode}: host ${id} left, tearing down room`);
      broadcast(room, { type: 'host-left' });
      rooms.delete(ws.roomCode);
      return;
    }

    log(`room ${ws.roomCode}: ${id} left (${room.clients.size} remaining)`);
    broadcast(room, { type: 'player-left', id });
    if (room.clients.size === 0) {
      log(`room ${ws.roomCode}: empty, removing`);
      rooms.delete(ws.roomCode);
    }
  });

  ws.on('error', (err) => {
    log(`room ${ws.roomCode}: socket error for ${id}: ${err.message}`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  log(`shooter-game relay server listening on 0.0.0.0:${PORT}`);
});
