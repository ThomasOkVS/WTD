import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { EndScene } from './scenes/EndScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { TastingScene } from './scenes/TastingScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { toggleMuted, isMuted } from './fx/sound.js';
import { toggleProjector } from './fx/projector.js';
import { HD } from './ui/hd.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  // HD canvas: every scene camera zooms HD x around the 1280x720 world (src/ui/hd.js)
  width: 1280 * HD,
  height: 720 * HD,
  parent: 'game',
  backgroundColor: '#120a0d',
  audio: { noAudio: true }, // we synthesise our own WebAudio (src/fx/sound.js)
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // perf: ask for the discrete GPU; no MSAA on the main framebuffer (texture smoothing is unaffected)
  render: { powerPreference: 'high-performance', antialiasGL: false },
  // HUD after Game: array order is render order, so the HUD draws on top.
  // Tasting after HUD: the modal draws (and takes input) above both.
  scene: [BootScene, TitleScene, GameScene, HUDScene, TastingScene, PauseScene, EndScene],
});

if (import.meta.env.DEV) Object.assign(window, { __game: game, __isMuted: isMuted });

// M mutes and L toggles projector mode everywhere (Title, Game, a paused Game under the Tasting, End).
// One window listener: scene keyboards stop firing while their scene is paused.
window.addEventListener('keydown', (e) => {
  if (!e.key || e.repeat) return;
  const k = e.key.toLowerCase(); // the letter, whatever the layout
  if (k === 'm') toggleMuted();
  if (k === 'l') toggleProjector(); // brighter cellar for a projector (remembered)
});
