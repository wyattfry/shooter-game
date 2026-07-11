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
    this.color = null;
    this.players = [];
    this.connected = false;
    this.listeners = {};
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

  connect(url = WS_URL, name = '') {
    return new Promise((resolve, reject) => {
      let settled = false;
      const connectUrl = name ? `${url}?name=${encodeURIComponent(name)}` : url;
      this.ws = new WebSocket(connectUrl);

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
          if (!settled) {
            settled = true;
            resolve(this);
          }
        }

        this.emit(msg.type, msg);
      };

      this.ws.onerror = () => {
        this.emit('disconnected');
        if (!settled) {
          settled = true;
          reject(new Error('Failed to connect to multiplayer server'));
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.emit('disconnected');
        if (!settled) {
          settled = true;
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
