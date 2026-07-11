// Local dev server (see server/index.js, run with `npm start` inside server/)
const LOCAL_WS_URL = 'ws://localhost:3001';

const PRODUCTION_WS_URL = 'wss://shooter-game-server-fwyb.onrender.com';

const WS_URL = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? LOCAL_WS_URL
  : PRODUCTION_WS_URL;

export default class NetworkManager {
  constructor() {
    this.ws = null;
    this.id = null;
    this.isHost = false;
    this.hostId = null;
    this.color = null;
    this.players = [];
    this.connected = false;
    this.listeners = {};
    this.roomCode = null;
    this.mapSeed = null;
    this.started = false;
  }

  on(event, callback) {
    (this.listeners[event] = this.listeners[event] || []).push(callback);
    return this;
  }

  removeAllListeners() {
    this.listeners = {};
  }

  emit(event, payload) {
    (this.listeners[event] || []).forEach(cb => cb(payload));
  }

  connect(url = WS_URL, name = '', roomCode = '') {
    return new Promise((resolve, reject) => {
      let settled = false;
      const params = new URLSearchParams();
      if (name) params.set('name', name);
      if (roomCode) params.set('room', roomCode);
      const query = params.toString();
      const connectUrl = query ? `${url}?${query}` : url;
      this.ws = new WebSocket(connectUrl);

      // Render's free tier can take 30-50s to wake from a cold start; give it
      // real headroom before giving up, but don't hang forever with no feedback.
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.ws.close();
        reject(new Error('Connection timed out — the server may be waking up, try again in a moment'));
      }, 60000);

      const wakingHint = setTimeout(() => {
        if (!settled) this.emit('waking-up');
      }, 4000);

      const cleanup = () => {
        clearTimeout(timeout);
        clearTimeout(wakingHint);
      };

      this.ws.onopen = () => {
        this.connected = true;
      };

      this.ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === 'welcome') {
          this.id = msg.id;
          this.isHost = msg.isHost;
          this.color = msg.color;
          this.players = msg.players;
          this.roomCode = msg.code;
          this.mapSeed = msg.mapSeed;
          this.started = !!msg.started;
          this.hostId = msg.isHost ? msg.id : (msg.players.find(p => p.isHost)?.id ?? null);
          if (!settled) {
            settled = true;
            cleanup();
            resolve(this);
          }
        } else if (msg.type === 'join-failed') {
          if (!settled) {
            settled = true;
            cleanup();
            reject(new Error(msg.reason || 'Could not join that room'));
          }
        } else if (msg.type === 'player-joined') {
          if (!this.players.some(p => p.id === msg.id)) {
            this.players.push({ id: msg.id, color: msg.color, name: msg.name, isHost: !!msg.isHost });
          }
          if (msg.isHost) this.hostId = msg.id;
        } else if (msg.type === 'player-left') {
          this.players = this.players.filter(p => p.id !== msg.id);
        } else if (msg.type === 'start-game') {
          this.started = true;
          if (msg.mapSeed != null) this.mapSeed = msg.mapSeed;
        }

        this.emit(msg.type, msg);
      };

      this.ws.onerror = () => {
        this.emit('disconnected');
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error('Failed to connect to multiplayer server'));
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.emit('disconnected');
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error('Failed to connect to multiplayer server'));
        }
      };
    });
  }

  send(type, payload) {
    if (!this.connected || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, ...payload }));
  }

  disconnect() {
    if (this.ws) this.ws.close();
    this.connected = false;
  }
}

export { WS_URL, PRODUCTION_WS_URL, LOCAL_WS_URL };
