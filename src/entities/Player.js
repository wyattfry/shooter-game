import Phaser from 'phaser';
import Projectile from './Projectile.js';
import RocketProjectile from './RocketProjectile.js';

export default class Player {
  static get WEAPONS() {
    return {
      m4a1: { texture: 'gun-m4a1', width: 33, height: 12, fireDelay: 50, rapidFireDelay: 30, pellets: 1, ammo: Infinity, label: 'M4A1' },
      saw: { texture: 'gun-saw', width: 38, height: 14, fireDelay: 60, rapidFireDelay: 35, pellets: 1, ammo: 150, label: 'M249 SAW' },
      'm4-upgrade': { texture: 'gun-m4-upgrade', width: 34, height: 13, fireDelay: 70, rapidFireDelay: 40, pellets: 1, ammo: 90, label: 'M4A1 (Upgraded)' },
      rocket: { texture: 'gun-rocket', width: 34, height: 14, fireDelay: 800, rapidFireDelay: 700, pellets: 1, ammo: 6, label: 'Rocket Launcher', isRocket: true }
    };
  }

  constructor(scene, x, y) {
    this.scene = scene;
    this.speed = 300;
    this.health = 3;
    this.maxHealth = 3;
    this.shootCooldown = 0;
    this.shootDelay = 100;
    this.rapidFireTime = 0;

    this.weaponKey = 'm4a1';
    this.ammo = Infinity;

    Player.ensureTextures(scene);

    // Create player sprite
    this.sprite = scene.physics.add.sprite(x, y, 'playerWalk', 0);
    this.sprite.setDisplaySize(30, 36);
    this.sprite.body.setSize(16, 20);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.body.setBounce(0.2);
    this.sprite.play('player-walk');

    // Currently held weapon, always aimed at the mouse
    const startWeapon = Player.WEAPONS.m4a1;
    this.gunSprite = scene.add.image(x, y, startWeapon.texture);
    this.gunSprite.setOrigin(0.15, 0.5);
    this.gunSprite.setDisplaySize(startWeapon.width, startWeapon.height);

    // Mouse tracking for aiming
    this.lastX = x;
    this.lastY = y;
    this.targetAngle = 0;

    // WASD keys as an alternative to arrow keys
    this.wasd = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });
  }

  static ensureTextures(scene) {
    Player.ensureGunTexture(scene);
    Player.ensureSpecialGunTextures(scene);

    if (scene.textures.exists('playerWalk')) {
      if (!scene.anims.exists('player-walk')) {
        scene.anims.create({
          key: 'player-walk',
          frames: scene.anims.generateFrameNumbers('playerWalk', { start: 0, end: 3 }),
          frameRate: 8,
          repeat: -1
        });
      }
      return;
    }

    const frameW = 16;
    const frameH = 20;
    const frames = 4;
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });

    const skin = 0xe8b382;
    const uniform = 0x4b5320; // olive drab
    const uniformDark = 0x3a4118;
    const helmet = 0x3d4a1f;
    const helmetBand = 0x8b1a1a;
    const boots = 0x2b2b2b;
    const outline = 0x1a1a1a;
    const star = 0xffffff;

    for (let i = 0; i < frames; i++) {
      const ox = i * frameW;
      // leg swing offset: alternate legs forward/back
      const swing = [3, 1, -3, 1][i];

      // helmet (covers top of head, rounded)
      graphics.fillStyle(helmet);
      graphics.fillCircle(ox + 8, 4, 5);
      graphics.fillRect(ox + 3, 3, 10, 3);

      // helmet band with star
      graphics.fillStyle(helmetBand);
      graphics.fillRect(ox + 3, 5, 10, 2);
      graphics.fillStyle(star);
      graphics.fillRect(ox + 7, 5, 2, 2);

      // face
      graphics.fillStyle(skin);
      graphics.fillRect(ox + 5, 6, 6, 3);

      // body (uniform jacket)
      graphics.fillStyle(uniform);
      graphics.fillRect(ox + 4, 9, 8, 6);

      // chest strap / webbing detail
      graphics.fillStyle(uniformDark);
      graphics.fillRect(ox + 7, 9, 2, 6);

      // arms
      graphics.fillStyle(uniform);
      graphics.fillRect(ox + 2, 10, 2, 5);
      graphics.fillRect(ox + 12, 10, 2, 5);
      graphics.fillStyle(skin);
      graphics.fillRect(ox + 2, 14, 2, 1);
      graphics.fillRect(ox + 12, 14, 2, 1);

      // legs (walking swing) with boots
      graphics.fillStyle(uniformDark);
      graphics.fillRect(ox + 5 + swing * 0.3, 15, 3, 4);
      graphics.fillRect(ox + 8 - swing * 0.3, 15, 3, 4);
      graphics.fillStyle(boots);
      graphics.fillRect(ox + 5 + swing * 0.3, 18, 3, 2);
      graphics.fillRect(ox + 8 - swing * 0.3, 18, 3, 2);

      // eyes
      graphics.fillStyle(outline);
      graphics.fillRect(ox + 6, 7, 1, 1);
      graphics.fillRect(ox + 9, 7, 1, 1);
    }

    graphics.generateTexture('playerWalk', frameW * frames, frameH);
    graphics.destroy();

    scene.textures.get('playerWalk').setFilter(Phaser.Textures.FilterMode.NEAREST);

    for (let i = 0; i < frames; i++) {
      scene.textures.get('playerWalk').add(i, 0, i * frameW, 0, frameW, frameH);
    }

    scene.anims.create({
      key: 'player-walk',
      frames: scene.anims.generateFrameNumbers('playerWalk', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1
    });
  }

  static ensureGunTexture(scene) {
    if (scene.textures.exists('gun-m4a1')) return;

    const body = 0x2b2b2b;
    const handguard = 0x1e1e1e;
    const stock = 0x3a3a3a;
    const magazine = 0x111111;
    const accent = 0x555555;

    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    // stock (rear)
    g.fillStyle(stock);
    g.fillRect(0, 5, 5, 5);

    // receiver / body
    g.fillStyle(body);
    g.fillRect(4, 4, 12, 5);

    // carry handle / sight
    g.fillStyle(accent);
    g.fillRect(9, 1, 6, 3);

    // handguard
    g.fillStyle(handguard);
    g.fillRect(15, 5, 8, 3);

    // barrel
    g.fillStyle(0x0a0a0a);
    g.fillRect(22, 5, 5, 2);

    // magazine (angled down)
    g.fillStyle(magazine);
    g.fillRect(9, 9, 4, 8);

    g.generateTexture('gun-m4a1', 27, 17);
    g.destroy();
  }

  static ensureSpecialGunTextures(scene) {
    if (scene.textures.exists('gun-saw')) return;

    // SAW (M249): boxy body, bipod legs, drum magazine, long barrel
    let g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x2a2a2a);
    g.fillRect(2, 4, 20, 6);
    g.fillStyle(0x1a1a1a);
    g.fillRect(20, 5, 10, 3);
    g.fillStyle(0x3a2a1a);
    g.fillRect(4, 10, 3, 6);
    g.fillStyle(0x111111);
    g.fillCircle(10, 12, 6);
    g.fillStyle(0x333333);
    g.fillRect(0, 5, 3, 2);
    g.fillRect(0, 9, 1, 3);
    g.fillRect(4, 9, 1, 3);
    g.generateTexture('gun-saw', 30, 18);
    g.destroy();

    // Upgraded M4A1: base rifle + scope + suppressor accents
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x3a3a3a);
    g.fillRect(0, 5, 5, 5);
    g.fillStyle(0x2b2b2b);
    g.fillRect(4, 4, 12, 5);
    g.fillStyle(0x1a1a1a);
    g.fillRect(9, 0, 8, 3);
    g.fillStyle(0x1e1e1e);
    g.fillRect(15, 5, 8, 3);
    g.fillStyle(0x444444);
    g.fillRect(23, 5, 7, 3);
    g.fillStyle(0x111111);
    g.fillRect(9, 9, 4, 8);
    g.generateTexture('gun-m4-upgrade', 30, 17);
    g.destroy();

    // Rocket launcher: thick tube, shoulder rest, front/rear openings
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x4a5a3a);
    g.fillRect(0, 2, 30, 9);
    g.fillStyle(0x2f3a26);
    g.fillRect(0, 2, 4, 9);
    g.fillRect(26, 2, 4, 9);
    g.fillStyle(0x1a1a1a);
    g.fillCircle(28, 6, 4);
    g.fillStyle(0x6b4423);
    g.fillRect(6, 9, 4, 6);
    g.generateTexture('gun-rocket', 32, 15);
    g.destroy();
  }

  handleInput(cursors) {
    const velocity = this.sprite.body.velocity;
    velocity.x = 0;
    velocity.y = 0;

    const up = cursors.up.isDown || this.wasd.up.isDown;
    const down = cursors.down.isDown || this.wasd.down.isDown;
    const left = cursors.left.isDown || this.wasd.left.isDown;
    const right = cursors.right.isDown || this.wasd.right.isDown;

    if (up) velocity.y = -this.speed;
    if (down) velocity.y = this.speed;
    if (left) velocity.x = -this.speed;
    if (right) velocity.x = this.speed;

    // Normalize diagonal movement
    if (velocity.x !== 0 && velocity.y !== 0) {
      velocity.x *= 0.707;
      velocity.y *= 0.707;
    }

    // Face the direction of travel; pause walk animation when idle
    if (velocity.x !== 0 || velocity.y !== 0) {
      if (velocity.x !== 0) {
        this.sprite.setFlipX(velocity.x < 0);
      }
      if (!this.sprite.anims.isPlaying) {
        this.sprite.play('player-walk');
      }
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(0);
    }
  }

  update() {
    // Track mouse position for aiming
    this.targetAngle = Phaser.Math.Angle.Between(
      this.sprite.x,
      this.sprite.y,
      this.scene.input.mousePointer.worldX,
      this.scene.input.mousePointer.worldY
    );

    // Position and aim the M4A1 toward the mouse
    this.gunSprite.setPosition(this.sprite.x, this.sprite.y + 3);
    this.gunSprite.setRotation(this.targetAngle);
    const facingLeft = Math.abs(this.targetAngle) > Math.PI / 2;
    this.gunSprite.setFlipY(facingLeft);
    if (facingLeft) {
      this.gunSprite.setOrigin(0.15, -0.5);
    } else {
      this.gunSprite.setOrigin(0.15, 0.5);
    }

    // Update shoot cooldown
    if (this.shootCooldown > 0) {
      this.shootCooldown -= 1000 / 60;
    }

    const weapon = Player.WEAPONS[this.weaponKey];
    if (this.rapidFireTime > 0) {
      this.rapidFireTime -= 1000 / 60;
      this.shootDelay = weapon.rapidFireDelay;
    } else {
      this.shootDelay = weapon.fireDelay;
    }
  }

  setWeapon(weaponKey) {
    const weapon = Player.WEAPONS[weaponKey];
    if (!weapon) return;

    this.weaponKey = weaponKey;
    this.ammo = weapon.ammo;
    this.gunSprite.setTexture(weapon.texture);
    this.gunSprite.setDisplaySize(weapon.width, weapon.height);
  }

  shoot() {
    if (this.shootCooldown <= 0 && this.hasAmmo()) {
      this.fireFromMuzzle(this.targetAngle);
      this.shootCooldown = this.shootDelay;
    }
  }

  shootTowards(x, y) {
    if (this.shootCooldown <= 0 && this.hasAmmo()) {
      const angle = Phaser.Math.Angle.Between(
        this.sprite.x,
        this.sprite.y,
        x,
        y
      );
      this.fireFromMuzzle(angle);
      this.shootCooldown = this.shootDelay;
    }
  }

  hasAmmo() {
    return this.ammo > 0;
  }

  fireFromMuzzle(angle) {
    const weapon = Player.WEAPONS[this.weaponKey];
    const muzzleLength = 25;
    const x = this.sprite.x + Math.cos(angle) * muzzleLength;
    const y = this.sprite.y + Math.sin(angle) * muzzleLength;

    if (weapon.isRocket) {
      new RocketProjectile(this.scene, x, y, angle);
    } else {
      new Projectile(this.scene, x, y, angle);
    }

    if (this.ammo !== Infinity) {
      this.ammo--;
      if (this.ammo <= 0) {
        this.setWeapon('m4a1');
      }
    }
  }

  takeDamage(amount) {
    this.health -= amount;
  }
}
