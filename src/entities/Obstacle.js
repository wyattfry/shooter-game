import Phaser from 'phaser';

export default class Obstacle {
  constructor(scene, x, y, width, height) {
    this.scene = scene;

    Obstacle.ensureTexture(scene);

    this.sprite = scene.physics.add.staticSprite(x, y, 'obstacleTexture');
    this.sprite.setDisplaySize(width, height);
    this.sprite.body.setSize(width, height);
    this.sprite.refreshBody();

    scene.obstacles.add(this.sprite);
  }

  static ensureTexture(scene) {
    if (scene.textures.exists('obstacleTexture')) return;

    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0x6b6b6b);
    graphics.fillRect(0, 0, 32, 32);
    graphics.lineStyle(2, 0x4a4a4a);
    graphics.strokeRect(1, 1, 30, 30);
    graphics.generateTexture('obstacleTexture', 32, 32);
    graphics.destroy();
  }
}
