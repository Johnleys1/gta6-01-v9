// GOLDEN TIDE — Solara Bay PD: wanted stars, patrol cars that chase and ram,
// roadblocks and spike strips at high heat, and the GOLDEN-1 helicopter.

import * as THREE from 'three';
import { TUNE, ROAD_STEP } from './config.js';
import { makeCarMesh, Car } from './vehicles.js';

export class PoliceSystem {
  constructor(scene, city, audio) {
    this.scene = scene; this.city = city; this.audio = audio;
    this.wanted = 0;
    this.hiddenTimer = 0;
    this.cars = [];
    this.heli = null; this.heliLight = null; this.searchCone = null;
    this.roadblocks = [];
    this.spikes = [];
    this.spawnCd = 0;
    this.flashT = 0;
  }

  setWanted(level, silent = false) {
    this.wanted = Math.max(0, Math.min(5, level));
    if (this.wanted === 0) { this.clearPursuit(); }
    if (!silent) this.audio.setSiren(this.wanted > 0);
  }

  clearPursuit() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    this.cars = [];
    if (this.heli) { this.scene.remove(this.heli); this.heli = null; }
    if (this.searchCone) { this.scene.remove(this.searchCone); this.searchCone = null; }
    for (const b of this.roadblocks) this.scene.remove(b);
    this.roadblocks = [];
    for (const s of this.spikes) this.scene.remove(s);
    this.spikes = [];
    this.audio.setSiren(false);
  }

  spawnPatrol(playerPos) {
    const angle = Math.random() * Math.PI * 2;
    const x = playerPos.x + Math.cos(angle) * 90, z = playerPos.z + Math.sin(angle) * 90;
    const mesh = makeCarMesh(0x1a2a4a, true);
    const car = new Car(mesh, x, z, Math.atan2(playerPos.x - x, playerPos.z - z));
    car.isPolice = true;
    this.scene.add(mesh); this.cars.push(car);
    return car;
  }

  spawnHeli() {
    if (this.heli) return;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 7),
      new THREE.MeshPhongMaterial({ color: 0x1a2a4a, shininess: 60 }));
    body.position.y = 0; g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 6),
      new THREE.MeshPhongMaterial({ color: 0x1a2a4a }));
    tail.position.set(0, 0.4, -6); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 1),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rotor.position.y = 1.4; g.add(rotor);
    g.userData.rotor = rotor;
    const spot = new THREE.SpotLight(0xfff2c0, 800, 90, 0.35, 0.5, 1.2);
    spot.position.set(0, -1, 2); g.add(spot); g.add(spot.target); spot.target.position.set(0, -40, 6);
    this.heliLight = spot;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(7, 42, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
    cone.position.y = -22; g.add(cone);
    this.searchCone = cone;
    this.heli = g; this.scene.add(g);
  }

  spawnRoadblock(playerPos, heading) {
    const ahead = 55;
    const bx = playerPos.x + Math.sin(heading) * ahead;
    const bz = playerPos.z + Math.cos(heading) * ahead;
    const mat = new THREE.MeshLambertMaterial({ color: 0xd83a2a });
    for (const off of [-6, 0, 6]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 1), mat);
      const px = bx + Math.cos(heading) * off, pz = bz - Math.sin(heading) * off;
      bar.position.set(px, 0.7, pz); bar.rotation.y = heading;
      this.scene.add(bar); this.roadblocks.push(bar);
    }
    // Spike strip in front of the block.
    const spike = new THREE.Mesh(new THREE.BoxGeometry(8, 0.25, 1.4),
      new THREE.MeshLambertMaterial({ color: 0x333333 }));
    spike.position.set(bx, 0.12, bz); spike.rotation.y = heading;
    this.scene.add(spike);
    return { x: bx, z: bz };
  }

  update(dt, playerPos, playerSpeed, onFoot, city) {
    this.flashT += dt;
    // Wanted decays when the player is far from all pursuit and out of sight.
    if (this.wanted > 0) {
      const near = this.cars.some((c) => Math.hypot(c.x - playerPos.x, c.z - playerPos.z) < 60) || this.heli;
      if (!near) {
        this.hiddenTimer += dt;
        if (this.hiddenTimer > TUNE.wantedDecaySeconds) { this.setWanted(this.wanted - 1); this.hiddenTimer = 0; }
      } else this.hiddenTimer = 0;
    }
    // Keep enough patrol cars in play.
    this.spawnCd -= dt;
    const want = this.wanted >= 1 ? Math.min(4, 1 + Math.floor(this.wanted / 2)) : 0;
    if (this.cars.length < want && this.spawnCd <= 0) { this.spawnPatrol(playerPos); this.spawnCd = 2.5; }
    if (this.wanted >= 3) this.spawnHeli();
    // Patrol cars chase and ram.
    for (const car of this.cars) {
      const d = Math.hypot(playerPos.x - car.x, playerPos.z - car.z);
      const desired = Math.atan2(playerPos.x - car.x, playerPos.z - car.z);
      let dh = desired - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
      const target = Math.min(TUNE.policeSpeed, 18 + this.wanted * 6);
      car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const res = city.slide(car.x, car.z, nx, nz, 2.2);
      car.x = res.x; car.z = res.z;
      if (res.hit) car.speed *= 0.5;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
      // Flashing light bar.
      const on = Math.sin(this.flashT * 14) > 0;
      if (car.mesh.userData.lightR) {
        car.mesh.userData.lightR.material.color.setHex(on ? 0xff2233 : 0x551111);
        car.mesh.userData.lightB.material.color.setHex(on ? 0x112266 : 0x2266ff);
      }
      // Ram the player car.
      if (d < 3.4 && !onFoot) car.speed *= 0.92;
    }
    // Helicopter hovers above the player.
    if (this.heli) {
      const hx = playerPos.x + Math.sin(this.flashT * 0.5) * 12;
      const hz = playerPos.z + Math.cos(this.flashT * 0.4) * 12;
      this.heli.position.set(hx, 55, hz);
      this.heli.rotation.y += dt * 0.4;
      this.heli.userData.rotor.rotation.y += dt * 22;
      if (this.searchCone) this.searchCone.visible = true;
    }
    // Roadblocks at 4+ stars, roughly every 12 seconds.
    if (this.wanted >= 4 && this.roadblocks.length < 2 && Math.random() < dt * 0.09) {
      this.spawnRoadblock(playerPos, Math.atan2(playerSpeed.x, playerSpeed.z));
    }
    // Spike strips damage the player car.
    return { rammed: this.cars.some((c) => Math.hypot(c.x - playerPos.x, c.z - playerPos.z) < 3.2) };
  }

  /** Bust check: a patrol car touching the player on foot at low speed. */
  bustCheck(playerPos, onFoot) {
    if (!onFoot || this.wanted === 0) return false;
    return this.cars.some((c) => Math.hypot(c.x - playerPos.x, c.z - playerPos.z) < TUNE.bustRadius);
  }
}
