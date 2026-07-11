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
import { addCoins } from '../progress.js';
import CoinCounter from '../ui/CoinCounter.js';

const WORLD_WIDTH = 6400;
const WORLD_HEIGHT = 4800;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
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

    // Camera follows the player across the larger world
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

    // Game state
    this.score = 0;
    this.wave = 1;
    this.enemiesKilled = 0;
    this.gameOver = false;
    this.grenadeThrowCooldown = 0;

    // Spawn enemies
    this.spawnWave();

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.eKey.on('down', () => this.toggleTank());
    this.tKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    this.tKey.on('down', () => this.placeTurret(this.player.sprite.x, this.player.sprite.y));
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

    this.coinCounter = new CoinCounter(this);

    this.add.text(16, 570, 'T: place turret (max 2)   Right-click: throw grenade   E: enter/exit tank', {
      fontSize: '14px',
      fill: '#aaaaaa'
    }).setScrollFactor(0);

    this.gameOverText = this.add.text(400, 300, '', {
      fontSize: '48px',
      fill: '#ff0000',
      align: 'center',
      setOrigin: 0.5
    }).setScrollFactor(0);
  }

  update() {
    if (this.gameOver) return;

    if (this.grenadeThrowCooldown > 0) {
      this.grenadeThrowCooldown -= 1000 / 60;
    }

    if (this.activeTank) {
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

    // Update enemies
    this.enemies.children.entries.forEach(enemySprite => {
      if (enemySprite.enemyInstance) {
        enemySprite.enemyInstance.update(this.player.sprite);
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

    // Check wave completion
    if (this.enemies.countActive() === 0) {
      this.wave++;
      this.spawnWave();
    }

    // Update UI
    this.scoreText.setText(`Score: ${this.score}`);
    this.waveText.setText(`Wave: ${this.wave}`);
    this.turretText.setText(`Turrets: ${this.turretInstances.length}/${this.maxTurrets}`);

    if (this.activeTank) {
      this.healthText.setText(`Tank Health: ${this.activeTank.health}/${this.activeTank.maxHealth}`);
      this.weaponText.setText('Driving Tank');
    } else {
      this.healthText.setText(`Health: ${this.player.health}`);
      const weapon = Player.WEAPONS[this.player.weaponKey];
      const ammoText = this.player.ammo === Infinity ? '' : ` (${this.player.ammo})`;
      this.weaponText.setText(`Weapon: ${weapon.label}${ammoText}`);
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

  buildCell(originX, originY, cx, cy, cols, rows) {
    const wallLength = 128;

    // Perimeter walls around the whole map only (avoid walling off interior cell borders)
    if (cy === 0) this.buildWallRun(originX + 100, originY + 40, wallLength, true);
    if (cy === rows - 1) this.buildWallRun(originX + 100, originY + 560, wallLength, true);
    if (cx === 0) this.buildWallRun(originX + 40, originY + 100, wallLength, false);
    if (cx === cols - 1) this.buildWallRun(originX + 760, originY + 100, wallLength, false);

    // A short interior wall to break sightlines within the cell
    if (Math.random() < 0.6) {
      const wx = originX + Phaser.Math.Between(200, 600);
      const wy = originY + Phaser.Math.Between(150, 450);
      this.buildWallRun(wx, wy, 96, Math.random() < 0.5);
    }

    // Scattered crate obstacles for cover
    const crateCount = Phaser.Math.Between(2, 4);
    for (let i = 0; i < crateCount; i++) {
      const x = originX + Phaser.Math.Between(80, 720);
      const y = originY + Phaser.Math.Between(80, 520);
      new Obstacle(this, x, y, 32, 32);
    }

    // Chest (chance it's a special weapon/tank crate)
    if (Math.random() < 0.65) {
      const x = originX + Phaser.Math.Between(100, 700);
      const y = originY + Phaser.Math.Between(100, 500);
      const special = Math.random() < 0.3;
      new Chest(this, x, y, special);
    }

    // Small chance of a second chest in the same cell
    if (Math.random() < 0.2) {
      const x = originX + Phaser.Math.Between(100, 700);
      const y = originY + Phaser.Math.Between(100, 500);
      const special = Math.random() < 0.3;
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
    enemy.takeDamage(1);

    if (enemy.health <= 0) {
      this.killEnemy(enemy, enemySprite);
    }
  }

  spawnWave() {
    const enemyCount = (5 + this.wave * 2) * 10;
    for (let i = 0; i < enemyCount; i++) {
      const x = Phaser.Math.Between(50, WORLD_WIDTH - 50);
      const y = Phaser.Math.Between(50, WORLD_HEIGHT - 50);
      new Enemy(this, x, y, this.wave);
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
    new DeadBody(this, enemySprite.x, enemySprite.y, enemySprite.flipX);
    const dropX = enemySprite.x;
    const dropY = enemySprite.y;
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

    if (this.player.health <= 0) {
      this.endGame();
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
    } else if (reward === 'saw' || reward === 'm4-upgrade' || reward === 'rocket') {
      this.player.setWeapon(reward);
    } else if (reward === 'tankCall') {
      this.callInTank();
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

    this.time.delayedCall(3000, () => {
      this.scene.start('MenuScene');
    });
  }
}
