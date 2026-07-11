import Phaser from 'phaser';

export default class PowerUp {
  constructor(scene, x, y) {
    this.scene = scene;

    const types = ['health', 'rapidFire'];
    this.type = Phaser.Utils.Array.GetRandom(types);

    const color = this.type === 'health' ? 0x00ff00 : 0xffff00;

    // Create graphics for power-up
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(color);
    graphics.fillRect(0, 0, 16, 16);
    const texture = graphics.generateTexture('powerupTexture', 16, 16);
    graphics.destroy();

    this.sprite = scene.physics.add.sprite(x, y, 'powerupTexture');
    this.sprite.setData('type', this.type);

    // Slowly float upward
    this.sprite.body.setVelocity(0, -50);

    // Auto-destroy after 8 seconds
    scene.time.delayedCall(8000, () => {
      if (this.sprite && this.sprite.active) this.sprite.destroy();
    });

    scene.powerUps.add(this.sprite);
  }

  destroy() {
    this.sprite.destroy();
  }
}
