import Phaser from 'phaser';
import Player from '../entities/Player.js';
import { getCoins, spendCoins, isWeaponUnlocked, unlockWeapon } from '../progress.js';
import CoinCounter from '../ui/CoinCounter.js';

const LOADOUT_KEYS = ['m4a1', 'saw', 'rocket'];
const WEAPON_COSTS = {
  m4a1: 0,
  saw: 25,
  rocket: 60
};

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#0a1226');

    if (!this.registry.has('startWeapon') || !isWeaponUnlocked(this.registry.get('startWeapon'))) {
      this.registry.set('startWeapon', 'm4a1');
    }

    this.mainContainer = this.add.container(0, 0);
    this.shopContainer = this.add.container(0, 0);
    this.shopContainer.setVisible(false);

    this.buildMainMenu(width, height);
    this.buildShop(width, height);

    this.coinCounter = new CoinCounter(this);
  }

  buildMainMenu(width, height) {
    const c = this.mainContainer;

    c.add(this.add.text(width / 2, height / 2 - 140, 'SHOOTER', {
      fontSize: '64px',
      fontStyle: 'bold',
      fill: '#ffffff'
    }).setOrigin(0.5));

    c.add(this.add.text(width / 2, height / 2 - 80, 'A top-down survival shooter', {
      fontSize: '18px',
      fill: '#aaaaaa'
    }).setOrigin(0.5));

    const startText = this.makeButton(width / 2, height / 2 - 10, 'Start', '#66ccff', () => {
      this.scene.start('GameScene');
    });
    c.add(startText);

    const shopText = this.makeButton(width / 2, height / 2 + 50, 'Shop', '#ffcc66', () => {
      this.mainContainer.setVisible(false);
      this.shopContainer.setVisible(true);
      this.refreshWeaponSelection();
    });
    c.add(shopText);

    c.add(this.add.text(
      width / 2,
      height / 2 + 130,
      'WASD/Arrows: move   Left-click: shoot   Right-click: throw grenade\nT: place turret (max 2)   E: enter/exit tank',
      {
        fontSize: '14px',
        fill: '#888888',
        align: 'center'
      }
    ).setOrigin(0.5));

    this.input.keyboard.on('keydown-ENTER', () => {
      if (this.mainContainer.visible) {
        this.scene.start('GameScene');
      }
    });
  }

  buildShop(width, height) {
    const c = this.shopContainer;

    c.add(this.add.text(width / 2, height / 2 - 200, 'SHOP', {
      fontSize: '48px',
      fontStyle: 'bold',
      fill: '#ffffff'
    }).setOrigin(0.5));

    c.add(this.add.text(width / 2, height / 2 - 120, 'Unlock weapons with coins earned from kills, then pick your loadout', {
      fontSize: '14px',
      fill: '#aaaaaa'
    }).setOrigin(0.5));

    this.weaponCards = [];

    const cardWidth = 200;
    const spacing = 220;
    const startX = width / 2 - ((LOADOUT_KEYS.length - 1) * spacing) / 2;
    const cardY = height / 2 - 10;

    LOADOUT_KEYS.forEach((key, i) => {
      const weapon = Player.WEAPONS[key];
      const cost = WEAPON_COSTS[key];
      const x = startX + i * spacing;

      const box = this.add.rectangle(x, cardY, cardWidth, 150, 0x14213d)
        .setStrokeStyle(2, 0x2a5aa1)
        .setInteractive({ useHandCursor: true });

      const label = this.add.text(x, cardY - 40, weapon.label, {
        fontSize: '16px',
        fontStyle: 'bold',
        fill: '#ffffff',
        align: 'center',
        wordWrap: { width: cardWidth - 20 }
      }).setOrigin(0.5);

      const ammoLabel = weapon.ammo === Infinity ? 'Unlimited ammo' : `${weapon.ammo} ammo`;
      const info = this.add.text(x, cardY - 5, ammoLabel, {
        fontSize: '13px',
        fill: '#888888'
      }).setOrigin(0.5);

      const statusText = this.add.text(x, cardY + 25, '', {
        fontSize: '13px',
        fill: '#66ccff'
      }).setOrigin(0.5);

      const actionText = this.add.text(x, cardY + 55, '', {
        fontSize: '14px',
        fontStyle: 'bold',
        fill: '#ffcc66'
      }).setOrigin(0.5);

      box.on('pointerdown', () => this.handleCardClick(key, cost));
      box.on('pointerover', () => box.setStrokeStyle(2, 0x66ccff));
      box.on('pointerout', () => this.refreshWeaponSelection());

      c.add([box, label, info, statusText, actionText]);
      this.weaponCards.push({ key, cost, box, statusText, actionText });
    });

    const backText = this.makeButton(width / 2, height / 2 + 190, 'Back', '#aaaaaa', () => {
      this.shopContainer.setVisible(false);
      this.mainContainer.setVisible(true);
    });
    c.add(backText);
  }

  handleCardClick(key, cost) {
    if (isWeaponUnlocked(key)) {
      this.registry.set('startWeapon', key);
      this.refreshWeaponSelection();
      return;
    }

    if (spendCoins(cost)) {
      unlockWeapon(key);
      this.registry.set('startWeapon', key);
    }
    this.refreshWeaponSelection();
  }

  refreshWeaponSelection() {
    const selected = this.registry.get('startWeapon');
    const coins = getCoins();

    this.weaponCards.forEach(({ key, cost, box, statusText, actionText }) => {
      const unlocked = isWeaponUnlocked(key);
      const isSelected = key === selected;

      if (unlocked) {
        box.setStrokeStyle(2, isSelected ? 0x66ccff : 0x2a5aa1);
        statusText.setText(isSelected ? 'SELECTED' : 'Unlocked');
        actionText.setText(isSelected ? '' : 'Click to select');
      } else {
        box.setStrokeStyle(2, 0x555555);
        statusText.setText('Locked');
        actionText.setText(coins >= cost ? `Unlock: ${cost} coins` : `Need ${cost} coins`);
        actionText.setFill(coins >= cost ? '#66ff88' : '#ff6666');
      }
    });
  }

  makeButton(x, y, label, color, onClick) {
    const text = this.add.text(x, y, label, {
      fontSize: '26px',
      fill: color
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    text.on('pointerover', () => text.setScale(1.1));
    text.on('pointerout', () => text.setScale(1));
    text.on('pointerdown', onClick);

    return text;
  }
}
