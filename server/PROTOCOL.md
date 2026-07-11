# Multiplayer relay protocol

All messages are JSON objects over one WebSocket connection, shape `{ type, ...payload }`.
The server is a dumb relay + room/host bookkeeper — it does not simulate anything.

Rooms are keyed by a short 4-character shareable code (letters/digits, excluding
ambiguous characters like 0/O/1/I). The first client to connect without a `room` query
param creates a new room and gets a freshly generated code back in `welcome`; a client
that connects with `?room=<code>` joins that existing room, or gets `join-failed` if it
doesn't exist or is full (max 8 players). The first client in a room is its host; if the
host disconnects the room is torn down and remaining clients get `host-left`.

Clients connect with `?name=<up to 20 chars>&room=<code, omit to create>` query params on
the WebSocket URL (name is set on the main menu, persisted in localStorage; room code is
entered via the Join Session flow, or left blank via Create Session). The server
clamps/defaults the name server-side too.

## Server -> client

- `welcome` — sent once, right after connect.
  `{ type: 'welcome', id, isHost, color, name, code, players: [{ id, color, name, isHost }] }`
- `join-failed` — sent instead of `welcome` when a requested `?room=<code>` doesn't exist
  or is full; the server closes the socket right after.
  `{ type: 'join-failed', reason }`
- `player-joined` — a new player joined the room.
  `{ type: 'player-joined', id, color, name, isHost }`
- `player-left` — a player disconnected.
  `{ type: 'player-left', id }`
- `host-left` — the host disconnected; room is over, clients should return to the menu.
  `{ type: 'host-left' }`
- `player-state` — relayed from another client's own `player-state` send (never echoed back to sender).
  `{ type: 'player-state', id, x, y, rotation, weaponKey, animFrame, flipX, health }`
- `enemy-state` — relayed from the host only, broadcast to all non-host clients.
  `{ type: 'enemy-state', wave, enemies: [{ id, x, y, rotation, health, zombie }] }`
- `enemy-died` — relayed from the host only.
  `{ type: 'enemy-died', enemyId }`
- `damage-event` — relayed from a non-host client to the host only (not broadcast to the room).
  `{ type: 'damage-event', enemyId, amount, fromId }`
- `player-died` — relayed from any client whose own player just died (they're now spectating).
  `{ type: 'player-died', id }`
- `game-over` — relayed from the host only, once it determines every player is dead.
  `{ type: 'game-over', wave, score }`
- `new-game` — relayed from the host only, when it restarts the run after game-over.
  `{ type: 'new-game' }`

## Client -> server

- `player-state` — sent by every client (host and non-host) at ~15-20Hz for their own player.
  `{ type: 'player-state', x, y, rotation, weaponKey, animFrame, flipX, health }`
- `enemy-state` — sent by the host only, throttled (~100-150ms).
  `{ type: 'enemy-state', wave, enemies: [{ id, x, y, rotation, health, zombie }] }`
- `enemy-died` — sent by the host only when it applies a real kill.
  `{ type: 'enemy-died', enemyId }`
- `damage-event` — sent by a non-host client when its own projectile hits a visual-only enemy.
  `{ type: 'damage-event', enemyId, amount }`
- `player-died` — sent by any client when its own player's health hits 0; it switches to
  spectating locally and tells the room so remote ghosts can show as down.
  `{ type: 'player-died' }`
- `game-over` — sent by the host only, once it has tracked that every known player (itself
  included) has died. Carries the final wave/score for the shared game-over screen.
  `{ type: 'game-over', wave, score }`
- `new-game` — sent by the host only, when the player who chooses "Start new game" on the
  game-over screen is the host; tells everyone else to reset and rejoin the fresh run.
  `{ type: 'new-game' }`

The server stamps `id` onto relayed `player-state`/`player-died` messages (the sender's
connection id) and routes `damage-event` specifically to the host connection, adding `fromId`.
Everything else is broadcast to all other connections in the room (never echoed back to the
sender).
