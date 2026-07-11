import Phaser from 'phaser';

export default class Background {
  constructor(scene, width, height) {
    Background.ensureTexture(scene);

    this.tileSprite = scene.add.tileSprite(0, 0, width, height, 'groundTexture');
    this.tileSprite.setOrigin(0, 0);
    this.tileSprite.setDepth(-10);
  }

  static ensureTexture(scene) {
    if (scene.textures.exists('groundTexture')) return;

    const size = 128;
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });

    // Base asphalt color
    graphics.fillStyle(0x2f3236);
    graphics.fillRect(0, 0, size, size);

    // Subtle grid lines
    graphics.lineStyle(1, 0x373b40, 0.6);
    for (let i = 0; i <= size; i += 32) {
      graphics.lineBetween(i, 0, i, size);
      graphics.lineBetween(0, i, size, i);
    }

    // Random speckles/noise for texture
    const rand = new Phaser.Math.RandomDataGenerator([Date.now().toString()]);
    for (let i = 0; i < 90; i++) {
      const x = rand.between(0, size);
      const y = rand.between(0, size);
      const shade = rand.pick([0x26282b, 0x3a3d42, 0x1f2123]);
      graphics.fillStyle(shade, rand.realInRange(0.3, 0.7));
      graphics.fillRect(x, y, rand.between(1, 3), rand.between(1, 3));
    }

    // A couple of cracks
    graphics.lineStyle(1, 0x1c1e20, 0.8);
    graphics.beginPath();
    graphics.moveTo(10, 20);
    graphics.lineTo(25, 35);
    graphics.lineTo(20, 55);
    graphics.lineTo(35, 70);
    graphics.strokePath();

    graphics.beginPath();
    graphics.moveTo(90, 90);
    graphics.lineTo(100, 105);
    graphics.lineTo(95, 120);
    graphics.strokePath();

    // Faint stain patch
    graphics.fillStyle(0x24272a, 0.4);
    graphics.fillCircle(100, 30, 14);

    graphics.generateTexture('groundTexture', size, size);
    graphics.destroy();
  }
}
