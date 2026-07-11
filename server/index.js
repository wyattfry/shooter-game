const { WebSocketServer } = require('ws');
const http = require('http');
const crypto = require('crypto');
const url = require('url');

const PORT = process.env.PORT || 3001;
const MAX_NAME_LENGTH = 20;

const COLORS = [0xff6666, 0x66ccff, 0x66ff88, 0xffcc66, 0xcc88ff, 0xff88cc, 0x88ffee, 0xffaa44];

// Single shared room for v1 (see server/PROTOCOL.md). Keyed by connection id.
const room = {
  hostId: null,
  clients: new Map() // id -> { ws, color, name }
};

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(msg, exceptId) {
  for (const [id, client] of room.clients) {
    if (id === exceptId) continue;
    send(client.ws, msg);
  }
}

function playerList() {
  return Array.from(room.clients.entries()).map(([id, c]) => ({
    id,
    color: c.color,
    name: c.name,
    isHost: id === room.hostId
  }));
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('shooter-game relay server\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const id = crypto.randomUUID();
  const color = COLORS[room.clients.size % COLORS.length];
  const isHost = room.clients.size === 0;
  const query = url.parse(req.url, true).query;
  const name = (query.name || 'Player').slice(0, MAX_NAME_LENGTH);

  room.clients.set(id, { ws, color, name });
  if (isHost) room.hostId = id;

  send(ws, { type: 'welcome', id, isHost, color, name, players: playerList() });
  broadcast({ type: 'player-joined', id, color, name, isHost }, id);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'player-state':
        broadcast({ ...msg, id }, id);
        break;

      case 'enemy-state':
      case 'enemy-died':
      case 'game-over':
      case 'new-game':
        if (id === room.hostId) broadcast(msg, id);
        break;

      case 'damage-event': {
        const host = room.clients.get(room.hostId);
        if (host) send(host.ws, { ...msg, fromId: id });
        break;
      }

      case 'player-died':
        broadcast({ ...msg, id }, id);
        break;

      default:
        break;
    }
  });

  ws.on('close', () => {
    room.clients.delete(id);

    if (id === room.hostId) {
      broadcast({ type: 'host-left' });
      room.hostId = null;
      room.clients.clear();
      return;
    }

    broadcast({ type: 'player-left', id });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`shooter-game relay server listening on 0.0.0.0:${PORT}`);
});
