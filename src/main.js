import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { EndScene } from './scenes/EndScene.js';
import { HUDScene } from './scenes/HUDScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'game',
  backgroundColor: '#120a0d',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // HUD after Game: array order is render order, so the HUD draws on top.
  scene: [BootScene, TitleScene, GameScene, HUDScene, EndScene],
});

if (import.meta.env.DEV) window.__game = game;
