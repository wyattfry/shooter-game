import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import Projectile from '../entities/Projectile.js';
import PowerUp from '../entities/PowerUp.js';
import Obstacle from '../entities/Obstacle.js';
import Turret from '../entities/Turret.js';
import Background from '../entities/Background.js';
import DeadBody from '../entities/DeadBody.js';
import Chest from '../entities/Chest.js';
import Tank from '../entities/Tank.js';
import Grenade from '../entities/Grenade.js';
import { addCoins, getPlayerName } from '../progress.js';
import CoinCounter from '../ui/CoinCounter.js';
import RemotePlayer from '../entities/RemotePlayer.js';
import { preloadSounds, playExplosion, playHurt, playLose } from '../sound/SoundManager.js';

const WORLD_WIDTH = 6400;
const WORLD_HEIGHT = 4800;

const PLAYER_STATE_INTERVAL = 66; // ~15Hz
const ENEMY_STATE_INTERVAL = 120;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    this.multiplayer = !!(data && data.multiplayer);
    this.net = this.multiplayer ? this.registry.get('multiplayerNetwork') : null;
    this.isHost = this.net ? this.net.isHost : true;
  }

  preload() {
    preloadSounds(this);
  }

  create() {
    // Multiplayer rooms share a seed so every client builds identical geometry.
    this.mapRandom = this.createMapRandom(this.multiplayer ? this.net?.mapSeed : null);

    // World bounds (8x the original 800x600 arena)
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Background
    new Background(this, WORLD_WIDTH, WORLD_HEIGHT);

    // Initialize groups
    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    this.powerUps = this.physics.add.group();
    this.explosions = this.add.group();
    this.obstacles = this.physics.add.staticGroup();
    this.chests = this.physics.add.staticGroup();
    this.turrets = this.physics.add.staticGroup();
    this.turretBullets = this.physics.add.group();

    this.turretInstances = [];
    this.maxTurrets = 2;
    this.tanks = this.physics.add.group();
    this.tankInstances = [];
    this.activeTank = null;

    // Build the map (walls, rooms, chests)
    this.buildMap();

    // Create player
    this.player = new Player(this, WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.player.sprite.body.setCollideWorldBounds(true);

    const startWeapon = this.registry.get('startWeapon');
    if (startWeapon && startWeapon !== 'm4a1') {
      this.player.setWeapon(startWeapon);
    }

    if (this.multiplayer) {
      this.localNameText = this.add.text(
        this.player.sprite.x, this.player.sprite.y - 30,
        `${getPlayerName() || 'Player'}${this.isHost ? '  ♛ HOST' : ''}`,
        {
          fontSize: '13px',
          fill: '#ffffff',
          backgroundColor: '#000000aa',
          padding: { x: 3, y: 1 }
        }
      ).setOrigin(0.5, 1);
    }

    // Camera follows the player across the larger world
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

    // Game state
    this.score = 0;
    this.wave = 1;
    this.enemiesKilled = 0;
    this.gameOver = false;
    this.grenadeThrowCooldown = 0;

    // Multiplayer: remote player ghosts and (on non-host) visual-only enemies
    // driven by host broadcasts. All of this is inert in single-player.
    this.remotePlayers = new Map();
    this.remoteEnemiesById = new Map();
    this.playerStateTimer = 0;
    this.enemyStateTimer = 0;
    this.spectating = false;
    if (this.multiplayer && this.isHost) this.deadPlayerIds = new Set();
    if (this.multiplayer) this.setupMultiplayer();

    // Spawn enemies (host-authoritative in multiplayer; non-host clients
    // instead wait for enemy-state broadcasts from the host)
    if (!this.multiplayer || this.isHost) {
      this.spawnWave();
    }

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.eKey.on('down', () => this.toggleTank());
    this.tKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    this.tKey.on('down', () => this.placeTurret(this.player.sprite.x, this.player.sprite.y));
    this.qKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.qKey.on('down', () => {
      if (this.activeTank) this.activeTank.transform();
    });
    this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.rKey.on('down', () => {
      if (this.activeTank) {
        this.activeTank.reload();
      } else {
        this.player.reload();
      }
    });
    this.tankKeys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });
    this.input.on('pointerdown', (pointer) => {
      if (this.gameOver) return;
      if (this.activeTank) return;

      if (pointer.rightButtonDown()) {
        this.throwGrenade(pointer.worldX, pointer.worldY);
      }
    });
    this.input.mouse.disableContextMenu();

    // Collisions
    this.physics.add.overlap(
      this.projectiles,
      this.enemies,
      this.handleProjectileEnemyCollision,
      null,
      this
    );

    this.physics.add.overlap(
      this.player.sprite,
      this.enemies,
      this.handlePlayerEnemyCollision,
      null,
      this
    );

    this.physics.add.overlap(
      this.player.sprite,
      this.powerUps,
      this.handlePowerUpCollision,
      null,
      this
    );

    this.physics.add.overlap(
      this.turretBullets,
      this.enemies,
      this.handleTurretBulletEnemyCollision,
      null,
      this
    );

    this.physics.add.overlap(
      this.player.sprite,
      this.chests,
      this.handleChestCollision,
      null,
      this
    );

    this.physics.add.collider(this.player.sprite, this.obstacles);
    this.physics.add.collider(this.enemies, this.obstacles);
    this.physics.add.collider(this.player.sprite, this.turrets);
    this.physics.add.collider(this.enemies, this.turrets);

    this.physics.add.collider(this.projectiles, this.obstacles, (proj) => {
      if (proj.rocketInstance) {
        proj.rocketInstance.explode();
      } else if (proj.tankShellInstance) {
        this.explodeTankShell(proj);
      } else if (proj.grenadeInstance) {
        // Bounce off walls instead of exploding on contact; the fuse timer detonates it
      } else {
        proj.destroy();
      }
    });

    this.physics.add.collider(this.tanks, this.obstacles);
    this.physics.add.collider(this.turretBullets, this.obstacles, (bullet) => bullet.destroy());

    // UI (fixed to camera, not the scrolling world)
    this.scoreText = this.add.text(16, 16, '', {
      fontSize: '20px',
      fill: '#fff'
    }).setScrollFactor(0);

    this.waveText = this.add.text(16, 50, '', {
      fontSize: '20px',
      fill: '#fff'
    }).setScrollFactor(0);

    this.healthText = this.add.text(16, 84, '', {
      fontSize: '20px',
      fill: '#fff'
    }).setScrollFactor(0);

    this.turretText = this.add.text(16, 118, '', {
      fontSize: '20px',
      fill: '#66ccff'
    }).setScrollFactor(0);

    this.weaponText = this.add.text(16, 152, '', {
      fontSize: '20px',
      fill: '#ffcc66'
    }).setScrollFactor(0);

    this.ammoStatusText = this.add.text(16, 184, '', {
      fontSize: '16px',
      fill: '#cccccc'
    }).setScrollFactor(0);

    this.heatBarWidth = 160;
    this.heatBarBg = this.add.rectangle(16, 210, this.heatBarWidth, 10, 0x222222)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0x555555);
    this.heatBarFill = this.add.rectangle(17, 210, 0, 8, 0x66ff66)
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    this.heatBarBg.setVisible(false);
    this.heatBarFill.setVisible(false);

    this.coinCounter = new CoinCounter(this);

    this.add.text(16, 570, 'T: place turret (max 2)   Right-click: throw grenade   E: enter/exit tank   Q: transform tank/mech', {
      fontSize: '14px',
      fill: '#aaaaaa'
    }).setScrollFactor(0);

    this.gameOverText = this.add.text(400, 300, '', {
      fontSize: '48px',
      fill: '#ff0000',
      align: 'center',
      setOrigin: 0.5
    }).setScrollFactor(0);

    if (this.multiplayer) {
      this.spectateText = this.add.text(400, 16, '', {
        fontSize: '18px',
        fill: '#ffcc66',
        align: 'center',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 4 }
      }).setOrigin(0.5, 0).setScrollFactor(0).setVisible(false);

      this.leaveSessionText = this.add.text(400, 50, 'Leave session', {
        fontSize: '16px',
        fill: '#ff8888'
      }).setOrigin(0.5, 0).setScrollFactor(0).setVisible(false)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.leaveSession());

      this.gameOverButtons = this.add.container(400, 380).setScrollFactor(0).setVisible(false);
      const newGameLabel = this.isHost ? 'New Game' : 'New Game (host only)';
      const newGameText = this.makeMenuButton(-100, 0, newGameLabel, this.isHost ? '#66ccff' : '#555577', () => this.requestNewGame());
      const endSessionText = this.makeMenuButton(100, 0, 'End Session', '#ff8888', () => this.leaveSession());
      this.gameOverButtons.add([newGameText, endSessionText]);

      this.gameOverHint = this.add.text(400, 420, '', {
        fontSize: '14px',
        fill: '#aaaaaa',
        align: 'center'
      }).setOrigin(0.5).setScrollFactor(0).setVisible(false);

      this.roomCodeText = this.add.text(this.scale.width - 16, 50, `Room: ${this.net?.roomCode || ''}`, {
        fontSize: '16px',
        fontStyle: 'bold',
        fill: '#66ff88'
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(1000);

      this.lobbyListText = this.add.text(this.scale.width - 16, 74, '', {
        fontSize: '13px',
        fill: '#cccccc',
        align: 'right'
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(1000);
      this.refreshLobbyList();
    }
  }

  makeMenuButton(x, y, label, color, onClick) {
    const text = this.add.text(x, y, label, {
      fontSize: '22px',
      fill: color
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    text.on('pointerover', () => text.setScale(1.1));
    text.on('pointerout', () => text.setScale(1));
    text.on('pointerdown', onClick);

    return text;
  }

  update() {
    if (this.gameOver) {
      if (this.multiplayer) this.updateMultiplayer();
      return;
    }
    if (this.spectating) this.updateSpectateCamera();

    if (this.grenadeThrowCooldown > 0) {
      this.grenadeThrowCooldown -= 1000 / 60;
    }

    if (this.spectating) {
      // fall through to the shared-world update below, skipping only the
      // local-player input/movement block
    } else if (this.activeTank) {
      // Driving: route movement/shooting to the tank, hide the soldier
      const keys = {
        up: this.cursors.up.isDown || this.tankKeys.up.isDown,
        down: this.cursors.down.isDown || this.tankKeys.down.isDown,
        left: this.cursors.left.isDown || this.tankKeys.left.isDown,
        right: this.cursors.right.isDown || this.tankKeys.right.isDown
      };
      this.activeTank.update(this.player.sprite, keys);

      if (this.input.activePointer.rightButtonDown()) {
        this.activeTank.shoot();
      }
      if (this.input.activePointer.leftButtonDown()) {
        this.activeTank.shootMachineGun();
      }

      // Keep the hidden soldier sprite synced to the tank so enemy AI/targeting still works
      this.player.sprite.setPosition(this.activeTank.sprite.x, this.activeTank.sprite.y);
    } else {
      // Player movement
      this.player.handleInput(this.cursors);
      this.player.update();

      // Auto-fire while mouse button or space is held
      if (this.spaceKey.isDown) {
        this.player.shoot();
      } else if (this.input.activePointer.leftButtonDown()) {
        this.player.shootTowards(this.input.activePointer.worldX, this.input.activePointer.worldY);
      }
    }

    // Idle tanks: show "press E" prompt when the player is nearby
    this.tankInstances.forEach(tank => {
      if (tank !== this.activeTank) {
        tank.update(this.player.sprite, {});
      }
    });

    if (this.localNameText) {
      this.localNameText.setVisible(!this.spectating);
      this.localNameText.setPosition(this.player.sprite.x, this.player.sprite.y - 30);
    }

    // Update enemies (host, once its own player has died, points AI at a
    // living remote player instead of the dead/hidden local sprite)
    const aiTarget = this.enemyAiTargetSprite || this.player.sprite;
    this.enemies.children.entries.forEach(enemySprite => {
      if (enemySprite.enemyInstance) {
        enemySprite.enemyInstance.update(aiTarget);
      }
    });

    // Update projectiles (homing for rockets, cleanup once out of the world)
    this.projectiles.children.entries.forEach(projectileSprite => {
      if (projectileSprite.rocketInstance) {
        projectileSprite.rocketInstance.update(1000 / 60, this.enemies);
      }

      if (projectileSprite.x < 0 || projectileSprite.x > WORLD_WIDTH ||
          projectileSprite.y < 0 || projectileSprite.y > WORLD_HEIGHT) {
        projectileSprite.destroy();
      }
    });

    // Update turret bullets (cleanup once out of the world)
    this.turretBullets.children.entries.forEach(bulletSprite => {
      if (bulletSprite.x < 0 || bulletSprite.x > WORLD_WIDTH ||
          bulletSprite.y < 0 || bulletSprite.y > WORLD_HEIGHT) {
        bulletSprite.destroy();
      }
    });

    // Update turrets
    this.turretInstances.forEach(turret => turret.update());

    // Check wave completion (host-authoritative in multiplayer; non-host
    // clients get their wave number from enemy-state broadcasts instead)
    if ((!this.multiplayer || this.isHost) && this.enemies.countActive() === 0) {
      this.wave++;
      this.spawnWave();
    }

    if (this.multiplayer) this.updateMultiplayer();

    // Update UI
    this.scoreText.setText(`Score: ${this.score}`);
    this.waveText.setText(`Wave: ${this.wave}`);
    this.turretText.setText(`Turrets: ${this.turretInstances.length}/${this.maxTurrets}`);

    if (this.activeTank) {
      const tank = this.activeTank;
      this.healthText.setText(`Tank Health: ${tank.health}/${tank.maxHealth}`);
      this.weaponText.setText(this.activeTank.mode === 'mech' ? 'Driving Mech' : 'Driving Tank');

      const shellStatus = tank.shellReloading
        ? 'Cannon: reloading...'
        : `Cannon: ${tank.shellAmmo}/${tank.shellMagSize} (${tank.shellReserve} reloads)`;
      const mgStatus = tank.mgReloading
        ? 'MG: reloading...'
        : `MG: ${tank.mgAmmo}/${tank.mgMagSize} (${tank.mgReserve} reloads)`;
      this.ammoStatusText.setText(`${shellStatus}   ${mgStatus}   R: reload`);

      this.heatBarBg.setVisible(false);
      this.heatBarFill.setVisible(false);
    } else {
      this.healthText.setText(`Health: ${this.player.health}`);
      const weapon = Player.WEAPONS[this.player.weaponKey];
      const ammoText = this.player.magAmmo === Infinity ? 'Unlimited' :
        `${this.player.magAmmo}/${this.player.magSize} (${this.player.reserveMags} reloads)`;
      this.weaponText.setText(`Weapon: ${weapon.label}`);

      let status = ammoText;
      if (this.player.reloading) status += '  Reloading...';
      else if (this.player.overheated) status += '  OVERHEATED';
      if (this.player.magSize !== Infinity) status += '   R: reload';
      this.ammoStatusText.setText(status);

      this.heatBarBg.setVisible(true);
      this.heatBarFill.setVisible(true);
      const pct = this.player.heat / this.player.maxHeat;
      this.heatBarFill.width = (this.heatBarWidth - 2) * pct;
      const color = this.player.overheated ? 0xff3333 : pct > 0.7 ? 0xffaa33 : 0x66ff66;
      this.heatBarFill.setFillStyle(color);
    }
  }

  buildMap() {
    const cols = Math.floor(WORLD_WIDTH / 800);
    const rows = Math.floor(WORLD_HEIGHT / 600);

    // For each 800x600 "cell" of the 8x map, build a wall ring and scatter crates
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const originX = cx * 800;
        const originY = cy * 600;
        this.buildCell(originX, originY, cx, cy, cols, rows);
      }
    }
  }

  createMapRandom(seed) {
    if (seed == null) return Math.random;
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  mapBetween(min, max) {
    return Math.floor(this.mapRandom() * (max - min + 1)) + min;
  }

  buildCell(originX, originY, cx, cy, cols, rows) {
    const wallLength = 128;

    // Perimeter walls around the whole map only (avoid walling off interior cell borders)
    if (cy === 0) this.buildWallRun(originX + 100, originY + 40, wallLength, true);
    if (cy === rows - 1) this.buildWallRun(originX + 100, originY + 560, wallLength, true);
    if (cx === 0) this.buildWallRun(originX + 40, originY + 100, wallLength, false);
    if (cx === cols - 1) this.buildWallRun(originX + 760, originY + 100, wallLength, false);

    // A short interior wall to break sightlines within the cell
    if (this.mapRandom() < 0.6) {
      const wx = originX + this.mapBetween(200, 600);
      const wy = originY + this.mapBetween(150, 450);
      this.buildWallRun(wx, wy, 96, this.mapRandom() < 0.5);
    }

    // Scattered crate obstacles for cover
    const crateCount = this.mapBetween(2, 4);
    for (let i = 0; i < crateCount; i++) {
      const x = originX + this.mapBetween(80, 720);
      const y = originY + this.mapBetween(80, 520);
      new Obstacle(this, x, y, 32, 32);
    }

    // Chest (chance it's a special weapon/tank crate)
    if (this.mapRandom() < 0.65) {
      const x = originX + this.mapBetween(100, 700);
      const y = originY + this.mapBetween(100, 500);
      const special = this.mapRandom() < 0.3;
      new Chest(this, x, y, special);
    }

    // Small chance of a second chest in the same cell
    if (this.mapRandom() < 0.2) {
      const x = originX + this.mapBetween(100, 700);
      const y = originY + this.mapBetween(100, 500);
      const special = this.mapRandom() < 0.3;
      new Chest(this, x, y, special);
    }
  }

  buildWallRun(centerX, centerY, length, horizontal) {
    const segmentSize = 32;
    const segments = Math.round(length / segmentSize);

    for (let i = 0; i < segments; i++) {
      const offset = (i - (segments - 1) / 2) * segmentSize;
      const x = horizontal ? centerX + offset : centerX;
      const y = horizontal ? centerY : centerY + offset;
      new Obstacle(this, x, y, segmentSize, segmentSize);
    }
  }

  placeTurret(x, y) {
    if (this.turretInstances.length >= this.maxTurrets) return;

    // Don't allow placing on top of obstacles or too close to another turret
    const tooClose = this.turretInstances.some(t =>
      Phaser.Math.Distance.Between(t.baseSprite.x, t.baseSprite.y, x, y) < 60
    );
    if (tooClose) return;

    const turret = new Turret(this, x, y);
    this.turretInstances.push(turret);

    this.time.delayedCall(10000, () => {
      if (!this.turretInstances.includes(turret)) return;
      this.turretInstances = this.turretInstances.filter(t => t !== turret);
      turret.destroy();
    });
  }

  throwGrenade(targetX, targetY) {
    if (this.grenadeThrowCooldown > 0) return;
    this.grenadeThrowCooldown = 600;

    const origin = this.activeTank ? this.activeTank.sprite : this.player.sprite;
    const throwDelay = 220;

    this.playThrowWindUp(origin, targetX, targetY, throwDelay);

    this.time.delayedCall(throwDelay, () => {
      if (this.gameOver) return;
      new Grenade(this, origin.x, origin.y, targetX, targetY);
    });
  }

  playThrowWindUp(origin, targetX, targetY, duration) {
    if (!this.activeTank) {
      // Brief tint flash + pull-back nudge on the soldier to sell the throw
      const angle = Phaser.Math.Angle.Between(origin.x, origin.y, targetX, targetY);
      const bodySprite = this.player.sprite;

      bodySprite.setTint(0xffcc99);
      this.time.delayedCall(duration, () => bodySprite.clearTint());

      this.tweens.add({
        targets: bodySprite,
        x: bodySprite.x - Math.cos(angle) * 4,
        y: bodySprite.y - Math.sin(angle) * 4,
        duration: duration / 2,
        yoyo: true,
        ease: 'Quad.easeOut'
      });
    }

    // Grenade icon raised at the throw origin, arcing back then forward as it's released
    Grenade.ensureTexture(this);
    const windUpIcon = this.add.image(origin.x, origin.y - 14, 'grenadeTexture');
    windUpIcon.setDisplaySize(10, 10);
    windUpIcon.setDepth(50);

    this.tweens.add({
      targets: windUpIcon,
      y: origin.y - 20,
      scale: 1.3,
      duration: duration * 0.6,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: windUpIcon,
          alpha: 0,
          scale: 0.6,
          duration: duration * 0.4,
          onComplete: () => windUpIcon.destroy()
        });
      }
    });
  }

  callInTank() {
    // Spawns near the player
    const angle = Math.random() * Math.PI * 2;
    const x = this.player.sprite.x + Math.cos(angle) * 80;
    const y = this.player.sprite.y + Math.sin(angle) * 80;

    const tank = new Tank(this, x, y);
    this.tankInstances.push(tank);
  }

  toggleTank() {
    if (this.gameOver) return;

    if (this.activeTank) {
      // Exit the tank, place the soldier beside it
      this.activeTank.exit();
      this.player.sprite.body.enable = true;
      this.player.sprite.setPosition(
        this.activeTank.sprite.x,
        this.activeTank.sprite.y + 40
      );
      this.player.sprite.setVisible(true);
      this.player.gunSprite.setVisible(true);
      this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
      this.activeTank = null;
      return;
    }

    // Try to enter a nearby idle tank
    const nearTank = this.tankInstances.find(tank => {
      const dist = Phaser.Math.Distance.Between(
        tank.sprite.x, tank.sprite.y,
        this.player.sprite.x, this.player.sprite.y
      );
      return dist < 60;
    });

    if (nearTank) {
      nearTank.enter();
      this.activeTank = nearTank;
      this.player.sprite.setVisible(false);
      this.player.gunSprite.setVisible(false);
      this.cameras.main.startFollow(nearTank.sprite, true, 0.1, 0.1);
    }
  }

  handleTurretBulletEnemyCollision(bulletSprite, enemySprite) {
    const enemy = enemySprite.enemyInstance;
    bulletSprite.destroy();

    if (this.multiplayer && !this.isHost) {
      this.net.send('damage-event', { enemyId: enemy.netId, amount: 1 });
      return;
    }

    enemy.takeDamage(1);

    if (enemy.health <= 0) {
      this.killEnemy(enemy, enemySprite);
    }
  }

  spawnWave() {
    const zombieMode = this.registry.get('zombieMode');
    const baseCount = (5 + this.wave * 2) * 10;
    const enemyCount = zombieMode ? baseCount * 10 : baseCount;

    for (let i = 0; i < enemyCount; i++) {
      const x = Phaser.Math.Between(50, WORLD_WIDTH - 50);
      const y = Phaser.Math.Between(50, WORLD_HEIGHT - 50);
      const enemy = new Enemy(this, x, y, this.wave, zombieMode);
      if (this.multiplayer && this.isHost) {
        enemy.netId = `${this.wave}-${i}-${Math.floor(Math.random() * 1e6)}`;
      }
    }
  }

  handleProjectileEnemyCollision(projectileSprite, enemySprite) {
    if (projectileSprite.rocketInstance) {
      projectileSprite.rocketInstance.explode();
      return;
    }

    if (projectileSprite.tankShellInstance) {
      this.explodeTankShell(projectileSprite);
      return;
    }

    if (projectileSprite.grenadeInstance) {
      // Let it continue rolling/ticking down its fuse rather than exploding on contact
      return;
    }

    const enemy = enemySprite.enemyInstance;
    projectileSprite.destroy();

    // Non-host: this enemy is only a visual-only stand-in driven by the
    // host's broadcasts, so don't apply damage locally — tell the host.
    if (this.multiplayer && !this.isHost) {
      this.net.send('damage-event', { enemyId: enemy.netId, amount: 1 });
      return;
    }

    enemy.takeDamage(1);

    if (enemy.health <= 0) {
      this.killEnemy(enemy, enemySprite);
    }
  }

  explodeTankShell(shellSprite) {
    const { splashRadius, splashDamage } = shellSprite.tankShellInstance;
    const x = shellSprite.x;
    const y = shellSprite.y;

    this.createExplosion(x, y);

    this.enemies.children.entries.slice().forEach(enemySprite => {
      const dist = Phaser.Math.Distance.Between(x, y, enemySprite.x, enemySprite.y);
      if (dist <= splashRadius && enemySprite.enemyInstance) {
        const enemy = enemySprite.enemyInstance;

        if (this.multiplayer && !this.isHost) {
          this.net.send('damage-event', { enemyId: enemy.netId, amount: splashDamage });
          return;
        }

        enemy.takeDamage(splashDamage);
        if (enemy.health <= 0) {
          this.killEnemy(enemy, enemySprite);
        }
      }
    });

    shellSprite.destroy();
  }

  killEnemy(enemy, enemySprite) {
    this.createExplosion(enemySprite.x, enemySprite.y);
    new DeadBody(this, enemySprite.x, enemySprite.y, enemySprite.flipX, enemy.zombie);
    const dropX = enemySprite.x;
    const dropY = enemySprite.y;

    if (this.multiplayer && this.isHost && enemy.netId) {
      this.net.send('enemy-died', { enemyId: enemy.netId });
    }

    enemy.destroy();
    this.score += 10 * this.wave;
    this.enemiesKilled++;
    addCoins(1);

    // 20% chance to drop power-up
    if (Math.random() < 0.2) {
      new PowerUp(this, dropX, dropY);
    }
  }

  handlePlayerEnemyCollision(player, enemy) {
    this.damagePlayerOrTank(1);
  }

  damagePlayerOrTank(amount) {
    if (this.activeTank) {
      this.activeTank.takeDamage(amount);
      this.createExplosion(this.activeTank.sprite.x, this.activeTank.sprite.y);
      if (this.activeTank.health <= 0) {
        this.destroyActiveTank();
      }
      return;
    }

    this.player.takeDamage(amount);
    this.createExplosion(this.player.sprite.x, this.player.sprite.y);
    playHurt(this);

    if (this.player.health <= 0) {
      if (this.multiplayer) {
        this.enterSpectate();
      } else {
        this.endGame();
      }
    }
  }

  destroyActiveTank() {
    const tank = this.activeTank;
    this.createExplosion(tank.sprite.x, tank.sprite.y);
    this.player.sprite.body.enable = true;
    this.player.sprite.setPosition(tank.sprite.x, tank.sprite.y);
    this.player.sprite.setVisible(true);
    this.player.gunSprite.setVisible(true);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.activeTank = null;

    this.tankInstances = this.tankInstances.filter(t => t !== tank);
    tank.destroy();
  }

  handlePowerUpCollision(player, powerUp) {
    const type = powerUp.getData('type');

    if (type === 'health') {
      this.player.health = Math.min(this.player.health + 1, this.player.maxHealth);
    } else if (type === 'rapidFire') {
      this.player.rapidFireTime = 5000;
    }

    powerUp.destroy();
  }

  handleChestCollision(playerSprite, chestSprite) {
    const chest = chestSprite.chestInstance;
    const reward = chest.open();

    if (reward === 'health') {
      this.player.health = Math.min(this.player.health + 1, this.player.maxHealth);
    } else if (reward === 'rapidFire') {
      this.player.rapidFireTime = 5000;
    } else if (reward === 'tankCall') {
      this.callInTank();
    } else if (reward && Player.WEAPONS[reward]) {
      this.player.setWeapon(reward);
    }
  }

  createExplosion(x, y) {
    if (!this.explosionTexture) {
      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      graphics.fillStyle(0xffaa00);
      graphics.fillCircle(4, 4, 4);
      graphics.generateTexture('explosionParticle', 8, 8);
      graphics.destroy();
      this.explosionTexture = true;
    }

    const emitter = this.add.particles(x, y, 'explosionParticle', {
      speed: { min: 100, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      lifespan: 400,
      emitting: false
    });
    emitter.explode(10);
    playExplosion(this);

    this.time.delayedCall(500, () => emitter.destroy());
  }

  endGame() {
    this.gameOver = true;

    // On death, half the run's score converts into bonus coins (10 score
    // per coin) on top of the coins already earned per-kill during the run.
    this.score = Math.floor(this.score / 2);
    const bonusCoins = Math.floor(this.score / 10);
    const totalCoins = this.enemiesKilled + bonusCoins;
    addCoins(bonusCoins);

    this.gameOverText.setText(`GAME OVER\nScore: ${this.score}\nWave: ${this.wave}\nCoins earned: ${totalCoins}`);
    this.gameOverText.setOrigin(0.5, 0.5);
    this.physics.pause();
    playLose(this);

    this.time.delayedCall(3000, () => {
      this.scene.start('MenuScene');
    });
  }

  // Multiplayer death: the local player keeps watching the live session
  // (camera follows a living remote player) instead of the scene freezing.
  enterSpectate() {
    if (this.spectating) return;
    this.spectating = true;

    this.player.sprite.setVisible(false);
    this.player.gunSprite.setVisible(false);
    this.player.sprite.body.enable = false;

    this.spectateText.setText('You died — Spectating').setVisible(true);
    this.leaveSessionText.setVisible(true);

    this.net.send('player-died', {});
    this.refreshLobbyList();

    if (this.isHost) {
      this.deadPlayerIds.add(this.net.id);
      this.retargetHostEnemies();
      this.checkAllPlayersDead();
    }
  }

  // Picks a living remote player (if any) for the camera to follow, and for
  // host-owned enemies to chase in place of the now-dead local player.
  findLivingRemotePlayer() {
    for (const remote of this.remotePlayers.values()) {
      if (!remote.dead) return remote;
    }
    return null;
  }

  updateSpectateCamera() {
    const target = this.findLivingRemotePlayer();
    if (target && this.spectateCameraTarget !== target.sprite) {
      this.spectateCameraTarget = target.sprite;
      this.cameras.main.startFollow(target.sprite, true, 0.1, 0.1);
    } else if (!target && this.spectateCameraTarget) {
      this.spectateCameraTarget = null;
      this.cameras.main.stopFollow();
    }
  }

  // Host-only: point enemy AI at a living remote player's sprite once the
  // host's own player has died, so enemies don't chase a dead/hidden sprite.
  retargetHostEnemies() {
    const target = this.findLivingRemotePlayer();
    this.enemyAiTargetSprite = target ? target.sprite : this.player.sprite;
  }

  checkAllPlayersDead() {
    if (!this.isHost || this.gameOver) return;
    const totalPlayers = this.remotePlayers.size + 1;
    if (this.deadPlayerIds.size >= totalPlayers) {
      this.showGameOver();
    }
  }

  // Host computes and broadcasts the shared game-over; every client
  // (including the host itself) renders the same summary/buttons.
  showGameOver() {
    this.net.send('game-over', { wave: this.wave, score: this.score });
    this.applyGameOver({ wave: this.wave, score: this.score });
  }

  applyGameOver({ wave, score }) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.pause();

    const bonusCoins = Math.floor(Math.floor(score / 2) / 10);
    addCoins(bonusCoins);

    this.spectateText.setVisible(false);
    this.leaveSessionText.setVisible(false);
    this.gameOverText.setText(`GAME OVER\nWave: ${wave}\nAll players down`);
    this.gameOverText.setOrigin(0.5, 0.5);
    this.gameOverButtons.setVisible(true);
    this.gameOverHint.setVisible(false);
    playLose(this);
  }

  requestNewGame() {
    if (this.isHost) {
      this.net.send('new-game', {});
      this.applyNewGame();
    } else {
      // Only the host restarts the shared wave/enemy state; let a non-host
      // player know their click registered instead of doing nothing visibly.
      this.gameOverHint.setText('Waiting for the host to start a new game...').setVisible(true);
    }
  }

  applyNewGame() {
    this.scene.restart({ multiplayer: true });
  }

  leaveSession() {
    if (this.net) this.net.disconnect();
    this.scene.start('MenuScene');
  }

  setupMultiplayer() {
    const net = this.net;
    net.removeAllListeners();

    net.players.forEach(p => {
      if (p.id !== net.id) this.addRemotePlayer(p.id, p.color, p.name, p.isHost);
    });
    this.refreshLobbyList();

    net.on('player-joined', (msg) => {
      this.addRemotePlayer(msg.id, msg.color, msg.name, msg.isHost);
      this.refreshLobbyList();
    });

    net.on('player-left', (msg) => {
      const remote = this.remotePlayers.get(msg.id);
      if (remote) {
        remote.destroy();
        this.remotePlayers.delete(msg.id);
      }
      if (this.isHost) {
        this.deadPlayerIds.delete(msg.id);
        this.checkAllPlayersDead();
      }
      this.refreshLobbyList();
    });

    net.on('player-state', (msg) => {
      const remote = this.remotePlayers.get(msg.id);
      if (remote) remote.applyState(msg);
    });

    net.on('player-died', (msg) => {
      const remote = this.remotePlayers.get(msg.id);
      if (remote) remote.markDead();
      if (this.spectating) this.updateSpectateCamera();

      if (this.isHost) {
        this.deadPlayerIds.add(msg.id);
        this.retargetHostEnemies();
        this.checkAllPlayersDead();
      }
      this.refreshLobbyList();
    });

    net.on('game-over', (msg) => this.applyGameOver(msg));
    net.on('new-game', () => this.applyNewGame());

    net.on('host-left', () => {
      if (this.gameOver) return;
      this.gameOver = true;
      this.physics.pause();
      this.gameOverText.setText('HOST LEFT\nReturning to menu...');
      this.gameOverText.setOrigin(0.5, 0.5);
      this.time.delayedCall(2000, () => this.scene.start('MenuScene'));
    });

    net.on('disconnected', () => {
      if (this.gameOver) return;
      this.mpDisconnected = true;
    });

    if (!this.isHost) {
      net.on('enemy-state', (msg) => this.applyEnemyState(msg));
      net.on('enemy-died', (msg) => this.applyEnemyDeath(msg.enemyId));
    } else {
      net.on('damage-event', (msg) => this.applyHostDamageEvent(msg));
    }
  }

  addRemotePlayer(id, color, name, isHost = false) {
    if (this.remotePlayers.has(id)) return;
    const remote = new RemotePlayer(this, this.player.sprite.x, this.player.sprite.y, color, name, isHost);
    this.remotePlayers.set(id, remote);
  }

  refreshLobbyList() {
    if (!this.lobbyListText) return;

    if (this.roomCodeText) this.roomCodeText.setText(`Room: ${this.net.roomCode || ''}`);

    const localName = getPlayerName() || 'Player';
    const lines = [`${localName} (you)${this.isHost ? ' [host]' : ''}${this.spectating ? ' [dead]' : ''}`];
    this.remotePlayers.forEach((remote, id) => {
      const isRemoteHost = id === this.net.hostId;
      lines.push(`${remote.name}${isRemoteHost ? ' [host]' : ''}${remote.dead ? ' [dead]' : ''}`);
    });

    this.lobbyListText.setText(['Lobby:', ...lines].join('\n'));
  }

  // Non-host only: replace/refresh the visual-only enemy roster from the
  // host's broadcast. Enemies not present in the message are left alone
  // (they're removed explicitly via enemy-died) to avoid churn every tick.
  applyEnemyState(msg) {
    this.wave = msg.wave;

    const seen = new Set();
    msg.enemies.forEach(state => {
      seen.add(state.id);
      let enemy = this.remoteEnemiesById.get(state.id);
      if (!enemy) {
        enemy = new Enemy(this, state.x, state.y, this.wave, state.zombie, true);
        enemy.netId = state.id;
        this.remoteEnemiesById.set(state.id, enemy);
      }
      enemy.applyRemoteState(state);
    });
  }

  applyEnemyDeath(enemyId) {
    const enemy = this.remoteEnemiesById.get(enemyId);
    if (!enemy) return;
    this.createExplosion(enemy.sprite.x, enemy.sprite.y);
    enemy.destroy();
    this.remoteEnemiesById.delete(enemyId);
  }

  // Host only: a non-host client's projectile hit one of our real enemies.
  applyHostDamageEvent(msg) {
    const sprite = this.enemies.children.entries.find(
      s => s.enemyInstance && s.enemyInstance.netId === msg.enemyId
    );
    if (!sprite) return;

    const enemy = sprite.enemyInstance;
    enemy.takeDamage(msg.amount);
    if (enemy.health <= 0) {
      this.killEnemy(enemy, sprite);
    }
    // Health change reaches other clients via the regular enemy-state tick.
  }

  updateMultiplayer() {
    const dt = 1000 / 60;

    this.playerStateTimer -= dt;
    if (this.playerStateTimer <= 0) {
      this.playerStateTimer = PLAYER_STATE_INTERVAL;
      this.broadcastPlayerState();
    }

    if (this.isHost) {
      this.enemyStateTimer -= dt;
      if (this.enemyStateTimer <= 0) {
        this.enemyStateTimer = ENEMY_STATE_INTERVAL;
        this.broadcastEnemyState();
      }
    }

    this.remotePlayers.forEach(remote => remote.update());
  }

  broadcastPlayerState() {
    const body = this.player.sprite.body;
    const moving = Math.abs(body.velocity.x) > 5 || Math.abs(body.velocity.y) > 5;

    this.net.send('player-state', {
      x: this.player.sprite.x,
      y: this.player.sprite.y,
      rotation: this.player.targetAngle,
      weaponKey: this.player.weaponKey,
      flipX: this.player.sprite.flipX,
      health: this.player.health,
      moving
    });
  }

  broadcastEnemyState() {
    const enemies = this.enemies.children.entries
      .filter(s => s.enemyInstance && s.enemyInstance.netId)
      .map(s => {
        const e = s.enemyInstance;
        return { id: e.netId, x: s.x, y: s.y, rotation: e.gunSprite ? e.gunSprite.rotation : 0, health: e.health, zombie: e.zombie };
      });

    this.net.send('enemy-state', { wave: this.wave, enemies });
  }
}
