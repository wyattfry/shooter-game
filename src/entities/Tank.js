import Phaser from 'phaser';
import { playShoot, playExplosion } from '../sound/SoundManager.js';

export default class Tank {
  constructor(scene, x, y) {
    this.scene = scene;
    this.speed = 180;
    this.turnSpeed = 2.2;
    this.health = 15;
    this.maxHealth = 15;
    this.shootCooldown = 0;
    this.shootDelay = 500;
    this.mgShootCooldown = 0;
    this.mgShootDelay = 50;
    this.driving = false;
    this.mode = 'tank'; // 'tank' | 'mech'
    this.mechSpeed = 140;

    // Cannon: small magazine (shells are heavy), several reloads
    this.shellMagSize = Phaser.Math.Between(3, 6);
    this.shellAmmo = this.shellMagSize;
    this.shellReserve = Phaser.Math.Between(2, 6);
    this.shellReloading = false;
    this.shellReloadTime = 0;

    // Coax MG: belt-fed, larger magazine, fewer reloads
    this.mgMagSize = Phaser.Math.Between(80, 150);
    this.mgAmmo = this.mgMagSize;
    this.mgReserve = Phaser.Math.Between(1, 4);
    this.mgReloading = false;
    this.mgReloadTime = 0;

    Tank.ensureTextures(scene);

    this.sprite = scene.physics.add.sprite(x, y, 'tankBody');
    this.sprite.setDisplaySize(56, 40);
    this.sprite.body.setSize(50, 36);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.tankInstance = this;

    this.turretSprite = scene.add.image(x, y, 'tankTurret');
    this.turretSprite.setDisplaySize(48, 20);
    this.turretSprite.setOrigin(10 / 48, 8 / 20);

    // Prompt shown when driving, telling the player they can transform
    this.transformPromptText = scene.add.text(x, y - 55, 'Press Q to transform', {
      fontSize: '12px',
      fill: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 4, y: 2 }
    });
    this.transformPromptText.setOrigin(0.5, 0.5);
    this.transformPromptText.setVisible(false);

    scene.tanks.add(this.sprite);

    // Prompt shown when the player is near an idle tank
    this.promptText = scene.add.text(x, y - 40, 'Press E to drive', {
      fontSize: '13px',
      fill: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 4, y: 2 }
    });
    this.promptText.setOrigin(0.5, 0.5);
    this.promptText.setVisible(false);
  }

  static ensureTextures(scene) {
    if (scene.textures.exists('tankBody')) return;

    const bodyColor = 0x3c4a2b;
    const bodyLight = 0x4d5c38;
    const bodyDark = 0x2a331e;
    const bodyDarker = 0x1c2314;
    const track = 0x1a1a1a;
    const trackLight = 0x2e2e2e;
    const metal = 0x555555;
    const glass = 0xbfe6ff;

    // --- Hull (56x40) ---
    let g = scene.make.graphics({ x: 0, y: 0, add: false });

    // Track units (top/bottom) with individual link segments and road wheels
    g.fillStyle(track);
    g.fillRect(0, 0, 56, 7);
    g.fillRect(0, 33, 56, 7);
    g.fillStyle(trackLight);
    for (let i = 0; i < 14; i++) {
      g.fillRect(i * 4, 0, 2, 7);
      g.fillRect(i * 4, 33, 2, 7);
    }
    g.fillStyle(0x0d0d0d);
    for (let i = 0; i < 7; i++) {
      g.fillCircle(4 + i * 8, 3.5, 2.6);
      g.fillCircle(4 + i * 8, 36.5, 2.6);
    }
    g.fillStyle(0x333333);
    for (let i = 0; i < 7; i++) {
      g.fillCircle(4 + i * 8, 3.5, 1.1);
      g.fillCircle(4 + i * 8, 36.5, 1.1);
    }

    // Hull body with layered shading for a beveled/armored look
    g.fillStyle(bodyDarker);
    g.fillRect(3, 7, 50, 26);
    g.fillStyle(bodyDark);
    g.fillRect(5, 8, 46, 24);
    g.fillStyle(bodyColor);
    g.fillRect(6, 9, 44, 20);
    g.fillStyle(bodyLight);
    g.fillRect(6, 9, 44, 3);

    // Front glacis plate (angled armor look, right side = front)
    g.fillStyle(bodyDark);
    g.fillTriangle(50, 9, 56, 16, 50, 23);
    g.fillStyle(bodyColor);
    g.fillTriangle(50, 11, 54, 16, 50, 21);

    // Rivets along the hull edge
    g.fillStyle(bodyDarker);
    for (let i = 0; i < 6; i++) {
      g.fillCircle(9 + i * 7, 11, 0.8);
      g.fillCircle(9 + i * 7, 26, 0.8);
    }

    // Engine deck grille (rear)
    g.fillStyle(bodyDarker);
    g.fillRect(7, 12, 10, 12);
    g.fillStyle(0x161c0f);
    for (let i = 0; i < 4; i++) {
      g.fillRect(8 + i * 2.4, 13, 1.4, 10);
    }

    // Driver's hatch (front-top) + vision slit
    g.fillStyle(bodyDark);
    g.fillCircle(40, 13, 4.5);
    g.fillStyle(bodyColor);
    g.fillCircle(40, 13, 3.4);
    g.fillStyle(0x1a1a1a);
    g.fillRect(37, 12.3, 6, 1.4);

    // Headlight
    g.fillStyle(metal);
    g.fillCircle(52, 20, 2.2);
    g.fillStyle(0xfff2b0);
    g.fillCircle(52, 20, 1.2);

    // Tow hook (front)
    g.fillStyle(0x1a1a1a);
    g.fillRect(53, 24, 3, 2);

    g.generateTexture('tankBody', 56, 40);
    g.destroy();

    // --- Turret (48x20), origin math elsewhere assumes pivot near x=10,y=8-ish ---
    g = scene.make.graphics({ x: 0, y: 0, add: false });

    // Turret ring / base shadow
    g.fillStyle(bodyDarker);
    g.fillCircle(10, 8, 9.5);

    // Turret body (rounded, layered)
    g.fillStyle(bodyDark);
    g.fillCircle(10, 8, 8.5);
    g.fillStyle(bodyColor);
    g.fillCircle(10, 8, 7);
    g.fillStyle(bodyLight);
    g.fillCircle(8.5, 6.5, 2.4);

    // Hatch + rivet ring on the turret top
    g.fillStyle(bodyDarker);
    g.fillCircle(10, 8, 3.2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillCircle(10 + Math.cos(a) * 6.4, 8 + Math.sin(a) * 6.4, 0.7);
    }

    // Antenna mount
    g.fillStyle(0x1a1a1a);
    g.fillRect(4, 4, 1.6, 1.6);

    // Mantlet (where the main gun meets the turret)
    g.fillStyle(bodyDarker);
    g.fillRect(14, 4.5, 8, 7);
    g.fillStyle(bodyDark);
    g.fillRect(14, 5, 8, 6);

    // Main cannon barrel (thick, with a muzzle brake)
    g.fillStyle(0x2a2a2a);
    g.fillRect(18, 5.5, 26, 5);
    g.fillStyle(0x1a1a1a);
    g.fillRect(18, 5.5, 26, 1.4);
    g.fillStyle(0x0d0d0d);
    g.fillRect(40, 4.8, 4, 6.4);
    g.fillStyle(0x333333);
    g.fillRect(41, 4.8, 1, 6.4);
    g.fillRect(43, 4.8, 1, 6.4);

    // Coaxial machine gun barrel (thin, mounted just below the main gun)
    g.fillStyle(0x1a1a1a);
    g.fillRect(16, 11.5, 20, 2);
    g.fillStyle(0x000000);
    g.fillRect(35, 11.8, 3, 1.4);

    g.generateTexture('tankTurret', 48, 20);
    g.destroy();

    Tank.ensureMechTexture(scene);
  }

  static ensureMechTexture(scene) {
    if (scene.textures.exists('mechWalk')) {
      if (!scene.anims.exists('mech-walk')) {
        scene.anims.create({
          key: 'mech-walk',
          frames: scene.anims.generateFrameNumbers('mechWalk', { start: 0, end: 3 }),
          frameRate: 8,
          repeat: -1
        });
      }
      return;
    }

    const frameW = 64;
    const frameH = 44;
    const frames = 4;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    // Stride offsets per frame: how far the rear/front leg extend from their
    // resting hip position, cycling through a walk (both planted, rear back
    // + front forward, both planted, rear forward + front back).
    const strides = [0, 6, 0, -6];

    for (let i = 0; i < frames; i++) {
      const ox = i * frameW;
      const stride = strides[i];
      Tank.drawMechFrame(g, ox, stride);
    }

    g.generateTexture('mechWalk', frameW * frames, frameH);
    g.destroy();

    scene.textures.get('mechWalk').setFilter(Phaser.Textures.FilterMode.NEAREST);

    for (let i = 0; i < frames; i++) {
      scene.textures.get('mechWalk').add(i, 0, i * frameW, 0, frameW, frameH);
    }

    scene.anims.create({
      key: 'mech-walk',
      frames: scene.anims.generateFrameNumbers('mechWalk', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1
    });
  }

  static drawMechFrame(g, ox, stride) {
    const bodyColor = 0x3c4a2b;
    const bodyLight = 0x4d5c38;
    const bodyDark = 0x2a331e;
    const bodyDarker = 0x1c2314;
    const bodyDarkest = 0x121a0c;
    const metal = 0x666666;
    const metalDark = 0x3a3a3a;
    const metalLight = 0x8a8a8a;
    const glow = 0x66ffcc;
    const hydraulic = 0x2f2f2f;

    // Rear leg swings opposite the front leg
    const rearX = ox - stride;
    const frontX = ox + stride;

    // Ground shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(ox + 32, 41, 46, 6);

    // Rear leg (trailing, slightly bent back)
    g.fillStyle(bodyDarkest);
    g.fillRect(rearX + 16, 24, 8, 10);
    g.fillRect(rearX + 12, 32, 8, 8);
    g.fillStyle(bodyDark);
    g.fillRect(rearX + 17, 25, 6, 8);
    g.fillRect(rearX + 13, 33, 6, 6);
    // Rear hydraulic piston
    g.fillStyle(hydraulic);
    g.fillRect(rearX + 22, 27, 2, 8);
    g.fillStyle(metalLight);
    g.fillRect(rearX + 22, 27, 2, 2);
    // Rear knee joint
    g.fillStyle(metal);
    g.fillCircle(rearX + 20, 31, 2.4);
    // Rear foot
    g.fillStyle(0x0a0f07);
    g.fillRect(rearX + 8, 39, 14, 4);
    g.fillStyle(metalDark);
    g.fillRect(rearX + 8, 39, 14, 1.4);

    // Front leg (leading, planted forward)
    g.fillStyle(bodyDark);
    g.fillRect(frontX + 38, 23, 9, 11);
    g.fillRect(frontX + 42, 31, 8, 9);
    g.fillStyle(bodyColor);
    g.fillRect(frontX + 39, 24, 7, 9);
    g.fillRect(frontX + 43, 32, 6, 7);
    // Front hydraulic piston
    g.fillStyle(hydraulic);
    g.fillRect(frontX + 36, 26, 2, 8);
    g.fillStyle(metalLight);
    g.fillRect(frontX + 36, 26, 2, 2);
    // Front knee joint
    g.fillStyle(metal);
    g.fillCircle(frontX + 42, 30, 2.8);
    g.fillStyle(metalLight);
    g.fillCircle(frontX + 41.3, 29.3, 1);
    // Front foot
    g.fillStyle(0x141a0e);
    g.fillRect(frontX + 40, 39, 16, 5);
    g.fillStyle(metalDark);
    g.fillRect(frontX + 40, 39, 16, 1.6);

    // Hip/waist assembly (fixed, doesn't move with stride)
    g.fillStyle(bodyDarker);
    g.fillRect(ox + 18, 19, 30, 8);
    g.fillStyle(bodyDark);
    g.fillRect(ox + 19, 20, 28, 5);

    // Torso, leaning slightly forward toward the front leg
    g.fillStyle(bodyDarker);
    g.fillRect(ox + 14, 4, 38, 18);
    g.fillStyle(bodyDark);
    g.fillRect(ox + 16, 5, 34, 15);
    g.fillStyle(bodyColor);
    g.fillRect(ox + 18, 6, 30, 11);
    g.fillStyle(bodyLight);
    g.fillRect(ox + 18, 6, 30, 3);

    // Chest armor seam + rivets
    g.fillStyle(bodyDarkest);
    for (let i = 0; i < 4; i++) {
      g.fillCircle(ox + 22 + i * 8, 9, 0.9);
    }

    // Rear shoulder pauldron (smaller, behind)
    g.fillStyle(bodyDarkest);
    g.fillCircle(ox + 16, 8, 5.5);
    g.fillStyle(bodyDark);
    g.fillCircle(ox + 16, 8, 3.8);

    // Front shoulder pauldron + weapon hardpoint (larger, foreground)
    g.fillStyle(bodyDarkest);
    g.fillCircle(ox + 48, 7, 7);
    g.fillStyle(bodyColor);
    g.fillCircle(ox + 48, 7, 5);
    g.fillStyle(metalDark);
    g.fillRect(ox + 50, 3, 5, 4);

    // Cockpit canopy (angled, facing forward/right, glowing)
    g.fillStyle(0x0d1a1a);
    g.fillTriangle(ox + 30, 6, ox + 46, 9, ox + 30, 16);
    g.fillStyle(glow, 0.85);
    g.fillTriangle(ox + 31, 7.5, ox + 44, 9.5, ox + 31, 14.5);
    g.fillStyle(0xffffff, 0.45);
    g.fillTriangle(ox + 31, 7.5, ox + 37, 8.5, ox + 31, 10.5);

    // Head/sensor unit above the torso
    g.fillStyle(bodyDarkest);
    g.fillRect(ox + 26, 0, 12, 5);
    g.fillStyle(metal);
    g.fillRect(ox + 27, 1, 4, 3);
    g.fillStyle(0xff3b30);
    g.fillCircle(ox + 35, 2.5, 1.3);

    // Exhaust/vent stacks on the back
    g.fillStyle(bodyDarkest);
    g.fillRect(ox + 12, 7, 4, 10);
    g.fillStyle(0x0a0a0a);
    g.fillRect(ox + 12, 8, 4, 1.5);
    g.fillRect(ox + 12, 11, 4, 1.5);
    g.fillRect(ox + 12, 14, 4, 1.5);
  }

  update(playerSprite, keys) {
    // Proximity prompt when not driving
    if (!this.driving) {
      const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerSprite.x, playerSprite.y);
      const near = dist < 60;
      this.promptText.setVisible(near);
      this.promptText.setPosition(this.sprite.x, this.sprite.y - 40);
      return near;
    }

    this.promptText.setVisible(false);
    this.transformPromptText.setVisible(true);
    this.transformPromptText.setPosition(this.sprite.x, this.sprite.y - 55);
    this.turretSprite.setPosition(this.sprite.x, this.sprite.y);

    const body = this.sprite.body;

    if (this.mode === 'tank') {
      // Tank controls: forward/back + rotate, tank-style, hull rotates with turning
      let speed = 0;
      if (keys.up) speed = this.speed;
      else if (keys.down) speed = -this.speed * 0.6;

      let angularVel = 0;
      if (keys.left) angularVel = -this.turnSpeed;
      if (keys.right) angularVel = this.turnSpeed;

      this.sprite.rotation += angularVel * (1 / 60);
      body.setVelocity(
        Math.cos(this.sprite.rotation) * speed,
        Math.sin(this.sprite.rotation) * speed
      );
    } else {
      // Mech controls: A/D turn in place, W/S walk forward/back along facing.
      // Sprite is drawn side-on (facing right), same convention as the tank hull.
      let speed = 0;
      if (keys.up) speed = this.mechSpeed;
      else if (keys.down) speed = -this.mechSpeed * 0.6;

      let angularVel = 0;
      if (keys.left) angularVel = -this.turnSpeed;
      if (keys.right) angularVel = this.turnSpeed;

      this.sprite.rotation += angularVel * (1 / 60);
      body.setVelocity(
        Math.cos(this.sprite.rotation) * speed,
        Math.sin(this.sprite.rotation) * speed
      );

      if (speed !== 0 || angularVel !== 0) {
        if (!this.sprite.anims.isPlaying) this.sprite.play('mech-walk');
      } else {
        this.sprite.anims.stop();
        this.sprite.setTexture('mechWalk', 0);
      }
    }

    // Turret aims at the mouse independently of hull rotation
    const angle = Phaser.Math.Angle.Between(
      this.sprite.x,
      this.sprite.y,
      this.scene.input.mousePointer.worldX,
      this.scene.input.mousePointer.worldY
    );
    this.turretSprite.setRotation(angle);

    if (this.shootCooldown > 0) this.shootCooldown -= 1000 / 60;
    if (this.mgShootCooldown > 0) this.mgShootCooldown -= 1000 / 60;

    if (this.shellReloading) {
      this.shellReloadTime -= 1000 / 60;
      if (this.shellReloadTime <= 0) {
        this.shellReloading = false;
        this.shellReserve--;
        this.shellAmmo = this.shellMagSize;
      }
    }
    if (this.mgReloading) {
      this.mgReloadTime -= 1000 / 60;
      if (this.mgReloadTime <= 0) {
        this.mgReloading = false;
        this.mgReserve--;
        this.mgAmmo = this.mgMagSize;
      }
    }

    return true;
  }

  reload() {
    if (!this.shellReloading && this.shellAmmo < this.shellMagSize && this.shellReserve > 0) {
      this.shellReloading = true;
      this.shellReloadTime = 2000;
    }
    if (!this.mgReloading && this.mgAmmo < this.mgMagSize && this.mgReserve > 0) {
      this.mgReloading = true;
      this.mgReloadTime = 1500;
    }
  }

  transform() {
    this.mode = this.mode === 'tank' ? 'mech' : 'tank';
    if (this.mode === 'tank') {
      this.sprite.anims.stop();
      this.sprite.setTexture('tankBody');
    } else {
      this.sprite.setTexture('mechWalk', 0);
    }
    this.sprite.setDisplaySize(this.mode === 'tank' ? 56 : 64, this.mode === 'tank' ? 40 : 44);

    if (this.mode === 'tank') {
      this.sprite.body.setSize(50, 36);
    } else {
      this.sprite.body.setSize(56, 38);
    }
  }

  shoot() {
    if (this.shootCooldown > 0 || this.shellReloading || this.shellAmmo <= 0) return;
    this.shootCooldown = this.shootDelay;
    this.shellAmmo--;

    if (this.shellAmmo <= 0) this.reload();

    if (!this.scene.textures.exists('tankShellTexture')) {
      const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x888888);
      g.fillRect(0, 0, 10, 6);
      g.fillStyle(0xffcc00);
      g.fillRect(0, 1, 3, 4);
      g.generateTexture('tankShellTexture', 10, 6);
      g.destroy();
    }

    const angle = this.turretSprite.rotation;
    const muzzleLength = 30;
    const shell = this.scene.physics.add.sprite(
      this.turretSprite.x + Math.cos(angle) * muzzleLength,
      this.turretSprite.y + Math.sin(angle) * muzzleLength,
      'tankShellTexture'
    );
    shell.rotation = angle;
    shell.tankShellInstance = { splashRadius: 100, splashDamage: 4 };

    this.scene.projectiles.add(shell);

    shell.body.setVelocity(Math.cos(angle) * 500, Math.sin(angle) * 500);
    playExplosion(this.scene, { volume: 0.25 });
  }

  shootMachineGun() {
    if (this.mgShootCooldown > 0 || this.mgReloading || this.mgAmmo <= 0) return;
    this.mgShootCooldown = this.mgShootDelay;
    this.mgAmmo--;

    if (this.mgAmmo <= 0) this.reload();

    if (!this.scene.textures.exists('tankMgBulletTexture')) {
      const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffe066);
      g.fillRect(0, 0, 6, 3);
      g.generateTexture('tankMgBulletTexture', 6, 3);
      g.destroy();
    }

    const angle = this.turretSprite.rotation;
    const muzzleLength = 30;
    const mgOffset = 5.5; // coax MG sits below the main gun in the turret's local frame
    const perpAngle = angle + Math.PI / 2;
    const spread = Phaser.Math.FloatBetween(-0.03, 0.03);
    const fireAngle = angle + spread;
    const bullet = this.scene.physics.add.sprite(
      this.turretSprite.x + Math.cos(angle) * muzzleLength + Math.cos(perpAngle) * mgOffset,
      this.turretSprite.y + Math.sin(angle) * muzzleLength + Math.sin(perpAngle) * mgOffset,
      'tankMgBulletTexture'
    );
    bullet.rotation = fireAngle;

    this.scene.turretBullets.add(bullet);

    bullet.body.setVelocity(Math.cos(fireAngle) * 550, Math.sin(fireAngle) * 550);
    playShoot(this.scene, { volume: 0.2 });

    this.scene.time.delayedCall(1500, () => {
      if (bullet.active) bullet.destroy();
    });
  }

  enter() {
    this.driving = true;
  }

  exit() {
    this.driving = false;
    this.transformPromptText.setVisible(false);
  }

  takeDamage(amount) {
    this.health -= amount;
  }

  destroy() {
    this.sprite.destroy();
    this.turretSprite.destroy();
    this.promptText.destroy();
    this.transformPromptText.destroy();
  }
}
