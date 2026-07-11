import Phaser from 'phaser';

export default class DeadBody {
  constructor(scene, x, y, flipX = false, zombie = false) {
    DeadBody.ensureTexture(scene);
    if (zombie) DeadBody.ensureZombieTexture(scene);

    this.sprite = scene.add.image(x, y, zombie ? 'deadZombie' : 'deadBody');
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

    const skin = 0xd9a066;
    const skinDark = 0xa66f3f;
    const shirt = 0x5c2020;
    const shirtDark = 0x3a1414;
    const vest = 0x2e2e2e;
    const pants = 0x33302a;
    const pantsDark = 0x201e1a;
    const boot = 0x18181a;
    const outline = 0x0d0d0d;
    const blood = 0x6b0f0f;

    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    // blood pool underneath, layered for depth
    g.fillStyle(blood, 0.35);
    g.fillEllipse(13, 12, 24, 11);
    g.fillStyle(blood, 0.55);
    g.fillEllipse(11, 12.5, 14, 6);

    // legs (splayed), boots
    g.fillStyle(pantsDark);
    g.fillRect(2, 9, 10, 4.4);
    g.fillRect(14, 9, 9, 4.4);
    g.fillStyle(pants);
    g.fillRect(2, 9, 10, 2.2);
    g.fillRect(14, 9, 9, 2.2);
    g.fillStyle(boot);
    g.fillRect(0.5, 8.6, 3, 3.4);
    g.fillRect(21.5, 8.6, 3, 3.4);

    // torso (lying sideways) with vest over undershirt
    g.fillStyle(shirtDark);
    g.fillRect(6, 5, 14, 6.4);
    g.fillStyle(shirt);
    g.fillRect(6.5, 5.4, 13, 5);
    g.fillStyle(vest);
    g.fillRect(7, 6, 11, 4.2);
    g.fillStyle(outline);
    g.fillRect(11, 6.4, 1.4, 3.4);

    // bullet wound + seeping blood on torso
    g.fillStyle(blood);
    g.fillCircle(13, 8, 1.6);
    g.fillStyle(0x8f2a2a);
    g.fillCircle(13, 8, 0.8);

    // arm, limp
    g.fillStyle(skinDark);
    g.fillRect(8, 3.6, 6.4, 2.2);
    g.fillStyle(skin);
    g.fillRect(8, 3.6, 5.6, 1.6);

    // head with slack expression
    g.fillStyle(skinDark);
    g.fillCircle(22, 8, 4.2);
    g.fillStyle(skin);
    g.fillCircle(22.3, 7.7, 3.6);

    // outline dot eyes (closed/dead) + open mouth
    g.fillStyle(outline);
    g.fillRect(20.2, 7, 1.4, 0.6);
    g.fillRect(23, 7, 1.4, 0.6);
    g.fillRect(21, 9.4, 2, 0.8);

    g.generateTexture('deadBody', 26, 20);
    g.destroy();
  }

  static ensureZombieTexture(scene) {
    if (scene.textures.exists('deadZombie')) return;

    const skin = 0x7a9b5c;
    const skinDark = 0x4e6b38;
    const shirt = 0x3a4a2a;
    const shirtDark = 0x232e19;
    const pants = 0x2a3a1a;
    const pantsDark = 0x18220e;
    const outline = 0x131a0c;
    const gore = 0x6b1a1a;
    const goreDark = 0x3d0e0e;
    const bone = 0xd8cfa8;

    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    // gore pool underneath, layered for depth
    g.fillStyle(goreDark, 0.4);
    g.fillEllipse(13, 12, 24, 11);
    g.fillStyle(gore, 0.55);
    g.fillEllipse(11, 12.5, 14, 6);

    // legs (splayed), torn hems
    g.fillStyle(pantsDark);
    g.fillRect(2, 9, 10, 4.4);
    g.fillRect(14, 9, 9, 4.4);
    g.fillStyle(pants);
    g.fillRect(2, 9, 10, 2.2);
    g.fillRect(14, 9, 9, 2.2);
    g.fillStyle(skinDark);
    g.fillRect(0.5, 8.8, 3, 2.4);
    g.fillStyle(bone);
    g.fillRect(1.4, 9.6, 0.8, 1.4);

    // torso (lying sideways), tattered shirt
    g.fillStyle(shirtDark);
    g.fillRect(6, 5, 14, 6.4);
    g.fillStyle(shirt);
    g.fillRect(6.5, 5.4, 13, 5);
    g.fillTriangle(6.5, 10.2, 8.5, 11.4, 7.2, 10.2);
    g.fillTriangle(16, 10.2, 18, 11.6, 17, 10.2);

    // large gore wound with exposed ribs
    g.fillStyle(goreDark);
    g.fillRect(9, 6, 5, 3.8);
    g.fillStyle(gore);
    g.fillRect(9.5, 6.4, 4, 2.6);
    g.fillStyle(bone);
    g.fillRect(10, 6.8, 0.7, 1.8);
    g.fillRect(11.4, 6.8, 0.7, 1.8);
    g.fillRect(12.8, 6.8, 0.7, 1.8);

    // head, sickly tone
    g.fillStyle(skinDark);
    g.fillCircle(22, 8, 4.2);
    g.fillStyle(skin);
    g.fillCircle(22.3, 7.7, 3.6);
    g.fillStyle(goreDark);
    g.fillRect(20, 5, 2.4, 1.8);

    // arm, clawed hand
    g.fillStyle(skinDark);
    g.fillRect(8, 3.6, 6.4, 2.2);
    g.fillStyle(skin);
    g.fillRect(8, 3.6, 5.6, 1.6);
    g.fillRect(6.8, 3.4, 1.4, 1);

    // sunken dead eyes + slack jaw
    g.fillStyle(outline);
    g.fillRect(20.2, 7, 1.4, 0.6);
    g.fillRect(23, 7, 1.4, 0.6);
    g.fillRect(21, 9.4, 2, 0.8);

    g.generateTexture('deadZombie', 26, 20);
    g.destroy();
  }
}
