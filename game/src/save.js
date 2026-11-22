// GOLDEN TIDE — saves: cash, campaign progress, garage upgrades, respect,
// and bests, in localStorage. Loading a save never throws.

import { TUNE } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(TUNE.saveKey);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || s === null) return null;
    return s;
  } catch (e) { return null; }
}

export function writeSave(state) {
  try {
    localStorage.setItem(TUNE.saveKey, JSON.stringify({
      cash: state.cash, missionIdx: state.missionIdx, engineLv: state.engineLv,
      armorLv: state.armorLv, paint: state.paint, respect: state.respect,
      radioStation: state.radioStation, timeOfDay: state.timeOfDay, savedAt: Date.now(),
    }));
  } catch (e) { /* storage full or blocked: the game still plays */ }
}

export function clearSave() {
  try { localStorage.removeItem(TUNE.saveKey); } catch (e) {}
}
