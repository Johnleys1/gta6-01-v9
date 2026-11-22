// GOLDEN TIDE — HUD: wanted stars, cash, respect, minimap, objective,
// health, ammo, speed, radio, clock, toasts, damage flash.

import { DISTRICTS, WEAPONS, RADIOS } from './config.js';

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['wanted', 'cash', 'respect', 'objective', 'health', 'healthfill', 'ammo', 'speed', 'radio', 'toast', 'clock', 'damage', 'crosshair']) {
      this.el[id] = document.getElementById(id);
    }
    this.mm = document.getElementById('minimap');
    this.mmCtx = this.mm.getContext('2d');
    this.toastT = 0;
  }

  toast(title, sub = '') {
    this.el.toast.innerHTML = `${title}<small>${sub}</small>`;
    this.toastT = 4;
  }

  update(dt, s) {
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < s.wanted ? '★' : '☆';
    this.el.wanted.textContent = stars;
    this.el.wanted.style.color = s.wanted >= 4 ? '#ff5a5a' : '#ffd76a';
    this.el.cash.textContent = `$${s.cash.toLocaleString()}`;
    this.el.respect.textContent = `${s.district.name} · Respect ${s.respect[s.district.name] || 0} · ${s.district.desc}`;
    // Health / ammo / speed / radio / clock.
    this.el.healthfill.style.width = `${Math.max(0, s.health)}%`;
    const w = WEAPONS[s.weaponIdx];
    this.el.ammo.textContent = `${w.name}  ${s.ammo[s.weaponIdx]} / ${s.reserve[s.weaponIdx]}  ·  1-4 switch · R reload`;
    this.el.speed.innerHTML = s.inCar
      ? `<b>${Math.round(Math.abs(s.speed) * 2.4)}</b> km/h<br>${s.carName || 'Car'} · Shift boost · Space brake`
      : 'ON FOOT<br>E near a car to steal it';
    this.el.radio.textContent = s.radioOn ? `♪ ${RADIOS[s.radioStation % RADIOS.length].name}` : 'Radio off — press Q';
    const hh = 17 + Math.floor(s.timeOfDay * 2), mm = Math.floor((s.timeOfDay * 120) % 60);
    this.el.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${s.timeOfDay < 0.5 ? 'Golden hour' : s.timeOfDay < 0.8 ? 'Sunset' : 'Neon dusk'}`;
    // Objective.
    const obj = s.objective;
    this.el.objective.innerHTML = obj.main ? `${obj.main}<small>${obj.sub || ''}</small>` : '';
    // Toast timer.
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.el.toast.textContent = ''; }
    // Damage flash.
    this.el.damage.style.opacity = s.health < 40 ? String(0.5 - s.health / 100) : '0';
    this.el.crosshair.style.display = s.inCar ? 'none' : 'block';
    this.drawMinimap(s);
  }

  drawMinimap(s) {
    const g = this.mmCtx, W = 180, H = 140;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(8,12,30,0.85)'; g.fillRect(0, 0, W, H);
    const px = (x) => (x + 600) / 1200 * W, pz = (z) => (z + 600) / 1200 * H;
    // Ocean + sand on the west edge.
    g.fillStyle = '#1a7a9a'; g.fillRect(0, 0, px(-560), H);
    g.fillStyle = '#e8c98a'; g.fillRect(px(-560), 0, px(-470) - px(-560), H);
    // Roads.
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
    for (let v = -450; v <= 450; v += 150) {
      g.beginPath(); g.moveTo(px(v), 0); g.lineTo(px(v), H); g.stroke();
      g.beginPath(); g.moveTo(0, pz(v)); g.lineTo(W, pz(v)); g.stroke();
    }
    // Districts.
    for (const d of DISTRICTS) {
      g.fillStyle = d.color + '33'; g.beginPath(); g.arc(px(d.x), pz(d.z), d.r / 1200 * W, 0, 7); g.fill();
    }
    // Mission beacon.
    if (s.beacon) {
      g.fillStyle = '#ffd76a'; g.beginPath(); g.arc(px(s.beacon.x), pz(s.beacon.z), 5, 0, 7); g.fill();
      g.strokeStyle = '#ffd76a'; g.beginPath(); g.arc(px(s.beacon.x), pz(s.beacon.z), 8 + Math.sin(performance.now() / 200) * 2, 0, 7); g.stroke();
    }
    if (s.sideBeacon) {
      g.fillStyle = '#8affc1'; g.beginPath(); g.arc(px(s.sideBeacon.x), pz(s.sideBeacon.z), 4, 0, 7); g.fill();
    }
    // Traffic (grey), police (red/blue), goons (red).
    g.fillStyle = 'rgba(255,255,255,0.6)';
    for (const c of s.traffic) g.fillRect(px(c.x) - 1.5, pz(c.z) - 1.5, 3, 3);
    for (const c of s.police) { g.fillStyle = '#ff5a5a'; g.beginPath(); g.arc(px(c.x), pz(c.z), 3, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; }
    for (const c of s.goons) { g.fillStyle = '#ff2222'; g.fillRect(px(c.x) - 2, pz(c.z) - 2, 4, 4); g.fillStyle = 'rgba(255,255,255,0.6)'; }
    // Player arrow.
    g.save();
    g.translate(px(s.player.x), pz(s.player.z)); g.rotate(Math.atan2(Math.sin(s.heading), Math.cos(s.heading)) * 0 + s.heading);
    g.fillStyle = '#ffd76a';
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath(); g.fill();
    g.restore();
    if (s.heli) { g.fillStyle = '#2266ff'; g.beginPath(); g.arc(px(s.heli.x), pz(s.heli.z), 4, 0, 7); g.fill(); }
  }
}
