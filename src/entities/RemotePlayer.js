import Phaser from 'phaser';
import Player from './Player.js';

// Visual-only stand-in for another client's Player: no input handling, no physics
// simulation of its own — it just snaps/lerps toward the last broadcast state.
export default class RemotePlayer {
  constructor(scene, x, y, color, name, isHost = false) {
    this.scene = scene;
    Player.ensureTextures(scene);

    this.sprite = scene.add.sprite(x, y, 'playerWalk', 0);
    this.sprite.setDisplaySize(30, 37.5);
    this.sprite.play('player-walk');
    if (color != null) this.sprite.setTint(color);

    const startWeapon = Player.WEAPONS.m4a1;
    this.gunSprite = scene.add.image(x, y, startWeapon.texture);
    this.gunSprite.setOrigin(0.15, 0.5);
    this.gunSprite.setDisplaySize(startWeapon.width, startWeapon.height);
    if (color != null) this.gunSprite.setTint(color);

    this.name = name || 'Player';
    this.isHost = isHost;
    this.nameText = scene.add.text(x, y - 30, `${this.name}${isHost ? '  ♛ HOST' : ''}`, {
      fontSize: '13px',
      fill: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 3, y: 1 }
    }).setOrigin(0.5, 1);

    this.targetX = x;
    this.targetY = y;
    this.rotation = 0;
    this.health = 3;
    this.weaponKey = 'm4a1';
    this.moving = false;
    this.dead = false;
  }

  markDead() {
    this.dead = true;
    this.sprite.setAlpha(0.4);
    this.nameText.setAlpha(0.4);
  }

  applyState(state) {
    this.targetX = state.x;
    this.targetY = state.y;
    this.rotation = state.rotation;
    this.health = state.health;
    this.moving = !!state.moving;
    if (state.flipX != null) this.sprite.setFlipX(state.flipX);

    if (state.weaponKey && state.weaponKey !== this.weaponKey) {
      this.weaponKey = state.weaponKey;
      const weapon = Player.WEAPONS[state.weaponKey];
      if (weapon) {
        this.gunSprite.setTexture(weapon.texture);
        this.gunSprite.setDisplaySize(weapon.width, weapon.height);
      }
    }
  }

  update() {
    // Simple lerp toward the last broadcast position, smooths out the
    // ~15-20Hz update rate without any prediction/reconciliation.
    this.sprite.x = Phaser.Math.Linear(this.sprite.x, this.targetX, 0.25);
    this.sprite.y = Phaser.Math.Linear(this.sprite.y, this.targetY, 0.25);

    if (this.moving) {
      if (!this.sprite.anims.isPlaying) this.sprite.play('player-walk');
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(0);
    }

    this.gunSprite.setPosition(this.sprite.x, this.sprite.y + 3);
    this.gunSprite.setRotation(this.rotation);
    const facingLeft = Math.abs(this.rotation) > Math.PI / 2;
    this.gunSprite.setFlipY(facingLeft);
    this.gunSprite.setOrigin(0.15, facingLeft ? -0.5 : 0.5);

    this.nameText.setPosition(this.sprite.x, this.sprite.y - 30);
  }

  destroy() {
    this.nameText.destroy();
    this.sprite.destroy();
    this.gunSprite.destroy();
  }
}
