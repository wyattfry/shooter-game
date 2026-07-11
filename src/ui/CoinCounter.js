import { getCoins } from '../progress.js';

export default class CoinCounter {
  constructor(scene) {
    this.scene = scene;

    this.text = scene.add.text(scene.scale.width - 16, 16, '', {
      fontSize: '20px',
      fontStyle: 'bold',
      fill: '#ffd76a'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(1000);

    this.refresh();

    this.updateEvent = scene.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => this.refresh()
    });

    scene.events.once('shutdown', () => this.destroy());
    scene.events.once('destroy', () => this.destroy());
  }

  refresh() {
    this.text.setText(`Coins: ${getCoins()}`);
  }

  destroy() {
    if (this.updateEvent) this.updateEvent.remove();
    if (this.text) this.text.destroy();
  }
}
