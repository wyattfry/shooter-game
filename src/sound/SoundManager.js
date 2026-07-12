import Phaser from 'phaser';

const VARIANTS = {
  shoot: ['shoot-a', 'shoot-b', 'shoot-c', 'shoot-d', 'shoot-e', 'shoot-f', 'shoot-g', 'shoot-h'],
  explosion: ['explosion-a', 'explosion-b', 'explosion-c'],
  hurt: ['hurt-a', 'hurt-b', 'hurt-c', 'hurt-d', 'hurt-e'],
  coin: ['coin-a', 'coin-b', 'coin-c', 'coin-d'],
  lose: ['lose-a', 'lose-b', 'lose-c', 'lose-d']
};

const SINGLES = {
  select: 'select-a',
  error: 'error-a',
  jump: 'jump-a',
  fall: 'fall-a',
  move: 'move-a'
};

export function preloadSounds(scene) {
  Object.values(VARIANTS).flat().forEach(key => scene.load.audio(key, `sounds/${key}.ogg`));
  Object.values(SINGLES).forEach(key => scene.load.audio(key, `sounds/${key}.ogg`));
}

function playKey(scene, key, config) {
  if (!scene.sound.get(key) && !scene.cache.audio.exists(key)) return;
  scene.sound.play(key, config);
}

function playVariant(scene, category, config) {
  const keys = VARIANTS[category];
  if (!keys) return;
  playKey(scene, Phaser.Utils.Array.GetRandom(keys), config);
}

export function playShoot(scene, config) {
  playVariant(scene, 'shoot', { volume: 0.35, ...config });
}

export function playExplosion(scene, config) {
  playVariant(scene, 'explosion', { volume: 0.5, ...config });
}

export function playHurt(scene, config) {
  playVariant(scene, 'hurt', { volume: 0.5, ...config });
}

export function playCoin(scene, config) {
  playVariant(scene, 'coin', { volume: 0.4, ...config });
}

export function playLose(scene, config) {
  playVariant(scene, 'lose', { volume: 0.6, ...config });
}

export function playSelect(scene, config) {
  playKey(scene, SINGLES.select, { volume: 0.4, ...config });
}

export function playError(scene, config) {
  playKey(scene, SINGLES.error, { volume: 0.4, ...config });
}
