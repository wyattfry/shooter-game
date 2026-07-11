const COINS_KEY = 'shooter.coins';
const UNLOCKS_KEY = 'shooter.unlockedWeapons';

const DEFAULT_UNLOCKED = ['m4a1'];

export function getCoins() {
  const raw = localStorage.getItem(COINS_KEY);
  const value = raw === null ? 0 : parseInt(raw, 10);
  return Number.isFinite(value) ? value : 0;
}

export function addCoins(amount) {
  const total = getCoins() + amount;
  localStorage.setItem(COINS_KEY, String(total));
  return total;
}

export function spendCoins(amount) {
  const current = getCoins();
  if (current < amount) return false;
  localStorage.setItem(COINS_KEY, String(current - amount));
  return true;
}

export function getUnlockedWeapons() {
  const raw = localStorage.getItem(UNLOCKS_KEY);
  if (!raw) return [...DEFAULT_UNLOCKED];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...DEFAULT_UNLOCKED];
  } catch {
    return [...DEFAULT_UNLOCKED];
  }
}

export function isWeaponUnlocked(key) {
  return getUnlockedWeapons().includes(key);
}

export function unlockWeapon(key) {
  const unlocked = getUnlockedWeapons();
  if (!unlocked.includes(key)) {
    unlocked.push(key);
    localStorage.setItem(UNLOCKS_KEY, JSON.stringify(unlocked));
  }
}
