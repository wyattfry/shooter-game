import Phaser from 'phaser';

export default class Turret {
  constructor(scene, x, y) {
    this.scene = scene;
    this.range = 400;
    this.fireDelay = 150;
    this.shootCooldown = 0;
    this.health = 5;

    Turret.ensureTextures(scene);

    this.baseSprite = scene.add.image(x, y, 'turretBase');
    this.gunSprite = scene.add.image(x, y, 'turretGun');
    this.gunSprite.setOrigin(8 / 44, 0.5);

    this.sprite = scene.physics.add.staticSprite(x, y, 'turretBase');
    this.sprite.setVisible(false);
    this.sprite.body.setSize(28, 28);
    this.sprite.refreshBody();
    this.sprite.turretInstance = this;

    scene.turrets.add(this.sprite);
  }

  static ensureTextures(scene) {
    if (scene.textures.exists('turretBase')) return;

    const cx = 24;
    const cy = 24;

    // Base: layered armor plating, hazard ring, riveted mounting collar,
    // cable conduits, and a raised sensor-topped center hub.
    let g = scene.make.graphics({ x: 0, y: 0, add: false });

    // Ground shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(cx, cy + 2, 21, 10);

    // Outer armor skirt (drop shadow ring + main plate)
    g.fillStyle(0x0a1226);
    g.fillCircle(cx, cy, 22.5);
    g.fillStyle(0x1c3a63);
    g.fillCircle(cx, cy, 21);

    // Segmented outer armor plates (8 panels with visible seams)
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2 + 0.03;
      const a1 = a0 + Math.PI / 4 - 0.06;
      g.fillStyle(i % 2 === 0 ? 0x2a5aa1 : 0x244f8f);
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, 21, a0, a1, false);
      g.closePath();
      g.fillPath();
    }

    // Hazard stripe ring
    g.fillStyle(0x142442);
    g.fillCircle(cx, cy, 16.5);
    g.fillStyle(0xd4a017);
    for (let i = 0; i < 10; i++) {
      const a0 = (i / 10) * Math.PI * 2;
      const a1 = a0 + Math.PI / 20;
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, 16.5, a0, a1, false);
      g.closePath();
      g.fillPath();
    }
    g.fillStyle(0x14213d);
    g.fillCircle(cx, cy, 14.5);

    // Rivets around the armor seam
    g.fillStyle(0x0a1730);
    const seamBoltRadius = 19.5;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      g.fillCircle(cx + Math.cos(a) * seamBoltRadius, cy + Math.sin(a) * seamBoltRadius, 0.9);
    }

    // Rotating collar ring (slightly lighter, sits under the hub)
    g.fillStyle(0x24365c);
    g.fillCircle(cx, cy, 13);
    g.fillStyle(0x0d1a30);
    const collarBoltRadius = 11.5;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.fillCircle(cx + Math.cos(a) * collarBoltRadius, cy + Math.sin(a) * collarBoltRadius, 1);
    }

    // Cable conduits running from the skirt toward the hub
    g.fillStyle(0x0d1a30);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const x1 = cx + Math.cos(a) * 18;
      const y1 = cy + Math.sin(a) * 18;
      const x2 = cx + Math.cos(a) * 12;
      const y2 = cy + Math.sin(a) * 12;
      g.lineStyle(1.6, 0x0d1a30, 1);
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.strokePath();
    }

    // Raised center hub with highlight/shadow shading for a domed look
    g.fillStyle(0x3a6fc4);
    g.fillCircle(cx, cy, 9.5);
    g.fillStyle(0x1a3f7a);
    g.fillCircle(cx, cy, 7);
    g.fillStyle(0x5a8fe0);
    g.fillCircle(cx - 2.2, cy - 2.2, 2.6);
    g.fillStyle(0x0d1a30);
    g.fillCircle(cx, cy, 3);

    // Small sensor/status light on the hub rim
    g.fillStyle(0xff3b30);
    g.fillCircle(cx + 7, cy - 6, 1.4);
    g.fillStyle(0xff9d8f);
    g.fillCircle(cx + 6.7, cy - 6.3, 0.5);

    g.generateTexture('turretBase', 48, 48);
    g.destroy();

    // Gun: riveted mount collar, ammo box, tapered heat-shielded barrel
    // shroud with slatted vents, twin ribbed barrels, and muzzle brakes.
    g = scene.make.graphics({ x: 0, y: 0, add: false });

    // Mount collar (rear, sits over the hub) with shading and bolts
    g.fillStyle(0x1a1a1a);
    g.fillCircle(8, 9, 8);
    g.fillStyle(0x333333);
    g.fillCircle(8, 9, 6.5);
    g.fillStyle(0x4a4a4a);
    g.fillCircle(6.5, 7.5, 2.2);
    g.fillStyle(0x0a0a0a);
    const gunBoltRadius = 6.8;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.fillCircle(8 + Math.cos(a) * gunBoltRadius, 9 + Math.sin(a) * gunBoltRadius, 0.8);
    }

    // Ammo box hanging beneath the receiver
    g.fillStyle(0x2a2a1a);
    g.fillRect(6, 13, 8, 6);
    g.fillStyle(0x3a3a24);
    g.fillRect(6, 13, 8, 1.5);
    g.fillStyle(0x1a1a10);
    g.fillRect(9, 9, 2, 5);

    // Barrel shroud (tapered body) with top/bottom edge shading
    g.fillStyle(0x2e2e2e);
    g.fillRect(6, 4, 26, 11);
    g.fillStyle(0x4a4a4a);
    g.fillRect(6, 4, 26, 2);
    g.fillStyle(0x151515);
    g.fillRect(6, 13, 26, 2);
    // Taper toward the muzzle end (slightly narrower silhouette)
    g.fillStyle(0x0f0f0f);
    g.fillTriangle(30, 4, 32, 5.5, 30, 6);
    g.fillTriangle(30, 15, 32, 13.5, 30, 13);

    // Slatted cooling vents
    g.fillStyle(0x0a0a0a);
    for (let i = 0; i < 5; i++) {
      g.fillRect(10 + i * 3.5, 5, 1.6, 8);
    }

    // Side rail / scope mount detail
    g.fillStyle(0x1a1a1a);
    g.fillRect(10, 2, 12, 2);
    g.fillStyle(0x333333);
    g.fillRect(14, 0.5, 5, 2);

    // Twin ribbed barrels extending past the shroud
    g.fillStyle(0x111111);
    g.fillRect(30, 4.6, 10, 2.6);
    g.fillRect(30, 8.8, 10, 2.6);
    g.fillStyle(0x000000);
    for (let i = 0; i < 4; i++) {
      g.fillRect(32 + i * 2.2, 4.6, 0.7, 2.6);
      g.fillRect(32 + i * 2.2, 8.8, 0.7, 2.6);
    }

    // Muzzle brakes
    g.fillStyle(0x000000);
    g.fillRect(39, 4.2, 3, 3.4);
    g.fillRect(39, 8.4, 3, 3.4);
    g.fillStyle(0x333333);
    g.fillRect(39, 4.2, 1, 3.4);
    g.fillRect(39, 8.4, 1, 3.4);

    g.generateTexture('turretGun', 44, 18);
    g.destroy();
  }

  findNearestEnemy() {
    let nearest = null;
    let nearestDist = this.range;

    this.scene.enemies.children.entries.forEach(enemySprite => {
      const dist = Phaser.Math.Distance.Between(
        this.baseSprite.x,
        this.baseSprite.y,
        enemySprite.x,
        enemySprite.y
      );
      if (dist < nearestDist) {
        nearest = enemySprite;
        nearestDist = dist;
      }
    });

    return nearest;
  }

  update() {
    const target = this.findNearestEnemy();

    if (target) {
      const angle = Phaser.Math.Angle.Between(
        this.baseSprite.x,
        this.baseSprite.y,
        target.x,
        target.y
      );
      this.gunSprite.setRotation(angle);

      this.shootCooldown -= 1000 / 60;
      if (this.shootCooldown <= 0) {
        this.shoot(angle);
        this.shootCooldown = this.fireDelay;
      }
    }
  }

  shoot(angle) {
    if (!this.scene.textures.exists('turretBulletTexture')) {
      const g = this.scene.make.graphics({ x: 0, y: 0, add: false });

      // Same brass-casing/copper-body/bright-tip look as the player's bullets
      g.fillStyle(0xb5842a);
      g.fillRect(0, 1, 4, 4);

      g.fillStyle(0xd98c3c);
      g.fillRect(3, 1, 7, 4);

      g.fillStyle(0xfff2b0);
      g.fillRect(9, 1, 3, 4);

      g.fillStyle(0xffe27a, 0.8);
      g.fillRect(3, 1, 8, 1);

      g.generateTexture('turretBulletTexture', 14, 6);
      g.destroy();
    }

    const speed = 350;
    const bullet = this.scene.physics.add.sprite(
      this.baseSprite.x + Math.cos(angle) * 16,
      this.baseSprite.y + Math.sin(angle) * 16,
      'turretBulletTexture'
    );
    bullet.setDisplaySize(14, 4);
    bullet.rotation = angle;

    this.scene.turretBullets.add(bullet);

    bullet.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    this.scene.time.delayedCall(3000, () => {
      if (bullet.active) bullet.destroy();
    });
  }

  destroy() {
    this.baseSprite.destroy();
    this.gunSprite.destroy();
    this.sprite.destroy();
  }
}
