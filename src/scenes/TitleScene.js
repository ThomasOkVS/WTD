import Phaser from 'phaser';
import { PALETTE } from '../config/palette.js';
import { bindTextureGridKey } from '../art/textureGrid.js';

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

    const play = this.add
      .text(640, 470, 'Play', {
        fontFamily: 'Cinzel, serif',
        fontStyle: '700',
        fontSize: '44px',
        color: PALETTE.amber,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setInteractive({ useHandCursor: true });
    play.on('pointerover', () => play.setColor(PALETTE.candleGold));
    play.on('pointerout', () => play.setColor(PALETTE.amber));
    play.on('pointerdown', () => this.scene.start('Game'));
    this.tweens.add({ targets: play, alpha: 1, duration: 300, delay: 200, ease: 'Sine.easeOut' });
    bindTextureGridKey(this);
  }
}
