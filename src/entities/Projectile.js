import Phaser from 'phaser';

export default class Projectile {
  constructor(scene, x, y, angle) {
    this.scene = scene;
    this.speed = 500;

    Projectile.ensureTexture(scene);

    this.sprite = scene.physics.add.sprite(x, y, 'bulletTexture');
    this.sprite.setDisplaySize(14, 4);

    scene.projectiles.add(this.sprite);

    this.sprite.body.setVelocity(
      Math.cos(angle) * this.speed,
      Math.sin(angle) * this.speed
    );
    this.sprite.rotation = angle;

    // Motion trail particles
    if (!scene.textures.exists('bulletTrailParticle')) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffd76a);
      g.fillCircle(2, 2, 2);
      g.generateTexture('bulletTrailParticle', 4, 4);
      g.destroy();
    }

    this.trail = scene.add.particles(x, y, 'bulletTrailParticle', {
      speed: 0,
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 150,
      frequency: 10,
      follow: this.sprite
    });
    this.trail.setDepth(this.sprite.depth - 1);
  }

  static ensureTexture(scene) {
    if (scene.textures.exists('bulletTexture')) return;

    const w = 14;
    const h = 6;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    // brass casing base (rear)
    g.fillStyle(0xb5842a);
    g.fillRect(0, 1, 4, 4);

    // copper body
    g.fillStyle(0xd98c3c);
    g.fillRect(3, 1, 7, 4);

    // bright tip
    g.fillStyle(0xfff2b0);
    g.fillRect(9, 1, 3, 4);

    // highlight line
    g.fillStyle(0xffe27a, 0.8);
    g.fillRect(3, 1, 8, 1);

    g.generateTexture('bulletTexture', w, h);
    g.destroy();
  }

  destroy() {
    if (this.trail) this.trail.destroy();
    this.sprite.destroy();
  }
}
