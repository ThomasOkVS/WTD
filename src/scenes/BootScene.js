import Phaser from 'phaser';
import { hdCamera } from '../ui/hd.js';
import { generateTextures } from '../art/textures.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    hdCamera(this); // HD canvas, same 1280x720 world
    let started = false;
    // Generate after fonts load so Cinzel/Cormorant are ready for the first Text objects.
    const go = () => {
      if (started) return;
      started = true;
      generateTextures(this);
      this.scene.start('Title');
    };
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
