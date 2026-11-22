// GOLDEN TIDE — combat: four weapon tiers, hitscan shooting with tracers,
// muzzle flashes, explosions, and damage to the player.

import * as THREE from 'three';
import { WEAPONS } from './config.js';

export class Combat {
  constructor(scene, audio) {
    this.scene = scene; this.audio = audio;
    this.weaponIdx = 0;
    this.ammo = WEAPONS.map((w) => w.mag);
    this.reserve = WEAPONS.map(() => 60);
    this.cooldown = 0;
    this.tracers = [];
    this.flashes = [];
    this.explosions = [];
    this.raycaster = new THREE.Raycaster();
  }

  get weapon() { return WEAPONS[this.weaponIdx]; }

  switchWeapon(i) {
    if (i < 0 || i >= WEAPONS.length) return;
    this.weaponIdx = i; this.audio.click();
  }

  reload() {
    const w = this.weapon;
    if (this.ammo[this.weaponIdx] === w.mag || this.reserve[this.weaponIdx] <= 0) return;
    const need = w.mag - this.ammo[this.weaponIdx];
    const take = Math.min(need, this.reserve[this.weaponIdx]);
    this.reserve[this.weaponIdx] -= take;
    this.ammo[this.weaponIdx] += take;
    this.audio.blip(440, 0.08, 'square', 0.1);
  }

  /** Fire from `origin` toward `dir`. Returns the list of hit goons/peds. */
  fire(origin, dir, targets) {
    if (this.cooldown > 0) return [];
    const w = this.weapon;
    if (this.ammo[this.weaponIdx] <= 0) { this.audio.blip(180, 0.06, 'square', 0.1); this.cooldown = 0.25; return []; }
    this.cooldown = w.rate;
    this.ammo[this.weaponIdx]--;
    this.audio.gunshot(w.name === 'Shotgun' || w.name === 'Rifle');
    const pellets = w.pellets || 1;
    const hits = [];
    for (let p = 0; p < pellets; p++) {
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * w.spread * 2;
      d.y += (Math.random() - 0.5) * w.spread * 2;
      d.z += (Math.random() - 0.5) * w.spread * 2;
      d.normalize();
      this.raycaster.set(origin, d);
      this.raycaster.far = w.range;
      const meshes = targets.filter((t) => !t.dead).map((t) => t.mesh);
      const found = this.raycaster.intersectObjects(meshes, true);
      const end = found.length ? found[0].point.clone() : origin.clone().add(d.clone().multiplyScalar(w.range));
      this.addTracer(origin, end, w.color);
      if (found.length) {
        let obj = found[0].object;
        while (obj && !obj.userData.isPerson) obj = obj.parent;
        const target = targets.find((t) => t.mesh === obj || (obj && t.mesh === obj.parent));
        if (target && !hits.includes(target)) {
          target.health -= w.damage;
          if (target.health <= 0) { target.dead = true; target.mesh.visible = false; }
          hits.push(target);
        }
      }
    }
    // Muzzle flash light.
    const flash = new THREE.PointLight(0xffc978, 60, 14, 1.8);
    flash.position.copy(origin).add(dir.clone().multiplyScalar(1.2));
    this.scene.add(flash);
    this.flashes.push({ light: flash, t: 0.06 });
    return hits;
  }

  addTracer(from, to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, t: 0.09 });
  }

  explode(pos, radius = 9) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9 }));
    mesh.position.copy(pos); mesh.scale.setScalar(0.5);
    this.scene.add(mesh);
    const light = new THREE.PointLight(0xff7a2a, 400, 40, 1.6);
    light.position.copy(pos); this.scene.add(light);
    this.explosions.push({ mesh, light, t: 0, radius });
    this.audio.explosion();
  }

  /** Goon return fire: a goon shoots at the player; returns damage dealt. */
  goonShot(goon, playerPos) {
    const d = Math.hypot(playerPos.x - goon.x, playerPos.z - goon.z);
    if (d > 55) return 0;
    const from = new THREE.Vector3(goon.x, 1.4, goon.z);
    const to = new THREE.Vector3(playerPos.x, 1.2, playerPos.z);
    const dir = to.clone().sub(from).normalize();
    dir.x += (Math.random() - 0.5) * 0.06; dir.y += (Math.random() - 0.5) * 0.06;
    this.addTracer(from, from.clone().add(dir.clone().multiplyScalar(d)), 0xff6a5a);
    this.audio.gunshot(false);
    return Math.random() < 0.3 ? 6 + Math.random() * 8 : 0;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]; t.t -= dt;
      t.line.material.opacity = Math.max(0, t.t / 0.09) * 0.9;
      if (t.t <= 0) { this.scene.remove(t.line); t.line.geometry.dispose(); this.tracers.splice(i, 1); }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]; f.t -= dt;
      if (f.t <= 0) { this.scene.remove(f.light); this.flashes.splice(i, 1); }
    }
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const e = this.explosions[i]; e.t += dt;
      const k = e.t / 0.7;
      if (k >= 1) { this.scene.remove(e.mesh); this.scene.remove(e.light); this.explosions.splice(i, 1); continue; }
      e.mesh.scale.setScalar(0.5 + k * e.radius);
      e.mesh.material.opacity = 0.9 * (1 - k);
      e.light.intensity = 400 * (1 - k);
    }
  }
}
