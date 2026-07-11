import Phaser from 'phaser';

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

    Tank.ensureTextures(scene);

    this.sprite = scene.physics.add.sprite(x, y, 'tankBody');
    this.sprite.setDisplaySize(56, 40);
    this.sprite.body.setSize(50, 36);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.tankInstance = this;

    this.turretSprite = scene.add.image(x, y, 'tankTurret');
    this.turretSprite.setDisplaySize(48, 20);
    this.turretSprite.setOrigin(10 / 48, 8 / 20);

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
    this.turretSprite.setPosition(this.sprite.x, this.sprite.y);

    // Driving controls: forward/back + rotate, tank-style
    const body = this.sprite.body;
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

    return true;
  }

  shoot() {
    if (this.shootCooldown > 0) return;
    this.shootCooldown = this.shootDelay;

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
  }

  shootMachineGun() {
    if (this.mgShootCooldown > 0) return;
    this.mgShootCooldown = this.mgShootDelay;

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

    this.scene.time.delayedCall(1500, () => {
      if (bullet.active) bullet.destroy();
    });
  }

  enter() {
    this.driving = true;
  }

  exit() {
    this.driving = false;
  }

  takeDamage(amount) {
    this.health -= amount;
  }

  destroy() {
    this.sprite.destroy();
    this.turretSprite.destroy();
    this.promptText.destroy();
  }
}
