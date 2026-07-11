import Phaser from 'phaser';
import Player from '../entities/Player.js';
import {
  getCoins, spendCoins, isWeaponUnlocked, unlockWeapon,
  getPlayerName, setPlayerName, MAX_NAME_LENGTH
} from '../progress.js';
import CoinCounter from '../ui/CoinCounter.js';
import NetworkManager from '../net/NetworkManager.js';

const LOADOUT_KEYS = [
  'm4a1', 'saw', 'm4-upgrade', 'rocket',
  'glock17', 'm1911', 'deagle',
  'uzi', 'mp5', 'ump45', 'p90', 'vector',
  'ak47', 'akm', 'famas', 'g36', 'aug',
  'scarh', 'svd', 'barrett',
  'remington870', 'aa12',
  'm240b', 'rpg7'
];
const WEAPON_COSTS = {
  m4a1: 0,
  saw: 90,
  'm4-upgrade': 50,
  rocket: 220,

  glock17: 15,
  m1911: 20,
  deagle: 35,

  uzi: 25,
  mp5: 35,
  ump45: 40,
  p90: 45,
  vector: 45,

  ak47: 45,
  akm: 45,
  famas: 50,
  g36: 55,
  aug: 55,

  scarh: 85,
  svd: 100,
  barrett: 150,

  remington870: 80,
  aa12: 130,

  m240b: 140,

  rpg7: 250
};

const CARD_WIDTH = 150;
const CARD_HEIGHT = 120;
const CARDS_PER_ROW = 5;
const ROWS_PER_PAGE = 3;
const CARDS_PER_PAGE = CARDS_PER_ROW * ROWS_PER_PAGE;

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
    if (!this.registry.has('zombieMode')) {
      this.registry.set('zombieMode', false);
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

    this.buildNameField(width, height / 2 - 45);
    c.add([this.nameFieldBox, this.nameFieldText, this.nameFieldLabel]);

    const startText = this.makeButton(width / 2, height / 2 + 5, 'Start', '#66ccff', () => {
      this.scene.start('GameScene');
    });
    c.add(startText);

    const shopText = this.makeButton(width / 2, height / 2 + 55, 'Shop', '#ffcc66', () => {
      this.mainContainer.setVisible(false);
      this.shopContainer.setVisible(true);
      this.refreshWeaponSelection();
    });
    c.add(shopText);

    this.zombieToggleText = this.makeButton(width / 2, height / 2 + 100, '', '#88ff88', () => {
      this.registry.set('zombieMode', !this.registry.get('zombieMode'));
      this.refreshZombieToggle();
    });
    c.add(this.zombieToggleText);
    this.refreshZombieToggle();

    this.multiplayerText = this.makeButton(width / 2, height / 2 + 145, 'Multiplayer', '#ff88ff', () => {
      this.startMultiplayerFlow();
    });
    c.add(this.multiplayerText);

    this.mpStatusText = this.add.text(width / 2, height / 2 + 180, '', {
      fontSize: '14px',
      fill: '#aaaaaa'
    }).setOrigin(0.5);
    c.add(this.mpStatusText);

    c.add(this.add.text(
      width / 2,
      height / 2 + 215,
      'WASD/Arrows: move   Left-click: shoot   Right-click: throw grenade\nT: place turret (max 2)   E: enter/exit tank   Q: transform tank/mech',
      {
        fontSize: '13px',
        fill: '#888888',
        align: 'center'
      }
    ).setOrigin(0.5));

    this.input.keyboard.on('keydown-ENTER', () => {
      if (this.editingName) return;
      if (this.mainContainer.visible) {
        this.scene.start('GameScene');
      }
    });
  }

  buildNameField(width, y) {
    this.playerName = getPlayerName();
    this.editingName = false;

    this.nameFieldLabel = this.add.text(width / 2 - 110, y, 'Name:', {
      fontSize: '15px',
      fill: '#aaaaaa'
    }).setOrigin(1, 0.5);

    this.nameFieldBox = this.add.rectangle(width / 2, y, 200, 28, 0x14213d)
      .setStrokeStyle(2, 0x2a5aa1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.setEditingName(true))
      .on('pointerover', () => this.nameFieldBox.setStrokeStyle(2, 0x66ccff))
      .on('pointerout', () => this.nameFieldBox.setStrokeStyle(2, this.editingName ? 0x66ccff : 0x2a5aa1));

    this.nameFieldText = this.add.text(width / 2, y, this.displayName(), {
      fontSize: '15px',
      fill: '#ffffff'
    }).setOrigin(0.5);

    this.input.keyboard.on('keydown', (event) => {
      if (!this.editingName) return;

      if (event.key === 'Enter' || event.key === 'Escape') {
        this.setEditingName(false);
      } else if (event.key === 'Backspace') {
        this.playerName = this.playerName.slice(0, -1);
      } else if (event.key.length === 1 && this.playerName.length < MAX_NAME_LENGTH) {
        this.playerName += event.key;
      }
      this.nameFieldText.setText(this.displayName());
    });

    this.input.on('pointerdown', (pointer, currentlyOver) => {
      if (this.editingName && !currentlyOver.includes(this.nameFieldBox)) {
        this.setEditingName(false);
      }
    });
  }

  displayName() {
    return (this.playerName || 'Player') + (this.editingName ? '|' : '');
  }

  setEditingName(editing) {
    this.editingName = editing;
    this.nameFieldBox.setStrokeStyle(2, editing ? 0x66ccff : 0x2a5aa1);
    if (!editing) {
      this.playerName = setPlayerName(this.playerName.trim());
    }
    this.nameFieldText.setText(this.displayName());
  }

  startMultiplayerFlow() {
    if (this.mpConnecting) return;
    this.mpConnecting = true;
    this.mpStatusText.setFill('#ffcc66');
    this.mpStatusText.setText('Connecting...');

    const net = new NetworkManager();
    net.connect(undefined, this.playerName || 'Player')
      .then(() => {
        this.mpConnecting = false;
        this.mpStatusText.setFill('#66ff88');
        this.mpStatusText.setText(
          `Connected — ${net.players.length} player(s) in room${net.isHost ? ' (you are host)' : ''}`
        );
        this.registry.set('multiplayerNetwork', net);
        this.time.delayedCall(400, () => {
          this.scene.start('GameScene', { multiplayer: true });
        });
      })
      .catch(() => {
        this.mpConnecting = false;
        this.mpStatusText.setFill('#ff6666');
        this.mpStatusText.setText('Connection failed — is the server running?');
      });
  }

  refreshZombieToggle() {
    const on = this.registry.get('zombieMode');
    this.zombieToggleText.setText(`Zombie Mode: ${on ? 'ON' : 'OFF'}`);
    this.zombieToggleText.setFill(on ? '#66ff66' : '#888888');
  }

  buildShop(width, height) {
    const c = this.shopContainer;

    c.add(this.add.text(width / 2, 40, 'SHOP', {
      fontSize: '40px',
      fontStyle: 'bold',
      fill: '#ffffff'
    }).setOrigin(0.5));

    c.add(this.add.text(width / 2, 75, 'Unlock weapons with coins earned from kills, then pick your loadout', {
      fontSize: '13px',
      fill: '#aaaaaa'
    }).setOrigin(0.5));

    this.currentPage = 0;
    this.totalPages = Math.ceil(LOADOUT_KEYS.length / CARDS_PER_PAGE);

    const gridWidth = CARDS_PER_ROW * CARD_WIDTH;
    const gridStartX = width / 2 - gridWidth / 2 + CARD_WIDTH / 2;
    const gridStartY = 130;

    this.weaponCards = [];

    LOADOUT_KEYS.forEach((key, i) => {
      const weapon = Player.WEAPONS[key];
      const cost = WEAPON_COSTS[key];
      const col = i % CARDS_PER_ROW;
      const row = Math.floor(i / CARDS_PER_ROW) % ROWS_PER_PAGE;
      const page = Math.floor(i / CARDS_PER_PAGE);
      const x = gridStartX + col * CARD_WIDTH;
      const y = gridStartY + row * CARD_HEIGHT;

      const box = this.add.rectangle(x, y, CARD_WIDTH - 12, CARD_HEIGHT - 12, 0x14213d)
        .setStrokeStyle(2, 0x2a5aa1)
        .setInteractive({ useHandCursor: true });

      const label = this.add.text(x, y - 22, weapon.label, {
        fontSize: '12px',
        fontStyle: 'bold',
        fill: '#ffffff',
        align: 'center',
        wordWrap: { width: CARD_WIDTH - 24 }
      }).setOrigin(0.5, 1);

      const ammoLabel = weapon.magSize ? `${weapon.magSize[0]}-${weapon.magSize[1]} mag` : 'Unlimited';
      const info = this.add.text(x, y - 4, ammoLabel, {
        fontSize: '11px',
        fill: '#888888'
      }).setOrigin(0.5, 0);

      const statusText = this.add.text(x, y + 20, '', {
        fontSize: '11px',
        fill: '#66ccff'
      }).setOrigin(0.5);

      const actionText = this.add.text(x, y + 40, '', {
        fontSize: '12px',
        fontStyle: 'bold',
        fill: '#ffcc66'
      }).setOrigin(0.5);

      box.on('pointerdown', () => this.handleCardClick(key, cost));
      box.on('pointerover', () => box.setStrokeStyle(2, 0x66ccff));
      box.on('pointerout', () => this.refreshWeaponSelection());

      c.add([box, label, info, statusText, actionText]);
      this.weaponCards.push({ key, cost, page, box, label, info, statusText, actionText });
    });

    const pagerY = gridStartY + ROWS_PER_PAGE * CARD_HEIGHT + 15;

    this.prevPageText = this.makeButton(width / 2 - 140, pagerY, '< Prev', '#aaaaaa', () => {
      this.changePage(-1);
    });
    c.add(this.prevPageText);

    this.pageIndicatorText = this.add.text(width / 2, pagerY, '', {
      fontSize: '16px',
      fill: '#ffffff'
    }).setOrigin(0.5);
    c.add(this.pageIndicatorText);

    this.nextPageText = this.makeButton(width / 2 + 140, pagerY, 'Next >', '#aaaaaa', () => {
      this.changePage(1);
    });
    c.add(this.nextPageText);

    const backText = this.makeButton(width / 2, pagerY + 40, 'Back', '#aaaaaa', () => {
      this.shopContainer.setVisible(false);
      this.mainContainer.setVisible(true);
    });
    c.add(backText);
  }

  changePage(delta) {
    this.currentPage = Phaser.Math.Clamp(this.currentPage + delta, 0, this.totalPages - 1);
    this.refreshWeaponSelection();
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

    this.weaponCards.forEach(({ key, cost, page, box, label, info, statusText, actionText }) => {
      const onPage = page === this.currentPage;
      [box, label, info, statusText, actionText].forEach(obj => obj.setVisible(onPage));
      if (!onPage) return;

      const unlocked = isWeaponUnlocked(key);
      const isSelected = key === selected;

      if (unlocked) {
        box.setStrokeStyle(2, isSelected ? 0x66ccff : 0x2a5aa1);
        statusText.setText(isSelected ? 'SELECTED' : 'Unlocked');
        actionText.setText(isSelected ? '' : 'Click to select');
        actionText.setFill('#ffcc66');
      } else {
        box.setStrokeStyle(2, 0x555555);
        statusText.setText('Locked');
        actionText.setText(coins >= cost ? `Unlock: ${cost}c` : `Need ${cost}c`);
        actionText.setFill(coins >= cost ? '#66ff88' : '#ff6666');
      }
    });

    this.pageIndicatorText.setText(`Page ${this.currentPage + 1} / ${this.totalPages}`);
    this.prevPageText.setAlpha(this.currentPage === 0 ? 0.3 : 1);
    this.prevPageText.disableInteractive();
    this.nextPageText.setAlpha(this.currentPage === this.totalPages - 1 ? 0.3 : 1);
    this.nextPageText.disableInteractive();
    if (this.currentPage > 0) this.prevPageText.setInteractive({ useHandCursor: true });
    if (this.currentPage < this.totalPages - 1) this.nextPageText.setInteractive({ useHandCursor: true });
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
