import Phaser from 'phaser';

export default class Enemy {
  constructor(scene, x, y, wave = 1) {
    this.scene = scene;
    this.wave = wave;
    this.health = 1 + Math.floor(wave / 2);
    this.speed = 100 + wave * 10;
    this.shootCooldown = Phaser.Math.Between(1000, 2000);

    Enemy.ensureTextures(scene);

    // Create enemy sprite
    this.sprite = scene.physics.add.sprite(x, y, 'enemyWalk', 0);
    this.sprite.setDisplaySize(24, 28.8);
    this.sprite.body.setSize(16, 20);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.body.setBounce(1);
    this.sprite.play('enemy-walk');

    // Store reference to this enemy instance on the sprite
    this.sprite.enemyInstance = this;

    scene.enemies.add(this.sprite);

    // Assign a random modern weapon and attach a visual gun sprite
    this.gunType = Phaser.Utils.Array.GetRandom(Enemy.GUN_TYPES);
    this.gunSprite = scene.add.image(x, y, `gun-${this.gunType.key}`);
    this.gunSprite.setOrigin(0.1, 0.5);
    this.gunSprite.setDisplaySize(this.gunType.width * 1.2, this.gunType.height * 1.2);

    // Cover-seeking behavior
    this.coverChance = Math.random(); // some enemies prefer cover more than others
    this.coverTarget = null;
    this.coverState = 'engage'; // engage | seekingCover | inCover | peeking
    this.peekTimer = 0;
    this.coverReevaluateTimer = Phaser.Math.Between(500, 1500);
  }

  static get GUN_TYPES() {
    return [
      { key: 'pistol', width: 10, height: 6, fireRate: [1200, 2200], bulletSpeed: 220, color: 0xffff00 },
      { key: 'smg', width: 14, height: 6, fireRate: [400, 800], bulletSpeed: 260, color: 0xffdd44 },
      { key: 'rifle', width: 18, height: 6, fireRate: [700, 1300], bulletSpeed: 320, color: 0xff8800 },
      { key: 'shotgun', width: 16, height: 7, fireRate: [1400, 2400], bulletSpeed: 240, color: 0xff4400 }
    ];
  }

  static ensureTextures(scene) {
    Enemy.ensureGunTextures(scene);

    if (scene.textures.exists('enemyWalk')) {
      if (!scene.anims.exists('enemy-walk')) {
        scene.anims.create({
          key: 'enemy-walk',
          frames: scene.anims.generateFrameNumbers('enemyWalk', { start: 0, end: 3 }),
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

    const skin = 0xffcc99;
    const shirt = 0xdd2222;
    const pants = 0x552222;
    const outline = 0x220000;

    for (let i = 0; i < frames; i++) {
      const ox = i * frameW;
      // leg swing offset: alternate legs forward/back
      const swing = [3, 1, -3, 1][i];

      // head
      graphics.fillStyle(skin);
      graphics.fillCircle(ox + 8, 5, 4);

      // body
      graphics.fillStyle(shirt);
      graphics.fillRect(ox + 4, 8, 8, 7);

      // arms
      graphics.fillStyle(skin);
      graphics.fillRect(ox + 2, 9, 2, 5);
      graphics.fillRect(ox + 12, 9, 2, 5);

      // legs (walking swing)
      graphics.fillStyle(pants);
      graphics.fillRect(ox + 5 + swing * 0.3, 15, 3, 5);
      graphics.fillRect(ox + 8 - swing * 0.3, 15, 3, 5);

      // outline dot for eyes
      graphics.fillStyle(outline);
      graphics.fillRect(ox + 6, 4, 1, 1);
      graphics.fillRect(ox + 9, 4, 1, 1);
    }

    graphics.generateTexture('enemyWalk', frameW * frames, frameH);
    graphics.destroy();

    scene.textures.get('enemyWalk').setFilter(Phaser.Textures.FilterMode.NEAREST);

    for (let i = 0; i < frames; i++) {
      scene.textures.get('enemyWalk').add(i, 0, i * frameW, 0, frameW, frameH);
    }

    scene.anims.create({
      key: 'enemy-walk',
      frames: scene.anims.generateFrameNumbers('enemyWalk', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1
    });
  }

  static ensureGunTextures(scene) {
    if (scene.textures.exists('gun-pistol')) return;

    const barrel = 0x2b2b2b;
    const body = 0x1a1a1a;
    const grip = 0x3d2b1f;
    const accent = 0x555555;

    // Pistol: short barrel + grip
    let g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(body);
    g.fillRect(0, 2, 9, 3);
    g.fillStyle(grip);
    g.fillRect(1, 5, 3, 4);
    g.fillStyle(barrel);
    g.fillRect(8, 2, 3, 2);
    g.generateTexture('gun-pistol', 11, 9);
    g.destroy();

    // SMG: boxier body, short barrel, stick magazine
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(body);
    g.fillRect(0, 2, 12, 4);
    g.fillStyle(grip);
    g.fillRect(2, 6, 3, 5);
    g.fillStyle(accent);
    g.fillRect(4, 6, 2, 6);
    g.fillStyle(barrel);
    g.fillRect(11, 3, 4, 2);
    g.generateTexture('gun-smg', 15, 12);
    g.destroy();

    // Rifle: long barrel, stock
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(body);
    g.fillRect(0, 3, 14, 3);
    g.fillStyle(grip);
    g.fillRect(3, 6, 3, 5);
    g.fillStyle(accent);
    g.fillRect(-3, 4, 4, 3);
    g.fillStyle(barrel);
    g.fillRect(13, 3, 6, 2);
    g.generateTexture('gun-rifle', 20, 12);
    g.destroy();

    // Shotgun: thick double barrel, pump
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x5a3a1a);
    g.fillRect(0, 2, 12, 4);
    g.fillStyle(grip);
    g.fillRect(2, 6, 3, 5);
    g.fillStyle(barrel);
    g.fillRect(10, 1, 6, 3);
    g.fillStyle(accent);
    g.fillRect(10, 4, 6, 2);
    g.generateTexture('gun-shotgun', 17, 10);
    g.destroy();
  }

  update(playerSprite) {
    const angleToPlayer = Phaser.Math.Angle.Between(
      this.sprite.x,
      this.sprite.y,
      playerSprite.x,
      playerSprite.y
    );
    const distToPlayer = Phaser.Math.Distance.Between(
      this.sprite.x,
      this.sprite.y,
      playerSprite.x,
      playerSprite.y
    );

    // Enemies far outside the camera view stay dormant to keep the large map performant
    if (distToPlayer > 900) {
      this.sprite.body.setVelocity(0, 0);
      this.gunSprite.setVisible(false);
      return;
    }
    this.gunSprite.setVisible(true);

    this.updateCoverState(playerSprite, distToPlayer);

    let moveAngle = angleToPlayer;
    let shouldMove = true;
    let canShoot = true;

    if (this.coverState === 'seekingCover' && this.coverTarget) {
      const spot = this.getCoverSpot(this.coverTarget, playerSprite);
      const distToSpot = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, spot.x, spot.y);
      if (distToSpot < 12) {
        this.coverState = 'inCover';
        this.peekTimer = Phaser.Math.Between(600, 1200);
      } else {
        moveAngle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, spot.x, spot.y);
      }
      canShoot = false;
    } else if (this.coverState === 'inCover') {
      shouldMove = false;
      canShoot = false;
    } else if (this.coverState === 'peeking') {
      shouldMove = false;
      canShoot = true;
    } else {
      // engage: preferred engagement range, close in then strafe
      const preferredRange = 160;
      if (distToPlayer < preferredRange - 20) {
        moveAngle = angleToPlayer + Math.PI;
      } else if (distToPlayer < preferredRange + 40) {
        moveAngle = angleToPlayer + (this.strafeDir || (this.strafeDir = Math.random() < 0.5 ? 1 : -1)) * Math.PI / 2;
        if (Math.random() < 0.005) this.strafeDir = -this.strafeDir;
      }
    }

    if (shouldMove) {
      const avoidance = this.computeAvoidance();
      let vx = Math.cos(moveAngle) + avoidance.x;
      let vy = Math.sin(moveAngle) + avoidance.y;
      const len = Math.hypot(vx, vy) || 1;
      vx /= len;
      vy /= len;
      this.sprite.body.setVelocity(vx * this.speed, vy * this.speed);
    } else {
      this.sprite.body.setVelocity(0, 0);
    }

    // Face the direction of travel (or toward player when stationary in cover)
    if (Math.abs(this.sprite.body.velocity.x) > 5) {
      this.sprite.setFlipX(this.sprite.body.velocity.x < 0);
    } else if (!shouldMove) {
      this.sprite.setFlipX(Math.cos(angleToPlayer) < 0);
    }

    // Position and aim the gun toward the player
    this.gunSprite.setPosition(this.sprite.x, this.sprite.y + 3);
    this.gunSprite.setRotation(angleToPlayer);
    this.gunSprite.setFlipY(this.sprite.flipX);
    if (this.sprite.flipX) {
      this.gunSprite.setOrigin(0.1, -0.5);
    } else {
      this.gunSprite.setOrigin(0.1, 0.5);
    }
    this.gunSprite.setVisible(canShoot || this.coverState !== 'inCover');

    // Shoot at player occasionally, but only with a clear line of sight
    this.shootCooldown -= 1000 / 60;
    if (canShoot && this.shootCooldown <= 0 && distToPlayer < 300 &&
        this.hasLineOfSight(playerSprite)) {
      this.shootAtPlayer(playerSprite);
      const [minDelay, maxDelay] = this.gunType.fireRate;
      this.shootCooldown = Phaser.Math.Between(minDelay, maxDelay);
    }
  }

  hasLineOfSight(playerSprite) {
    const line = new Phaser.Geom.Line(
      this.sprite.x,
      this.sprite.y,
      playerSprite.x,
      playerSprite.y
    );

    const obstacles = this.scene.obstacles.children.entries;
    for (let i = 0; i < obstacles.length; i++) {
      const bounds = obstacles[i].getBounds();
      if (Phaser.Geom.Intersects.LineToRectangle(line, bounds)) {
        return false;
      }
    }

    return true;
  }

  updateCoverState(playerSprite, distToPlayer) {
    const dt = 1000 / 60;

    if (this.coverState === 'inCover') {
      this.peekTimer -= dt;
      if (this.peekTimer <= 0) {
        this.coverState = 'peeking';
        this.peekTimer = Phaser.Math.Between(500, 900);
      }
      return;
    }

    if (this.coverState === 'peeking') {
      this.peekTimer -= dt;
      if (this.peekTimer <= 0) {
        // Chance to break from cover and re-engage instead of ducking back
        if (Math.random() < 0.3) {
          this.coverState = 'engage';
          this.coverTarget = null;
        } else {
          this.coverState = 'inCover';
          this.peekTimer = Phaser.Math.Between(700, 1400);
        }
      }
      return;
    }

    // engage / seekingCover: periodically decide whether to seek cover
    this.coverReevaluateTimer -= dt;
    if (this.coverReevaluateTimer > 0) return;
    this.coverReevaluateTimer = Phaser.Math.Between(1500, 3000);

    // Being shot at closer range makes cover more attractive; low health too
    const wantsCover = this.coverChance < 0.6 && distToPlayer < 350;

    if (wantsCover && this.coverState === 'engage') {
      const nearestCover = this.findNearestCoverObstacle(playerSprite);
      if (nearestCover) {
        this.coverTarget = nearestCover;
        this.coverState = 'seekingCover';
      }
    }
  }

  findNearestCoverObstacle(playerSprite) {
    let best = null;
    let bestDist = 400;

    this.scene.obstacles.children.entries.forEach(obstacle => {
      const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, obstacle.x, obstacle.y);
      if (dist < bestDist) {
        best = obstacle;
        bestDist = dist;
      }
    });

    return best;
  }

  getCoverSpot(obstacle, playerSprite) {
    // Stand on the far side of the obstacle relative to the player
    const angleFromPlayer = Phaser.Math.Angle.Between(playerSprite.x, playerSprite.y, obstacle.x, obstacle.y);
    const offset = 26;
    return {
      x: obstacle.x + Math.cos(angleFromPlayer) * offset,
      y: obstacle.y + Math.sin(angleFromPlayer) * offset
    };
  }

  computeAvoidance() {
    let ax = 0;
    let ay = 0;
    const avoidRadius = 60;

    const checkGroup = (group) => {
      group.children.entries.forEach(obj => {
        if (obj === this.sprite) return;
        const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, obj.x, obj.y);
        if (dist < avoidRadius && dist > 0) {
          const pushAngle = Phaser.Math.Angle.Between(obj.x, obj.y, this.sprite.x, this.sprite.y);
          const strength = (avoidRadius - dist) / avoidRadius;
          ax += Math.cos(pushAngle) * strength;
          ay += Math.sin(pushAngle) * strength;
        }
      });
    };

    checkGroup(this.scene.obstacles);
    checkGroup(this.scene.turrets);
    checkGroup(this.scene.enemies);

    return { x: ax, y: ay };
  }

  shootAtPlayer(playerSprite) {
    const angle = Phaser.Math.Angle.Between(
      this.sprite.x,
      this.sprite.y,
      playerSprite.x,
      playerSprite.y
    );

    // Create graphics for enemy bullet (colored per gun type)
    const bulletKey = `enemyBulletTexture-${this.gunType.key}`;
    if (!this.scene.textures.exists(bulletKey)) {
      const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
      graphics.fillStyle(this.gunType.color);
      graphics.fillRect(0, 0, 8, 8);
      graphics.generateTexture(bulletKey, 8, 8);
      graphics.destroy();
    }

    const pelletCount = this.gunType.key === 'shotgun' ? 3 : 1;
    const spreadStep = this.gunType.key === 'shotgun' ? 0.15 : 0;

    for (let p = 0; p < pelletCount; p++) {
      const pelletAngle = angle + (p - (pelletCount - 1) / 2) * spreadStep;

      const bullet = this.scene.physics.add.sprite(
        this.gunSprite.x + Math.cos(angle) * this.gunType.width,
        this.gunSprite.y + Math.sin(angle) * this.gunType.width,
        bulletKey
      );
      bullet.body.setVelocity(
        Math.cos(pelletAngle) * this.gunType.bulletSpeed,
        Math.sin(pelletAngle) * this.gunType.bulletSpeed
      );

      this.registerBulletCollision(bullet);
    }
  }

  registerBulletCollision(bullet) {

    // Collision with player (or tank, if the player is currently driving one)
    this.scene.physics.add.overlap(
      bullet,
      this.scene.player.sprite,
      () => {
        bullet.destroy();
        this.scene.damagePlayerOrTank(1);
      }
    );

    // Auto-destroy after 5 seconds
    this.scene.time.delayedCall(5000, () => {
      if (bullet.active) bullet.destroy();
    });
  }

  takeDamage(amount) {
    this.health -= amount;
  }

  destroy() {
    this.sprite.destroy();
    this.gunSprite.destroy();
  }
}
