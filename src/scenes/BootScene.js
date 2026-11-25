import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const go = () => this.scene.start('Title');
    // document.fonts.ready alone resolves before unused webfonts are fetched,
    // so request each face explicitly. Don't hang if offline.
    const loads = Promise.all([
      document.fonts.load('700 48px Cinzel'),
      document.fonts.load('600 48px Cinzel'),
      document.fonts.load('500 24px "Cormorant Garamond"'),
      document.fonts.load('700 24px "Cormorant Garamond"'),
    ]).then(() => document.fonts.ready);
    Promise.race([loads, new Promise((r) => setTimeout(r, 2500))]).then(go, go);
  }
}
