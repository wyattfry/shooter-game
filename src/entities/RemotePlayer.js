import Phaser from 'phaser';
import Player from './Player.js';
import Tank from './Tank.js';

// Visual-only stand-in for another client's Player: no input handling, no physics
// simulation of its own — it just snaps/lerps toward the last broadcast state.
export default class RemotePlayer {
  constructor(scene, x, y, color, name, isHost = false) {
    this.scene = scene;
    Player.ensureTextures(scene);
    Tank.ensureTextures(scene);

    this.sprite = scene.add.sprite(x, y, 'playerWalk', 0);
    this.sprite.setDisplaySize(30, 37.5);
    this.sprite.play('player-walk');
    if (color != null) this.sprite.setTint(color);

    const startWeapon = Player.WEAPONS.m4a1;
    this.gunSprite = scene.add.image(x, y, startWeapon.texture);
    this.gunSprite.setOrigin(0.15, 0.5);
    this.gunSprite.setDisplaySize(startWeapon.width, startWeapon.height);
    if (color != null) this.gunSprite.setTint(color);

    // Tank/mech ghost, shown instead of the on-foot sprites while driving
    this.vehicleSprite = scene.add.sprite(x, y, 'tankBody');
    this.vehicleSprite.setDisplaySize(56, 40);
    this.vehicleSprite.setVisible(false);
    if (color != null) this.vehicleSprite.setTint(color);

    this.vehicleTurretSprite = scene.add.image(x, y, 'tankTurret');
    this.vehicleTurretSprite.setDisplaySize(48, 20);
    this.vehicleTurretSprite.setOrigin(10 / 48, 8 / 20);
    this.vehicleTurretSprite.setVisible(false);
    if (color != null) this.vehicleTurretSprite.setTint(color);

    this.vehicle = null;

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

    // Off-screen indicator: an arrow + name pinned to the viewport edge,
    // pointing toward this player when they're outside the camera view.
    this.edgeArrow = scene.add.triangle(0, 0, 0, -9, -7, 7, 7, 7, color ?? 0xffffff)
      .setScrollFactor(0).setDepth(2000).setVisible(false);
    this.edgeLabel = scene.add.text(0, 0, this.name, {
      fontSize: '12px',
      fill: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 3, y: 1 }
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2000).setVisible(false);
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

    this.vehicle = state.vehicle || null;
  }

  update() {
    // Simple lerp toward the last broadcast position, smooths out the
    // ~15-20Hz update rate without any prediction/reconciliation.
    this.sprite.x = Phaser.Math.Linear(this.sprite.x, this.targetX, 0.25);
    this.sprite.y = Phaser.Math.Linear(this.sprite.y, this.targetY, 0.25);

    const inVehicle = !!this.vehicle;
    this.sprite.setVisible(!inVehicle && !this.dead);
    this.gunSprite.setVisible(!inVehicle && !this.dead);
    this.vehicleSprite.setVisible(inVehicle);
    this.vehicleTurretSprite.setVisible(inVehicle);

    if (inVehicle) {
      this.updateVehicle();
    } else if (this.moving) {
      if (!this.sprite.anims.isPlaying) this.sprite.play('player-walk');
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(0);
    }

    if (!inVehicle) {
      this.gunSprite.setPosition(this.sprite.x, this.sprite.y + 3);
      this.gunSprite.setRotation(this.rotation);
      const facingLeft = Math.abs(this.rotation) > Math.PI / 2;
      this.gunSprite.setFlipY(facingLeft);
      this.gunSprite.setOrigin(0.15, facingLeft ? -0.5 : 0.5);
    }

    const labelTarget = inVehicle ? this.vehicleSprite : this.sprite;
    this.nameText.setPosition(labelTarget.x, labelTarget.y - (inVehicle ? 34 : 30));

    this.updateEdgeIndicator(labelTarget.x, labelTarget.y);
  }

  // Shows an arrow + name at the camera edge, pointing toward this player,
  // whenever they're outside the current viewport.
  updateEdgeIndicator(worldX, worldY) {
    const cam = this.scene.cameras.main;
    const margin = 30;
    const view = cam.worldView;

    const onScreen = worldX >= view.x && worldX <= view.right &&
      worldY >= view.y && worldY <= view.bottom;

    if (onScreen || this.dead) {
      this.edgeArrow.setVisible(false);
      this.edgeLabel.setVisible(false);
      return;
    }

    const centerX = view.x + view.width / 2;
    const centerY = view.y + view.height / 2;
    const angle = Phaser.Math.Angle.Between(centerX, centerY, worldX, worldY);

    const halfW = cam.width / 2 - margin;
    const halfH = cam.height / 2 - margin;
    const scale = Math.min(
      Math.abs(halfW / Math.cos(angle)) || Infinity,
      Math.abs(halfH / Math.sin(angle)) || Infinity
    );

    const screenX = cam.width / 2 + Math.cos(angle) * scale;
    const screenY = cam.height / 2 + Math.sin(angle) * scale;

    this.edgeArrow.setPosition(screenX, screenY);
    this.edgeArrow.setRotation(angle + Math.PI / 2);
    this.edgeArrow.setVisible(true);

    this.edgeLabel.setPosition(screenX, screenY + 12);
    this.edgeLabel.setVisible(true);
  }

  updateVehicle() {
    this.vehicleSprite.x = Phaser.Math.Linear(this.vehicleSprite.x, this.vehicle.x, 0.25);
    this.vehicleSprite.y = Phaser.Math.Linear(this.vehicleSprite.y, this.vehicle.y, 0.25);
    this.vehicleSprite.rotation = this.vehicle.rotation;

    const mechTexture = this.vehicle.type === 'mech';
    if (mechTexture && this.vehicleSprite.texture.key !== 'mechWalk') {
      this.vehicleSprite.setTexture('mechWalk', 0);
      this.vehicleSprite.setDisplaySize(64, 44);
    } else if (!mechTexture && this.vehicleSprite.texture.key !== 'tankBody') {
      this.vehicleSprite.setTexture('tankBody');
      this.vehicleSprite.setDisplaySize(56, 40);
    }

    this.vehicleTurretSprite.x = this.vehicleSprite.x;
    this.vehicleTurretSprite.y = this.vehicleSprite.y;
    this.vehicleTurretSprite.rotation = this.vehicle.turretRotation;

    // Keep the on-foot sprite riding along so despawn/respawn snaps cleanly
    // back to the right spot the moment the player exits the vehicle.
    this.sprite.x = this.vehicleSprite.x;
    this.sprite.y = this.vehicleSprite.y;
  }

  destroy() {
    this.nameText.destroy();
    this.sprite.destroy();
    this.gunSprite.destroy();
    this.vehicleSprite.destroy();
    this.vehicleTurretSprite.destroy();
    this.edgeArrow.destroy();
    this.edgeLabel.destroy();
  }
}
