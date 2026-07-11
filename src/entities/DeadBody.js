import Phaser from 'phaser';

export default class DeadBody {
  constructor(scene, x, y, flipX = false) {
    DeadBody.ensureTexture(scene);

    this.sprite = scene.add.image(x, y, 'deadBody');
    this.sprite.setDisplaySize(26, 20);
    this.sprite.setFlipX(flipX);
    this.sprite.setRotation(Phaser.Math.FloatBetween(-0.15, 0.15));
    this.sprite.setDepth(-5);

    // Fade out and remove after a while so the battlefield doesn't clutter
    scene.time.delayedCall(6000, () => {
      scene.tweens.add({
        targets: this.sprite,
        alpha: 0,
        duration: 1000,
        onComplete: () => this.sprite.destroy()
      });
    });
  }

  static ensureTexture(scene) {
    if (scene.textures.exists('deadBody')) return;

    const skin = 0xffcc99;
    const shirt = 0x7a1c1c;
    const pants = 0x3a2222;
    const outline = 0x1a1a1a;
    const blood = 0x6b0f0f;

    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    // blood pool underneath
    g.fillStyle(blood, 0.5);
    g.fillEllipse(13, 12, 22, 10);

    // legs (splayed)
    g.fillStyle(pants);
    g.fillRect(2, 9, 10, 4);
    g.fillRect(14, 9, 10, 4);

    // torso (lying sideways)
    g.fillStyle(shirt);
    g.fillRect(6, 5, 14, 6);

    // head
    g.fillStyle(skin);
    g.fillCircle(22, 8, 4);

    // arm
    g.fillStyle(skin);
    g.fillRect(8, 4, 6, 2);

    // outline dot eye (X shape for dead)
    g.fillStyle(outline);
    g.fillRect(20, 7, 1, 1);
    g.fillRect(23, 7, 1, 1);

    g.generateTexture('deadBody', 26, 20);
    g.destroy();
  }
}
