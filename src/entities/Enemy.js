import Phaser from 'phaser';

export default class Enemy {
  // visualOnly: driven by host enemy-state broadcasts on non-host multiplayer
  // clients instead of running real AI/physics — see NetworkManager/GameScene.
  constructor(scene, x, y, wave = 1, zombie = false, visualOnly = false) {
    this.scene = scene;
    this.wave = wave;
    this.zombie = zombie;
    this.visualOnly = visualOnly;
    this.health = 1 + Math.floor(wave / 2);
    this.speed = zombie ? 70 + wave * 8 : 100 + wave * 10;
    this.shootCooldown = Phaser.Math.Between(1000, 2000);
    this.targetX = x;
    this.targetY = y;

    Enemy.ensureTextures(scene);
    if (zombie) Enemy.ensureZombieTexture(scene);

    // Create enemy sprite
    this.sprite = scene.physics.add.sprite(x, y, zombie ? 'zombieWalk' : 'enemyWalk', 0);
    this.sprite.setDisplaySize(24, 28.8);
    this.sprite.body.setSize(16, 20);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.body.setBounce(1);
    this.sprite.play(zombie ? 'zombie-walk' : 'enemy-walk');

    if (visualOnly) {
      // Non-host clients don't run AI/collision physics against these
      this.sprite.body.moves = false;
    }

    // Store reference to this enemy instance on the sprite
    this.sprite.enemyInstance = this;

    scene.enemies.add(this.sprite);

    if (!zombie) {
      // Assign a random modern weapon and attach a visual gun sprite
      this.gunType = Phaser.Utils.Array.GetRandom(Enemy.GUN_TYPES);
      this.gunSprite = scene.add.image(x, y, `gun-${this.gunType.key}`);
      this.gunSprite.setOrigin(0.1, 0.5);
      this.gunSprite.setDisplaySize(this.gunType.width * 1.2, this.gunType.height * 1.2);
    }

    // Cover-seeking behavior (zombies always rush, never seek cover)
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

    for (let i = 0; i < frames; i++) {
      const ox = i * frameW;
      // leg swing offset: alternate legs forward/back
      const swing = [3, 1, -3, 1][i];
      Enemy.drawSoldierFrame(graphics, ox, swing);
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

  static drawSoldierFrame(g, ox, swing) {
    const skin = 0xd9a066;
    const skinDark = 0xa66f3f;
    const shirt = 0x5c2020;
    const shirtLight = 0x7a2b2b;
    const shirtDark = 0x3a1414;
    const vest = 0x2e2e2e;
    const vestLight = 0x454545;
    const pants = 0x33302a;
    const pantsDark = 0x201e1a;
    const boot = 0x18181a;
    const outline = 0x0d0d0d;

    // ground shadow
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(ox + 8, 19, 8, 2.2);

    // legs (walking swing), boots
    g.fillStyle(pantsDark);
    g.fillRect(ox + 5 + swing * 0.3, 14, 3, 6);
    g.fillRect(ox + 8 - swing * 0.3, 14, 3, 6);
    g.fillStyle(pants);
    g.fillRect(ox + 5.4 + swing * 0.3, 14, 2, 5);
    g.fillRect(ox + 8.4 - swing * 0.3, 14, 2, 5);
    g.fillStyle(boot);
    g.fillRect(ox + 5 + swing * 0.3, 18.4, 3.2, 1.6);
    g.fillRect(ox + 8 - swing * 0.3, 18.4, 3.2, 1.6);

    // torso: dark undershirt + tactical vest with shading
    g.fillStyle(shirtDark);
    g.fillRect(ox + 4, 8, 8, 7);
    g.fillStyle(shirt);
    g.fillRect(ox + 4.5, 8.5, 7, 5.5);
    g.fillStyle(shirtLight);
    g.fillRect(ox + 4.5, 8.5, 7, 1.4);

    g.fillStyle(vest);
    g.fillRect(ox + 4, 9, 8, 5);
    g.fillStyle(vestLight);
    g.fillRect(ox + 4, 9, 8, 1.2);
    // vest pouches/straps
    g.fillStyle(outline);
    g.fillRect(ox + 5.5, 10.5, 1.6, 2.4);
    g.fillRect(ox + 8.8, 10.5, 1.6, 2.4);
    g.fillRect(ox + 7.5, 8.6, 1, 5.4);

    // arms
    g.fillStyle(skinDark);
    g.fillRect(ox + 2, 9, 2.2, 5.4);
    g.fillRect(ox + 11.8, 9, 2.2, 5.4);
    g.fillStyle(skin);
    g.fillRect(ox + 2.2, 9, 1.6, 4.6);
    g.fillRect(ox + 12, 9, 1.6, 4.6);
    // sleeve cuffs
    g.fillStyle(shirtDark);
    g.fillRect(ox + 2, 9, 2.2, 1.6);
    g.fillRect(ox + 11.8, 9, 2.2, 1.6);

    // neck + head
    g.fillStyle(skinDark);
    g.fillRect(ox + 6.6, 6.6, 2.8, 2);
    g.fillStyle(skin);
    g.fillCircle(ox + 8, 5, 4);
    g.fillStyle(0xe8b57e);
    g.fillCircle(ox + 6.9, 3.8, 1.4);

    // helmet/cap with brim shading, distinct from player
    g.fillStyle(0x2a2e22);
    g.fillRect(ox + 4, 1.6, 8, 3);
    g.fillStyle(0x3a4030);
    g.fillRect(ox + 4, 1.6, 8, 1.4);
    g.fillStyle(0x1c1f16);
    g.fillRect(ox + 3.4, 3.6, 9.2, 1.2);

    // eyes
    g.fillStyle(outline);
    g.fillRect(ox + 6, 4.6, 1, 1);
    g.fillRect(ox + 9, 4.6, 1, 1);
  }

  static ensureZombieTexture(scene) {
    if (scene.textures.exists('zombieWalk')) {
      if (!scene.anims.exists('zombie-walk')) {
        scene.anims.create({
          key: 'zombie-walk',
          frames: scene.anims.generateFrameNumbers('zombieWalk', { start: 0, end: 3 }),
          frameRate: 6,
          repeat: -1
        });
      }
      return;
    }

    const frameW = 16;
    const frameH = 20;
    const frames = 4;
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });

    for (let i = 0; i < frames; i++) {
      const ox = i * frameW;
      // shambling, uneven leg swing, slight per-frame stagger for a lurching gait
      const swing = [2, 0, -2, 0][i];
      const stagger = [0, 0.6, 0, -0.6][i];
      Enemy.drawZombieFrame(graphics, ox, swing, stagger);
    }

    graphics.generateTexture('zombieWalk', frameW * frames, frameH);
    graphics.destroy();

    scene.textures.get('zombieWalk').setFilter(Phaser.Textures.FilterMode.NEAREST);

    for (let i = 0; i < frames; i++) {
      scene.textures.get('zombieWalk').add(i, 0, i * frameW, 0, frameW, frameH);
    }

    scene.anims.create({
      key: 'zombie-walk',
      frames: scene.anims.generateFrameNumbers('zombieWalk', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1
    });
  }

  static drawZombieFrame(g, ox, swing, stagger) {
    const skin = 0x7a9b5c;
    const skinDark = 0x4e6b38;
    const skinSick = 0x93b56e;
    const shirt = 0x3a4a2a;
    const shirtDark = 0x232e19;
    const pants = 0x2a3a1a;
    const pantsDark = 0x18220e;
    const outline = 0x131a0c;
    const gore = 0x6b1a1a;
    const goreDark = 0x3d0e0e;
    const bone = 0xd8cfa8;

    // ground shadow (uneven posture, shifted with stagger)
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(ox + 8 + stagger, 19, 8, 2.2);

    // legs, uneven/torn trouser hems, one bare shin exposed
    g.fillStyle(pantsDark);
    g.fillRect(ox + 5 + swing * 0.3, 14, 3, 5.5);
    g.fillRect(ox + 8 - swing * 0.3, 14, 3, 5.5);
    g.fillStyle(pants);
    g.fillRect(ox + 5.3 + swing * 0.3, 14, 2.2, 4.5);
    g.fillRect(ox + 8.3 - swing * 0.3, 14, 2.2, 4.5);
    // torn hem + exposed bone/skin on rear leg
    g.fillStyle(skinDark);
    g.fillRect(ox + 5.2 + swing * 0.3, 17.4, 2.6, 1.6);
    g.fillStyle(bone);
    g.fillRect(ox + 6, 18.4, 0.8, 1.2);
    g.fillStyle(outline);
    g.fillRect(ox + 5 + swing * 0.3, 19, 3.4, 0.8);
    g.fillRect(ox + 8 - swing * 0.3, 19, 3.4, 0.8);

    // torso, slouched/leaning with tattered shirt bottom
    g.fillStyle(shirtDark);
    g.fillRect(ox + 4, 8 + stagger * 0.4, 8, 7);
    g.fillStyle(shirt);
    g.fillRect(ox + 4.5, 8.5 + stagger * 0.4, 7, 5);
    g.fillTriangle(ox + 4.5, 13.5, ox + 6.5, 15, ox + 5.5, 13.5);
    g.fillTriangle(ox + 10, 13.5, ox + 12, 15.2, ox + 11, 13.5);

    // large gore wound with darker core
    g.fillStyle(goreDark);
    g.fillRect(ox + 5.5, 9.2 + stagger * 0.4, 4, 3.4);
    g.fillStyle(gore);
    g.fillRect(ox + 6, 9.6 + stagger * 0.4, 3, 2.2);
    g.fillStyle(0x8f2a2a);
    g.fillRect(ox + 6.3, 9.9 + stagger * 0.4, 1.2, 1);

    // exposed ribs peeking through the wound
    g.fillStyle(bone);
    g.fillRect(ox + 6.2, 10.4 + stagger * 0.4, 0.6, 1.6);
    g.fillRect(ox + 7.4, 10.4 + stagger * 0.4, 0.6, 1.6);

    // reaching claw-like arms, elongated and asymmetric
    g.fillStyle(skinDark);
    g.fillRect(ox + 0.5, 7.5 + stagger, 3, 4.6);
    g.fillRect(ox + 12.5, 8.2 - stagger, 3, 4.6);
    g.fillStyle(skin);
    g.fillRect(ox + 0.7, 7.5 + stagger, 2.2, 3.8);
    g.fillRect(ox + 12.7, 8.2 - stagger, 2.2, 3.8);
    // claw fingers
    g.fillStyle(skinDark);
    g.fillRect(ox - 0.4, 11.8 + stagger, 1.2, 1.4);
    g.fillRect(ox + 1.2, 12 + stagger, 1.2, 1.4);
    g.fillRect(ox + 13.4, 12.5 - stagger, 1.2, 1.4);
    g.fillRect(ox + 15, 12.7 - stagger, 1.2, 1.4);

    // neck + head, tilted for a broken-neck lurch
    g.fillStyle(skinDark);
    g.fillRect(ox + 6.6, 6.6, 2.8, 2);
    g.fillStyle(skin);
    g.fillCircle(ox + 8 + stagger * 0.5, 5, 4);
    g.fillStyle(skinSick);
    g.fillCircle(ox + 6.9 + stagger * 0.5, 3.8, 1.4);

    // patchy hair / scalp wound
    g.fillStyle(shirtDark);
    g.fillRect(ox + 5 + stagger * 0.5, 1.8, 3, 2);
    g.fillStyle(goreDark);
    g.fillRect(ox + 9 + stagger * 0.5, 2.4, 2, 1.6);

    // sunken dead eyes + slack jaw
    g.fillStyle(outline);
    g.fillRect(ox + 5.8 + stagger * 0.5, 4.4, 1.2, 1.2);
    g.fillRect(ox + 9 + stagger * 0.5, 4.4, 1.2, 1.2);
    g.fillStyle(0x1a0d0d);
    g.fillRect(ox + 6.6 + stagger * 0.5, 6.4, 2.8, 1);
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

  // Lerp toward the last host-broadcast position/rotation; no AI, no shooting.
  updateVisualOnly() {
    this.sprite.x = Phaser.Math.Linear(this.sprite.x, this.targetX, 0.25);
    this.sprite.y = Phaser.Math.Linear(this.sprite.y, this.targetY, 0.25);

    if (this.gunSprite) {
      this.gunSprite.setPosition(this.sprite.x, this.sprite.y + 3);
      this.gunSprite.setRotation(this.targetRotation || 0);
      this.gunSprite.setVisible(true);
    }
  }

  applyRemoteState(state) {
    this.targetX = state.x;
    this.targetY = state.y;
    this.targetRotation = state.rotation;
    this.health = state.health;
  }

  update(playerSprite) {
    if (this.visualOnly) {
      this.updateVisualOnly();
      return;
    }

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
      if (this.gunSprite) this.gunSprite.setVisible(false);
      return;
    }

    if (this.zombie) {
      // Unarmed: just shamble straight at the player, no cover/strafing/shooting
      const avoidance = this.computeAvoidance();
      let vx = Math.cos(angleToPlayer) + avoidance.x;
      let vy = Math.sin(angleToPlayer) + avoidance.y;
      const len = Math.hypot(vx, vy) || 1;
      vx /= len;
      vy /= len;
      this.sprite.body.setVelocity(vx * this.speed, vy * this.speed);

      if (Math.abs(this.sprite.body.velocity.x) > 5) {
        this.sprite.setFlipX(this.sprite.body.velocity.x < 0);
      }
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
    if (this.gunSprite) this.gunSprite.destroy();
  }
}
