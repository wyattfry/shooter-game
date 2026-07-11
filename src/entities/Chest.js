import Phaser from 'phaser';

export default class Chest {
  // Special crate weapon pool, weighted by rolling common weapons multiple
  // times and rarer/heavier ones once each. tankCall stays a solid chunk of
  // the pool without dominating it now that there are far more weapons.
  static get SPECIAL_REWARDS() {
    return [
      'saw', 'm4-upgrade',
      'glock17', 'glock17', 'm1911', 'm1911', 'deagle',
      'uzi', 'uzi', 'mp5', 'mp5', 'ump45', 'p90', 'vector',
      'ak47', 'ak47', 'akm', 'akm', 'famas', 'g36', 'aug',
      'scarh', 'svd', 'barrett',
      'remington870', 'aa12',
      'm240b',
      'rocket', 'rpg7',
      'tankCall', 'tankCall', 'tankCall', 'tankCall', 'tankCall'
    ];
  }

  constructor(scene, x, y, special = false) {
    this.scene = scene;
    this.opened = false;
    this.special = special;

    Chest.ensureTextures(scene);

    const texture = special ? 'chestSpecialClosed' : 'chestClosed';
    this.sprite = scene.physics.add.staticSprite(x, y, texture);
    this.sprite.setDisplaySize(28, 24);
    this.sprite.body.setSize(28, 24);
    this.sprite.refreshBody();
    this.sprite.chestInstance = this;

    scene.chests.add(this.sprite);
  }

  static ensureTextures(scene) {
    if (scene.textures.exists('chestClosed')) return;

    const wood = 0x8b5a2b;
    const woodDark = 0x6b4423;
    const metal = 0xc9a227;
    const metalDark = 0x8a6d1a;

    // Closed chest
    let g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(woodDark);
    g.fillRect(0, 4, 28, 20);
    g.fillStyle(wood);
    g.fillRect(1, 5, 26, 18);
    g.fillStyle(metal);
    g.fillRect(0, 10, 28, 3);
    g.fillStyle(metalDark);
    g.fillRect(12, 9, 4, 6);
    g.generateTexture('chestClosed', 28, 24);
    g.destroy();

    // Opened chest (lid tilted back, glow inside)
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(woodDark);
    g.fillRect(0, 10, 28, 14);
    g.fillStyle(wood);
    g.fillRect(1, 11, 26, 12);
    g.fillStyle(0xffe27a, 0.5);
    g.fillRect(3, 11, 22, 4);
    g.fillStyle(woodDark);
    g.fillRect(0, 2, 28, 5);
    g.fillStyle(metal);
    g.fillRect(0, 15, 28, 3);
    g.generateTexture('chestOpen', 28, 24);
    g.destroy();

    // Special weapon crate: military ammo-crate look (olive drab, stenciled star)
    const oliveDark = 0x3a4118;
    const olive = 0x4b5320;
    const stencil = 0xd4c68a;

    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(oliveDark);
    g.fillRect(0, 4, 28, 20);
    g.fillStyle(olive);
    g.fillRect(1, 5, 26, 18);
    g.fillStyle(stencil);
    g.fillRect(10, 9, 8, 8);
    g.fillStyle(oliveDark);
    g.fillRect(13, 9, 2, 8);
    g.fillRect(10, 12, 8, 2);
    g.generateTexture('chestSpecialClosed', 28, 24);
    g.destroy();

    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(oliveDark);
    g.fillRect(0, 10, 28, 14);
    g.fillStyle(olive);
    g.fillRect(1, 11, 26, 12);
    g.fillStyle(0xffe27a, 0.6);
    g.fillRect(3, 11, 22, 4);
    g.fillStyle(oliveDark);
    g.fillRect(0, 2, 28, 5);
    g.generateTexture('chestSpecialOpen', 28, 24);
    g.destroy();
  }

  open() {
    if (this.opened) return null;
    this.opened = true;

    if (this.special) {
      this.sprite.setTexture('chestSpecialOpen');
      return Phaser.Utils.Array.GetRandom(Chest.SPECIAL_REWARDS);
    }

    this.sprite.setTexture('chestOpen');

    const rewardRoll = Math.random();
    let reward;
    if (rewardRoll < 0.5) {
      reward = 'score';
      this.scene.score += 50;
    } else if (rewardRoll < 0.8) {
      reward = 'health';
    } else {
      reward = 'rapidFire';
    }

    return reward;
  }
}
