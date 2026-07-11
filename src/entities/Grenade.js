import Phaser from 'phaser';

export default class Grenade {
  constructor(scene, x, y, targetX, targetY) {
    this.scene = scene;
    this.splashRadius = 100;
    this.splashDamage = 4;
    this.fuseTime = 1200;

    Grenade.ensureTexture(scene);

    this.sprite = scene.physics.add.sprite(x, y, 'grenadeTexture');
    this.sprite.setDisplaySize(10, 10);
    this.sprite.grenadeInstance = this;

    const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);

    // Arcade drag decelerates the grenade linearly (v -= drag * dt). If the
    // grenade decelerates to a stop before the fuse ends, it travels
    // v^2 / (2*drag); otherwise (still moving when the fuse ends) it travels
    // v*t - 0.5*drag*t^2. Solve the right regime so the grenade lands
    // exactly on the target instead of consistently landing short.
    const drag = 300;
    const maxThrowSpeed = 650;
    const flightSeconds = this.fuseTime / 1000;
    const maxDist = Phaser.Math.Distance.Between(x, y, targetX, targetY);
    const maxRange = maxThrowSpeed * flightSeconds - 0.5 * drag * flightSeconds * flightSeconds;
    const dist = Math.min(maxDist, maxRange);

    const stopSpeed = Math.sqrt(2 * drag * dist);
    const throwSpeed = stopSpeed / drag <= flightSeconds
      ? stopSpeed
      : (dist + 0.5 * drag * flightSeconds * flightSeconds) / flightSeconds;

    this.sprite.body.setVelocity(
      Math.cos(angle) * throwSpeed,
      Math.sin(angle) * throwSpeed
    );
    this.sprite.body.setDrag(drag, drag);
    this.sprite.body.setBounce(0.5);
    this.sprite.body.setCollideWorldBounds(true);

    scene.projectiles.add(this.sprite);

    // Spin while flying for visual feedback
    scene.tweens.add({
      targets: this.sprite,
      angle: 360,
      duration: 500,
      repeat: -1
    });

    this.fuseTimer = scene.time.delayedCall(this.fuseTime, () => this.explode());
  }

  static ensureTexture(scene) {
    if (scene.textures.exists('grenadeTexture')) return;

    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x3d4a2f);
    g.fillCircle(5, 5, 5);
    g.fillStyle(0x2a331e);
    g.fillRect(4, 0, 2, 2);
    g.fillStyle(0x1a1a1a);
    g.fillRect(3, 3, 1, 1);
    g.fillRect(6, 3, 1, 1);
    g.fillRect(3, 6, 1, 1);
    g.fillRect(6, 6, 1, 1);
    g.generateTexture('grenadeTexture', 10, 10);
    g.destroy();
  }

  explode() {
    if (!this.sprite.active) return;

    const x = this.sprite.x;
    const y = this.sprite.y;

    this.scene.createExplosion(x, y);

    const emitter = this.scene.add.particles(x, y, 'explosionParticle', {
      speed: { min: 120, max: 260 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: 450,
      emitting: false
    });
    emitter.explode(16);
    this.scene.time.delayedCall(500, () => emitter.destroy());

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

    // Damage the player/tank too if caught in the blast
    const playerDist = Phaser.Math.Distance.Between(x, y, this.scene.player.sprite.x, this.scene.player.sprite.y);
    if (playerDist <= this.splashRadius) {
      this.scene.damagePlayerOrTank(2);
    }

    this.destroy();
  }

  destroy() {
    if (this.fuseTimer) this.fuseTimer.remove();
    this.sprite.destroy();
  }
}
