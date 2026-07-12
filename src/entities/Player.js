import Phaser from 'phaser';
import Projectile from './Projectile.js';
import RocketProjectile from './RocketProjectile.js';
import { playShoot } from '../sound/SoundManager.js';

export default class Player {
  // magSize/maxMags are [min, max] ranges: each weapon rolls a random
  // magazine capacity and a random number of spare magazines (reserve)
  // when equipped, so the same gun can carry a different total each run.
  static get WEAPONS() {
    return {
      m4a1: { texture: 'gun-m4a1', width: 33, height: 12, fireDelay: 50, rapidFireDelay: 30, pellets: 1, magSize: null, maxMags: null, overheatSeconds: 5, label: 'M4A1' },
      saw: { texture: 'gun-saw', width: 38, height: 14, fireDelay: 60, rapidFireDelay: 35, pellets: 1, magSize: [60, 100], maxMags: [2, 4], label: 'M249 SAW' },
      'm4-upgrade': { texture: 'gun-m4-upgrade', width: 34, height: 13, fireDelay: 70, rapidFireDelay: 40, pellets: 1, magSize: [25, 35], maxMags: [3, 6], label: 'M4A1 (Upgraded)' },
      rocket: { texture: 'gun-rocket', width: 34, height: 14, fireDelay: 800, rapidFireDelay: 700, pellets: 1, magSize: [1, 1], maxMags: [3, 6], label: 'Rocket Launcher', isRocket: true },

      glock17: { texture: 'gun-glock17', width: 18, height: 11, fireDelay: 180, rapidFireDelay: 110, pellets: 1, magSize: [15, 20], maxMags: [3, 8], label: 'Glock 17' },
      m1911: { texture: 'gun-m1911', width: 19, height: 11, fireDelay: 220, rapidFireDelay: 140, pellets: 1, magSize: [7, 10], maxMags: [3, 8], label: 'M1911' },
      deagle: { texture: 'gun-deagle', width: 21, height: 12, fireDelay: 300, rapidFireDelay: 190, pellets: 1, magSize: [7, 9], maxMags: [2, 6], label: 'Desert Eagle' },

      uzi: { texture: 'gun-uzi', width: 22, height: 13, fireDelay: 65, rapidFireDelay: 40, pellets: 1, magSize: [25, 32], maxMags: [3, 7], label: 'Uzi' },
      mp5: { texture: 'gun-mp5', width: 25, height: 12, fireDelay: 75, rapidFireDelay: 45, pellets: 1, magSize: [25, 30], maxMags: [3, 7], label: 'MP5' },
      ump45: { texture: 'gun-ump45', width: 26, height: 13, fireDelay: 90, rapidFireDelay: 55, pellets: 1, magSize: [20, 25], maxMags: [3, 6], label: 'UMP45' },
      p90: { texture: 'gun-p90', width: 27, height: 14, fireDelay: 55, rapidFireDelay: 32, pellets: 1, magSize: [45, 50], maxMags: [2, 5], label: 'P90' },
      vector: { texture: 'gun-vector', width: 24, height: 13, fireDelay: 45, rapidFireDelay: 25, pellets: 1, magSize: [25, 33], maxMags: [3, 6], label: 'Vector' },

      ak47: { texture: 'gun-ak47', width: 34, height: 13, fireDelay: 100, rapidFireDelay: 60, pellets: 1, magSize: [25, 30], maxMags: [3, 7], label: 'AK-47' },
      akm: { texture: 'gun-akm', width: 34, height: 13, fireDelay: 95, rapidFireDelay: 58, pellets: 1, magSize: [25, 30], maxMags: [3, 7], label: 'AKM' },
      famas: { texture: 'gun-famas', width: 30, height: 13, fireDelay: 65, rapidFireDelay: 38, pellets: 1, magSize: [20, 25], maxMags: [3, 6], label: 'FAMAS' },
      g36: { texture: 'gun-g36', width: 32, height: 14, fireDelay: 85, rapidFireDelay: 50, pellets: 1, magSize: [25, 30], maxMags: [3, 6], label: 'G36' },
      aug: { texture: 'gun-aug', width: 29, height: 14, fireDelay: 80, rapidFireDelay: 48, pellets: 1, magSize: [24, 30], maxMags: [3, 6], label: 'Steyr AUG' },

      scarh: { texture: 'gun-scarh', width: 35, height: 14, fireDelay: 130, rapidFireDelay: 80, pellets: 1, magSize: [16, 20], maxMags: [3, 6], label: 'SCAR-H' },
      svd: { texture: 'gun-svd', width: 38, height: 13, fireDelay: 260, rapidFireDelay: 180, pellets: 1, magSize: [8, 10], maxMags: [2, 5], label: 'Dragunov SVD' },
      barrett: { texture: 'gun-barrett', width: 42, height: 14, fireDelay: 600, rapidFireDelay: 450, pellets: 1, magSize: [5, 10], maxMags: [1, 3], label: 'Barrett M82' },

      remington870: { texture: 'gun-remington870', width: 32, height: 12, fireDelay: 500, rapidFireDelay: 380, pellets: 8, magSize: [6, 8], maxMags: [2, 5], label: 'Remington 870' },
      aa12: { texture: 'gun-aa12', width: 30, height: 13, fireDelay: 220, rapidFireDelay: 150, pellets: 6, magSize: [8, 12], maxMags: [2, 5], label: 'AA-12' },

      m240b: { texture: 'gun-m240b', width: 40, height: 15, fireDelay: 55, rapidFireDelay: 32, pellets: 1, magSize: [80, 120], maxMags: [1, 3], label: 'M240B' },

      rpg7: { texture: 'gun-rpg7', width: 36, height: 13, fireDelay: 900, rapidFireDelay: 800, pellets: 1, magSize: [1, 1], maxMags: [1, 3], label: 'RPG-7', isRocket: true }
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
    this.magAmmo = Infinity;
    this.magSize = Infinity;
    this.reserveMags = 0;
    this.reloading = false;
    this.reloadTime = 0;

    this.heat = 0;
    this.maxHeat = 100;
    this.overheated = false;
    this.overheatCooldown = 4000;
    this.overheatTimer = 0;

    Player.ensureTextures(scene);

    // Create player sprite
    this.sprite = scene.physics.add.sprite(x, y, 'playerWalk', 0);
    this.sprite.setDisplaySize(30, 37.5);
    this.sprite.body.setSize(20, 25);
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
    Player.ensurePistolTextures(scene);
    Player.ensureSmgTextures(scene);
    Player.ensureRifleTextures(scene);
    Player.ensureHeavyTextures(scene);

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

    const frameW = 24;
    const frameH = 30;
    const frames = 4;
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });

    // Leg swing offsets per frame: how far each boot strays from its
    // resting stance (both planted, right forward, both planted, left forward).
    const swings = [3, 1, -3, 1];

    for (let i = 0; i < frames; i++) {
      Player.drawSoldierFrame(graphics, i * frameW, swings[i]);
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

  static drawSoldierFrame(g, ox, swing) {
    const skin = 0xe8b382;
    const skinShade = 0xc9915f;
    const uniform = 0x4b5320; // olive drab
    const uniformLight = 0x5c6628;
    const uniformDark = 0x3a4118;
    const uniformDarkest = 0x272d10;
    const helmet = 0x3d4a1f;
    const helmetLight = 0x4e5c28;
    const helmetDark = 0x2a3315;
    const helmetBand = 0x8b1a1a;
    const strap = 0x1f2410;
    const rig = 0x2f3a1a; // chest webbing, darker than the jacket underneath
    const pouch = 0x232a12;
    const boots = 0x2b2b2b;
    const bootSole = 0x141414;
    const pack = 0x33401c;
    const outline = 0x1a1a1a;
    const star = 0xffffff;

    // Ground shadow, anchors the sprite to the floor
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(ox + 12, 28, 12, 3);

    // Small backpack silhouette peeking past the shoulders
    g.fillStyle(pack);
    g.fillRect(ox + 3, 11, 4, 8);
    g.fillStyle(uniformDarkest);
    g.fillRect(ox + 3, 11, 1, 8);

    // Legs (walking swing) with layered pant shading and distinct boots
    const legL = ox + 8 + swing * 0.35;
    const legR = ox + 12 - swing * 0.35;
    g.fillStyle(uniformDark);
    g.fillRect(legL, 20, 4, 6);
    g.fillRect(legR, 20, 4, 6);
    g.fillStyle(uniformDarkest);
    g.fillRect(legL, 20, 1.2, 6);
    g.fillRect(legR, 20, 1.2, 6);
    // Boots, separated from the pant leg with a sole line
    g.fillStyle(boots);
    g.fillRect(legL - 0.5, 25, 5, 3.5);
    g.fillRect(legR - 0.5, 25, 5, 3.5);
    g.fillStyle(bootSole);
    g.fillRect(legL - 0.5, 27.7, 5, 1.2);
    g.fillRect(legR - 0.5, 27.7, 5, 1.2);

    // Torso: layered jacket shading (dark base, mid tone, top highlight)
    g.fillStyle(uniformDarkest);
    g.fillRect(ox + 6, 12, 12, 10);
    g.fillStyle(uniformDark);
    g.fillRect(ox + 6.5, 13, 11, 8);
    g.fillStyle(uniform);
    g.fillRect(ox + 7, 13, 10, 6);
    g.fillStyle(uniformLight);
    g.fillRect(ox + 7, 13, 10, 2);

    // Chest rig / webbing with ammo pouches over the jacket
    g.fillStyle(rig);
    g.fillRect(ox + 8, 15, 8, 6);
    g.fillStyle(pouch);
    g.fillRect(ox + 9, 17, 2.5, 3);
    g.fillRect(ox + 12.5, 17, 2.5, 3);
    g.fillStyle(strap);
    g.fillRect(ox + 10.5, 13, 1.6, 9);

    // Rear (upper) arm, bent to support the rifle
    g.fillStyle(uniformDark);
    g.fillRect(ox + 4, 14, 3, 6);
    g.fillStyle(skinShade);
    g.fillRect(ox + 4, 19.5, 3, 1.4);

    // Front forearm, extended forward gripping the rifle
    g.fillStyle(uniform);
    g.fillRect(ox + 15, 13.5, 3, 5);
    g.fillStyle(skin);
    g.fillRect(ox + 17, 14, 2.5, 2.4);

    // Head/helmet with rounded dome, brim, and chin strap
    g.fillStyle(helmetDark);
    g.fillCircle(ox + 12, 6, 6);
    g.fillStyle(helmet);
    g.fillCircle(ox + 12, 6, 5.2);
    g.fillStyle(helmetLight);
    g.fillCircle(ox + 10.3, 4.3, 1.8);
    g.fillStyle(helmetDark);
    g.fillRect(ox + 5, 5.5, 14, 2.4);

    // Helmet band with star insignia
    g.fillStyle(helmetBand);
    g.fillRect(ox + 5, 7.5, 14, 2.2);
    g.fillStyle(star);
    g.fillRect(ox + 11, 7.8, 2, 1.6);

    // Chin strap
    g.fillStyle(strap);
    g.fillRect(ox + 9.5, 9.5, 1.2, 3);
    g.fillRect(ox + 13.3, 9.5, 1.2, 3);

    // Face
    g.fillStyle(skin);
    g.fillRect(ox + 8.5, 9, 7, 4.5);
    g.fillStyle(outline);
    g.fillRect(ox + 10, 10.5, 1.2, 1.2);
    g.fillRect(ox + 14, 10.5, 1.2, 1.2);
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

  static ensurePistolTextures(scene) {
    if (scene.textures.exists('gun-glock17')) return;

    // Glock 17: compact polymer pistol, blocky slide, short grip
    let g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x2b2b2b);
    g.fillRect(2, 2, 14, 4);
    g.fillStyle(0x1a1a1a);
    g.fillRect(14, 3, 4, 2);
    g.fillStyle(0x3a3a2a);
    g.fillRect(4, 6, 5, 8);
    g.generateTexture('gun-glock17', 20, 15);
    g.destroy();

    // M1911: longer slide, checkered wood grip, hammer
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x333333);
    g.fillRect(1, 2, 16, 3);
    g.fillStyle(0x1a1a1a);
    g.fillRect(16, 2, 3, 3);
    g.fillStyle(0x222222);
    g.fillRect(1, 1, 3, 2);
    g.fillStyle(0x5a3a1a);
    g.fillRect(4, 5, 5, 8);
    g.generateTexture('gun-m1911', 21, 15);
    g.destroy();

    // Desert Eagle: bulky slide, ported barrel, large grip
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x4a4a4a);
    g.fillRect(1, 1, 18, 5);
    g.fillStyle(0x1a1a1a);
    g.fillRect(18, 2, 3, 3);
    g.fillStyle(0x2a2a2a);
    g.fillRect(1, 0, 4, 2);
    g.fillStyle(0x111111);
    g.fillRect(5, 6, 6, 9);
    g.generateTexture('gun-deagle', 22, 16);
    g.destroy();
  }

  static ensureSmgTextures(scene) {
    if (scene.textures.exists('gun-uzi')) return;

    // Uzi: boxy receiver, magazine through the grip, folding stock nub
    let g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x2a2a2a);
    g.fillRect(2, 3, 16, 6);
    g.fillStyle(0x1a1a1a);
    g.fillRect(18, 4, 4, 3);
    g.fillStyle(0x333333);
    g.fillRect(0, 4, 3, 3);
    g.fillStyle(0x111111);
    g.fillRect(8, 9, 4, 8);
    g.generateTexture('gun-uzi', 24, 18);
    g.destroy();

    // MP5: curved mag, ribbed handguard, drum sight
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x2b2b2b);
    g.fillRect(3, 4, 14, 5);
    g.fillStyle(0x1a1a1a);
    g.fillRect(17, 5, 7, 3);
    g.fillStyle(0x444444);
    g.fillRect(7, 2, 5, 2);
    g.fillStyle(0x111111);
    g.fillRect(9, 9, 3, 8);
    g.fillStyle(0x3a3a3a);
    g.fillRect(0, 5, 3, 3);
    g.generateTexture('gun-mp5', 27, 17);
    g.destroy();

    // UMP45: thick polymer body, straight stick mag, rear stock block
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x3a3a3a);
    g.fillRect(0, 4, 6, 6);
    g.fillStyle(0x2a2a2a);
    g.fillRect(5, 5, 14, 5);
    g.fillStyle(0x1a1a1a);
    g.fillRect(19, 6, 7, 3);
    g.fillStyle(0x111111);
    g.fillRect(9, 10, 4, 9);
    g.generateTexture('gun-ump45', 28, 19);
    g.destroy();

    // P90: bullpup, top-mounted horizontal magazine, enclosed shape
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x555555);
    g.fillRect(2, 6, 22, 5);
    g.fillStyle(0x333333);
    g.fillRect(4, 1, 14, 5);
    g.fillStyle(0x1a1a1a);
    g.fillRect(22, 7, 5, 3);
    g.fillStyle(0x222222);
    g.fillRect(0, 8, 3, 4);
    g.generateTexture('gun-p90', 29, 18);
    g.destroy();

    // Vector: angled grip, slim body, forward-raked magazine
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x2a2a2a);
    g.fillRect(3, 4, 15, 5);
    g.fillStyle(0x1a1a1a);
    g.fillRect(18, 5, 6, 3);
    g.fillStyle(0x3a3a3a);
    g.fillRect(0, 5, 3, 3);
    g.fillStyle(0x111111);
    g.fillRect(11, 9, 4, 9);
    g.generateTexture('gun-vector', 26, 20);
    g.destroy();
  }

  static ensureRifleTextures(scene) {
    if (scene.textures.exists('gun-ak47')) return;

    // AK-47: distinct curved banana magazine, wood furniture accents
    let g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x6b4423);
    g.fillRect(0, 5, 6, 5);
    g.fillStyle(0x2b2b2b);
    g.fillRect(5, 4, 13, 5);
    g.fillStyle(0x1a1a1a);
    g.fillRect(17, 5, 9, 3);
    g.fillStyle(0x6b4423);
    g.fillRect(13, 3, 6, 2);
    g.fillStyle(0x111111);
    g.beginPath();
    g.moveTo(9, 9);
    g.lineTo(13, 9);
    g.lineTo(11, 18);
    g.lineTo(8, 18);
    g.closePath();
    g.fillPath();
    g.generateTexture('gun-ak47', 26, 19);
    g.destroy();

    // AKM: same silhouette family as AK-47 but darker furniture, slotted flash hider
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x3a2a1a);
    g.fillRect(0, 5, 6, 5);
    g.fillStyle(0x252525);
    g.fillRect(5, 4, 13, 5);
    g.fillStyle(0x1a1a1a);
    g.fillRect(17, 5, 8, 2);
    g.fillRect(25, 4, 3, 4);
    g.fillStyle(0x3a2a1a);
    g.fillRect(13, 3, 6, 2);
    g.fillStyle(0x111111);
    g.beginPath();
    g.moveTo(9, 9);
    g.lineTo(13, 9);
    g.lineTo(11, 18);
    g.lineTo(8, 18);
    g.closePath();
    g.fillPath();
    g.generateTexture('gun-akm', 28, 19);
    g.destroy();

    // FAMAS: bullpup with carry handle over the whole receiver, short barrel
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x3a3a3a);
    g.fillRect(1, 5, 20, 5);
    g.fillStyle(0x1a1a1a);
    g.fillRect(1, 1, 12, 4);
    g.fillRect(21, 6, 6, 3);
    g.fillStyle(0x222222);
    g.fillRect(6, 9, 4, 8);
    g.generateTexture('gun-famas', 27, 18);
    g.destroy();

    // G36: distinctive carry-handle scope loop, translucent-style mag block
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x2f3a26);
    g.fillRect(0, 5, 6, 5);
    g.fillStyle(0x1a1a1a);
    g.fillRect(5, 4, 14, 5);
    g.fillRect(19, 5, 9, 3);
    g.fillStyle(0x444444);
    g.strokeRect(9, 0, 8, 4);
    g.fillStyle(0x3a5a3a);
    g.fillRect(10, 9, 4, 9);
    g.generateTexture('gun-g36', 28, 19);
    g.destroy();

    // Steyr AUG: bullpup with integrated forward scope hump
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x2a3a2a);
    g.fillRect(1, 5, 19, 6);
    g.fillStyle(0x1a1a1a);
    g.fillRect(20, 6, 6, 3);
    g.fillStyle(0x111111);
    g.fillRect(6, 1, 8, 4);
    g.fillStyle(0x222222);
    g.fillRect(9, 11, 4, 8);
    g.generateTexture('gun-aug', 26, 19);
    g.destroy();

    // SCAR-H: heavy battle rifle, angular rail handguard, straight mag
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x4a4a3a);
    g.fillRect(0, 5, 6, 5);
    g.fillStyle(0x2b2b2b);
    g.fillRect(5, 4, 14, 5);
    g.fillStyle(0x1a1a1a);
    g.fillRect(18, 5, 10, 3);
    g.fillStyle(0x555555);
    g.fillRect(19, 3, 8, 2);
    g.fillStyle(0x111111);
    g.fillRect(10, 9, 4, 9);
    g.generateTexture('gun-scarh', 29, 19);
    g.destroy();

    // Dragunov SVD: long skeleton stock, PSO scope block, slim barrel
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x5a3a1a);
    g.fillRect(0, 6, 8, 4);
    g.fillStyle(0x2b2b2b);
    g.fillRect(7, 5, 15, 4);
    g.fillStyle(0x1a1a1a);
    g.fillRect(22, 6, 10, 2);
    g.fillStyle(0x333333);
    g.fillRect(10, 1, 10, 4);
    g.fillStyle(0x111111);
    g.fillRect(11, 9, 3, 8);
    g.generateTexture('gun-svd', 32, 18);
    g.destroy();
  }

  static ensureHeavyTextures(scene) {
    if (scene.textures.exists('gun-barrett')) return;

    // Barrett M82: massive body, muzzle brake, large box mag, big scope
    let g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x3a3a3a);
    g.fillRect(0, 6, 10, 6);
    g.fillStyle(0x2b2b2b);
    g.fillRect(9, 5, 18, 6);
    g.fillStyle(0x1a1a1a);
    g.fillRect(27, 6, 8, 4);
    g.fillStyle(0x444444);
    g.fillRect(12, 0, 12, 5);
    g.fillStyle(0x111111);
    g.fillRect(14, 11, 6, 9);
    g.generateTexture('gun-barrett', 36, 20);
    g.destroy();

    // Remington 870: pump shotgun, ribbed slide, tube magazine under barrel
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x5a3a1a);
    g.fillRect(0, 4, 7, 5);
    g.fillStyle(0x3a3a3a);
    g.fillRect(6, 3, 8, 4);
    g.fillStyle(0x1a1a1a);
    g.fillRect(13, 4, 15, 3);
    g.fillStyle(0x555555);
    g.fillRect(9, 8, 12, 3);
    g.generateTexture('gun-remington870', 28, 14);
    g.destroy();

    // AA-12: bulky auto shotgun, drum magazine, top rail
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x2a2a2a);
    g.fillRect(2, 4, 18, 6);
    g.fillStyle(0x1a1a1a);
    g.fillRect(19, 5, 8, 3);
    g.fillStyle(0x444444);
    g.fillRect(5, 2, 10, 2);
    g.fillStyle(0x111111);
    g.fillCircle(9, 13, 6);
    g.generateTexture('gun-aa12', 27, 19);
    g.destroy();

    // M240B: belt-fed LMG, thick barrel shroud, top cover hump, bipod
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x2f3a26);
    g.fillRect(2, 5, 24, 7);
    g.fillStyle(0x1a1a1a);
    g.fillRect(25, 6, 12, 4);
    g.fillStyle(0x3a4a2a);
    g.fillRect(4, 1, 10, 4);
    g.fillStyle(0x333333);
    g.fillRect(6, 12, 2, 5);
    g.fillRect(16, 12, 2, 5);
    g.fillStyle(0x111111);
    g.fillRect(0, 6, 3, 3);
    g.generateTexture('gun-m240b', 38, 18);
    g.destroy();

    // RPG-7: distinct conical warhead nose, thin tube, rear venturi flare
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x3a3a3a);
    g.fillRect(4, 4, 24, 5);
    g.fillStyle(0x1a1a1a);
    g.fillRect(0, 3, 6, 7);
    g.fillStyle(0x556b2f);
    g.beginPath();
    g.moveTo(28, 2);
    g.lineTo(36, 6);
    g.lineTo(28, 11);
    g.closePath();
    g.fillPath();
    g.fillStyle(0x6b4423);
    g.fillRect(8, 9, 4, 6);
    g.generateTexture('gun-rpg7', 37, 15);
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

    // Heat only dissipates while not actively firing (a beat after the
    // trigger is released), so sustained fire net-builds toward overheat
    // instead of the gun cooling itself while still shooting. Overheat
    // locks firing for overheatCooldown ms once maxHeat is hit.
    if (this.overheated) {
      this.overheatTimer -= 1000 / 60;
      if (this.overheatTimer <= 0) {
        this.overheated = false;
        this.heat = 0;
      }
    } else if (this.heat > 0 && this.shootCooldown <= 0) {
      this.heat = Math.max(0, this.heat - 60 * (1 / 60));
    }

    if (this.reloading) {
      this.reloadTime -= 1000 / 60;
      if (this.reloadTime <= 0) {
        this.finishReload();
      }
    }
  }

  setWeapon(weaponKey) {
    const weapon = Player.WEAPONS[weaponKey];
    if (!weapon) return;

    this.weaponKey = weaponKey;
    this.reloading = false;
    this.heat = 0;
    this.overheated = false;

    if (weapon.magSize) {
      this.magSize = Phaser.Math.Between(weapon.magSize[0], weapon.magSize[1]);
      this.reserveMags = Phaser.Math.Between(weapon.maxMags[0], Math.min(weapon.maxMags[1], 10));
      this.magAmmo = this.magSize;
    } else {
      this.magSize = Infinity;
      this.magAmmo = Infinity;
      this.reserveMags = 0;
    }

    this.gunSprite.setTexture(weapon.texture);
    this.gunSprite.setDisplaySize(weapon.width, weapon.height);
  }

  reload() {
    if (this.magSize === Infinity) return;
    if (this.reloading || this.overheated) return;
    if (this.magAmmo >= this.magSize || this.reserveMags <= 0) return;

    this.reloading = true;
    this.reloadTime = 1200;
  }

  finishReload() {
    this.reloading = false;
    this.reserveMags--;
    this.magAmmo = this.magSize;
  }

  shoot() {
    if (this.shootCooldown <= 0 && this.hasAmmo() && !this.reloading && !this.overheated) {
      this.fireFromMuzzle(this.targetAngle);
      this.shootCooldown = this.shootDelay;
    }
  }

  shootTowards(x, y) {
    if (this.shootCooldown <= 0 && this.hasAmmo() && !this.reloading && !this.overheated) {
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
    return this.magAmmo > 0;
  }

  fireFromMuzzle(angle) {
    const weapon = Player.WEAPONS[this.weaponKey];
    const muzzleLength = 25;
    const x = this.sprite.x + Math.cos(angle) * muzzleLength;
    const y = this.sprite.y + Math.sin(angle) * muzzleLength;

    // Small baseline inaccuracy on automatic fire so sustained shooting isn't
    // laser-precise; faster-firing weapons kick a bit more than slow ones.
    const autoSpread = Phaser.Math.Clamp(0.2 - weapon.rapidFireDelay * 0.0012, 0.04, 0.2);

    if (weapon.isRocket) {
      new RocketProjectile(this.scene, x, y, angle);
    } else if (weapon.pellets > 1) {
      const spread = 0.18;
      for (let i = 0; i < weapon.pellets; i++) {
        const pelletAngle = angle + (Math.random() - 0.5) * spread;
        new Projectile(this.scene, x, y, pelletAngle);
      }
    } else {
      const fireAngle = angle + (Math.random() - 0.5) * autoSpread;
      new Projectile(this.scene, x, y, fireAngle);
    }

    playShoot(this.scene);

    if (this.magAmmo !== Infinity) {
      this.magAmmo--;
    }

    // Heat builds per shot for every weapon, including the unlimited-ammo
    // M4A1, so continuous fire at rapid rate overheats in roughly
    // secondsToOverheat seconds: faster-firing guns heat up sooner (floor
    // 6s), slow/heavy guns take longer (up to 20s). Weapons can override
    // this directly via overheatSeconds (e.g. the starting M4A1).
    const shotsPerSec = 1000 / weapon.rapidFireDelay;
    const secondsToOverheat = weapon.overheatSeconds ||
      Phaser.Math.Clamp(20 - (shotsPerSec - 1) * 0.4, 6, 20);
    const heatPerShot = this.maxHeat / (secondsToOverheat * shotsPerSec);
    this.heat = Math.min(this.maxHeat, this.heat + heatPerShot);
    if (this.heat >= this.maxHeat) {
      this.overheated = true;
      this.overheatTimer = this.overheatCooldown;
    }

    if (this.magAmmo !== Infinity && this.magAmmo <= 0) {
      if (this.reserveMags > 0) {
        this.reload();
      } else {
        this.setWeapon('m4a1');
      }
    }
  }

  takeDamage(amount) {
    this.health -= amount;
  }
}
