import Phaser from 'phaser';

export default class RocketProjectile {
  constructor(scene, x, y, angle) {
    this.scene = scene;
    this.speed = 350;
    this.splashRadius = 90;
    this.splashDamage = 3;

    RocketProjectile.ensureTexture(scene);

    this.sprite = scene.physics.add.sprite(x, y, 'rocketTexture');
    this.sprite.setDisplaySize(18, 8);
    this.sprite.rotation = angle;

    scene.projectiles.add(this.sprite);
    this.sprite.rocketInstance = this;

    this.sprite.body.setVelocity(
      Math.cos(angle) * this.speed,
      Math.sin(angle) * this.speed
    );

    // Homing: turns toward the nearest enemy each frame, up to turnRate
    // radians/sec, within homingRange. Locks onto whichever target is
    // nearest at the moment it's found and stays on it while in range.
    this.turnRate = 3.2;
    this.homingRange = 500;
    this.target = null;

    // Smoke trail
    if (!scene.textures.exists('smokeParticle')) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xaaaaaa);
      g.fillCircle(3, 3, 3);
      g.generateTexture('smokeParticle', 6, 6);
      g.destroy();
    }
    this.trail = scene.add.particles(x, y, 'smokeParticle', {
      speed: 10,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 300,
      frequency: 20,
      follow: this.sprite
    });
  }

  update(delta, enemies) {
    if (!this.sprite.active) return;

    if (!this.target || !this.target.active) {
      this.target = this.findNearestEnemy(enemies);
    }

    if (!this.target || !this.target.active) return;

    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      this.target.x, this.target.y
    );
    if (dist > this.homingRange) {
      this.target = null;
      return;
    }

    const body = this.sprite.body;
    const currentAngle = Math.atan2(body.velocity.y, body.velocity.x);
    const desiredAngle = Phaser.Math.Angle.Between(
      this.sprite.x, this.sprite.y,
      this.target.x, this.target.y
    );

    const maxTurn = this.turnRate * (delta / 1000);
    const newAngle = Phaser.Math.Angle.RotateTo(currentAngle, desiredAngle, maxTurn);

    body.setVelocity(
      Math.cos(newAngle) * this.speed,
      Math.sin(newAngle) * this.speed
    );
    this.sprite.rotation = newAngle;
  }

  findNearestEnemy(enemies) {
    let nearest = null;
    let nearestDist = this.homingRange;

    enemies.children.entries.forEach(enemySprite => {
      if (!enemySprite.active) return;
      const dist = Phaser.Math.Distance.Between(
        this.sprite.x, this.sprite.y,
        enemySprite.x, enemySprite.y
      );
      if (dist < nearestDist) {
        nearest = enemySprite;
        nearestDist = dist;
      }
    });

    return nearest;
  }

  static ensureTexture(scene) {
    if (scene.textures.exists('rocketTexture')) return;

    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x555555);
    g.fillRect(0, 2, 10, 4);
    g.fillStyle(0xcc3333);
    g.fillRect(9, 1, 5, 6);
    g.fillStyle(0xffaa00);
    g.fillRect(0, 3, 3, 2);
    g.generateTexture('rocketTexture', 14, 8);
    g.destroy();
  }

  explode() {
    const x = this.sprite.x;
    const y = this.sprite.y;

    this.scene.createExplosion(x, y);

    // Big secondary blast ring for visual weight
    const emitter = this.scene.add.particles(x, y, 'explosionParticle', {
      speed: { min: 150, max: 300 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      lifespan: 500,
      emitting: false
    });
    emitter.explode(20);
    this.scene.time.delayedCall(600, () => emitter.destroy());

    // Splash damage to all enemies in radius
    this.scene.enemies.children.entries.slice().forEach(enemySprite => {
      const dist = Phaser.Math.Distance.Between(x, y, enemySprite.x, enemySprite.y);
      if (dist <= this.splashRadius && enemySprite.enemyInstance) {
        const enemy = enemySprite.enemyInstance;
        enemy.takeDamage(this.splashDamage);
        if (enemy.health <= 0) {
          this.scene.killEnemy(enemy, enemySprite);
        }
      }
    });

    this.destroy();
  }

  destroy() {
    if (this.trail) this.trail.destroy();
    this.sprite.destroy();
  }
}
