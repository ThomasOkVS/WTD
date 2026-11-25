import Phaser from 'phaser';
import { PALETTE } from '../config/palette.js';
import { WAVES } from '../config/waves.js';

// Simple end screen (Task 8 polishes). data: { result: 'won'|'lost', wave }
export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  init(data) {
    this.result = data.result || 'lost';
    this.wave = data.wave || 0;
  }

  create() {
    const won = this.result === 'won';
    const title = this.add
      .text(640, 280, won ? 'The Grand Cru is safe!' : 'The cellar has fallen', {
        fontFamily: 'Cinzel, serif', fontStyle: '700', fontSize: '64px', color: won ? PALETTE.candleGold : PALETTE.wineRed,
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(640, 360, `Reached wave ${this.wave} of ${WAVES.length}`, {
        fontFamily: 'Cormorant Garamond, serif', fontStyle: '700', fontSize: '28px', color: PALETTE.parchment,
      })
      .setOrigin(0.5);
    const again = this.add
      .text(640, 460, 'Play again', {
        fontFamily: 'Cinzel, serif', fontStyle: '700', fontSize: '36px', color: PALETTE.amber,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    again.on('pointerover', () => again.setColor(PALETTE.candleGold));
    again.on('pointerout', () => again.setColor(PALETTE.amber));
    again.on('pointerdown', () => this.scene.start('Game'));

    [title, sub, again].forEach((o, i) => {
      o.setAlpha(0).y += 12;
      this.tweens.add({ targets: o, alpha: 1, y: o.y - 12, duration: 300, delay: i * 120, ease: 'Sine.easeOut' });
    });
  }
}
