// TEMPORARY in-scene UI so the core loop is playable before the real HUD
// scene (Task 8). Talks to GameScene only through scene.events. Delete this
// file and its single call in GameScene.create() when the HUD lands.
import { TOWERS } from '../config/towers.js';
import { WAVES } from '../config/waves.js';

const STYLE = { fontFamily: 'Cormorant Garamond, serif', fontStyle: '700', fontSize: '22px', color: '#e9dcc0', stroke: '#120a0d', strokeThickness: 4 };

export function createDebugHud(scene) {
  const ev = scene.events;
  const D = 5000;
  const items = [];
  const add = (o) => (items.push(o), o.setDepth(D).setAlpha(0));

  add(scene.add.rectangle(640, 680, 1280, 80, 0x120a0d, 0.75));
  const status = add(scene.add.text(16, 12, '', STYLE));
  const msg = add(scene.add.text(640, 600, '', { ...STYLE, color: '#ffb35c' }).setOrigin(0.5));
  const refresh = () => {
    const s = scene.state;
    status.setText(`Grapes ${s.grapes}    Lives ${s.lives}    Wave ${s.wave}/${WAVES.length}`);
  };
  refresh();

  const buttons = {};
  Object.entries(TOWERS).forEach(([type, cfg], i) => {
    const b = add(scene.add.text(110 + i * 220, 680, `${cfg.name} (${cfg.cost})`, STYLE).setOrigin(0.5));
    b.setInteractive({ useHandCursor: true }).on('pointerdown', () => ev.emit('select-tower', type));
    buttons[type] = b;
  });
  const next = add(scene.add.text(1180, 680, 'Next wave', { ...STYLE, color: '#e8c07a' }).setOrigin(0.5));
  next.setInteractive({ useHandCursor: true }).on('pointerdown', () => ev.emit('start-wave'));

  scene.tweens.add({ targets: items, alpha: 1, duration: 250 });

  const flash = (text) => {
    msg.setText(text).setAlpha(1);
    scene.tweens.killTweensOf(msg);
    scene.tweens.add({ targets: msg, alpha: 0, delay: 900, duration: 300 });
  };

  ev.on('grapes-changed', refresh);
  ev.on('lives-changed', refresh);
  ev.on('wave-started', (i) => (refresh(), flash(`Wave ${i + 1}`)));
  ev.on('wave-cleared', (i) => (refresh(), flash(`Wave ${i + 1} cleared`)));
  ev.on('placement-refused', (r) => flash(`Can't build: ${r}`));
  ev.on('upgrade-refused', (r) => flash(`Can't upgrade: ${r}`));
  ev.on('tower-upgraded', (t) => flash(`${TOWERS[t.type].upgrades[t.level - 1].name}!`));
  ev.on('tower-selected', (sel) => {
    for (const [type, b] of Object.entries(buttons)) b.setColor(type === sel ? '#ffb35c' : '#e9dcc0');
  });
  // Listeners are removed by GameScene.cleanup() (GAME_EVENTS) on shutdown.
}
