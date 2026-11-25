import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { EndScene } from './scenes/EndScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { TastingScene } from './scenes/TastingScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { toggleMuted, isMuted } from './fx/sound.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'game',
  backgroundColor: '#120a0d',
  audio: { noAudio: true }, // we synthesise our own WebAudio (src/fx/sound.js)
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // HUD after Game: array order is render order, so the HUD draws on top.
  // Tasting after HUD: the modal draws (and takes input) above both.
  scene: [BootScene, TitleScene, GameScene, HUDScene, TastingScene, PauseScene, EndScene],
});

if (import.meta.env.DEV) Object.assign(window, { __game: game, __isMuted: isMuted });

// M mutes everywhere (Title, Game, a paused Game under the Tasting, End).
// One window listener: scene keyboards stop firing while their scene is paused.
window.addEventListener('keydown', (e) => {
  if (e.key && e.key.toLowerCase() === 'm' && !e.repeat) toggleMuted(); // the letter, whatever the layout
});
