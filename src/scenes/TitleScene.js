import Phaser from 'phaser';
import { PALETTE } from '../config/palette.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const title = this.add
      .text(640, 340, 'Wine Cellar Siege', {
        fontFamily: 'Cinzel, serif',
        fontStyle: '700',
        fontSize: '84px',
        color: PALETTE.candleGold,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({ targets: title, alpha: 1, duration: 300, ease: 'Sine.easeOut' });
  }
}
