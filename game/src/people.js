// GOLDEN TIDE — people: beachgoers and city pedestrians who stroll the
// sidewalks and flee gunfire, plus Voss goons — armed enemies for missions.

import * as THREE from 'three';
import { TUNE } from './config.js';

const SHIRTS = [0xff5a7a, 0x2ad4c4, 0xffd76a, 0x8a5ac8, 0xf2f2f2, 0x3a7ac8, 0xff9d5a, 0x7ac83a];

function makePersonMesh(shirt, pants, skin = 0xd8a078) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.0, 8),
    new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.78; g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  const l1 = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.55, 6), legMat);
  l1.position.set(-0.14, 0.28, 0); g.add(l1);
  const l2 = l1.clone(); l2.position.x = 0.14; g.add(l2);
  g.userData.legs = [l1, l2];
  g.userData.isPerson = true;
  return g;
}

export class Ped {
  constructor(mesh, x, z) {
    this.mesh = mesh; this.x = x; this.z = z;
    this.heading = Math.random() * Math.PI * 2;
    this.speed = 1.2 + Math.random() * 1.2;
    this.fleeing = false; this.fleeT = 0;
    this.health = 100; this.dead = false;
    this.walkPhase = Math.random() * 6;
    this.target = null;
  }
}

export class PeopleSystem {
  constructor(scene, city) {
    this.scene = scene; this.city = city;
    this.peds = [];
    for (let i = 0; i < TUNE.pedCount; i++) {
      const x = -540 + Math.random() * 1080, z = -540 + Math.random() * 1080;
      const mesh = makePersonMesh(SHIRTS[i % SHIRTS.length], 0x2a2a3a);
      const ped = new Ped(mesh, x, z);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh); this.peds.push(ped);
    }
    this.goons = [];
  }

  spawnGoons(x, z, count) {
    const spawned = [];
    for (let i = 0; i < count; i++) {
      const gx = x + (Math.random() - 0.5) * 26, gz = z + (Math.random() - 0.5) * 26;
      const mesh = makePersonMesh(0x1a1a1a, 0x1a1a1a, 0xc89878);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.7),
        new THREE.MeshLambertMaterial({ color: 0x111111 }));
      gun.position.set(0.3, 1.2, 0.5); mesh.add(gun);
      const goon = new Ped(mesh, gx, gz);
      goon.health = 100; goon.isGoon = true; goon.shootCd = 1 + Math.random();
      mesh.position.set(gx, 0, gz);
      this.scene.add(mesh); this.goons.push(goon); spawned.push(goon);
    }
    return spawned;
  }

  clearGoons() {
    for (const g of this.goons) this.scene.remove(g.mesh);
    this.goons = [];
  }

  fleeFrom(x, z, radius = 40) {
    for (const p of this.peds) {
      if (Math.hypot(p.x - x, p.z - z) < radius) {
        p.fleeing = true; p.fleeT = 3 + Math.random() * 2;
        p.heading = Math.atan2(p.x - x, p.z - z);
      }
    }
  }

  update(dt, playerPos) {
    for (const p of this.peds) {
      if (p.dead) continue;
      if (p.fleeing) {
        p.fleeT -= dt;
        if (p.fleeT <= 0) p.fleeing = false;
      } else if (!p.target || Math.hypot(p.target[0] - p.x, p.target[1] - p.z) < 4) {
        // Wander to a nearby sidewalk point.
        p.target = [p.x + (Math.random() - 0.5) * 120, p.z + (Math.random() - 0.5) * 120];
        p.target[0] = Math.max(-560, Math.min(560, p.target[0]));
        p.target[1] = Math.max(-560, Math.min(560, p.target[1]));
      }
      if (p.target) {
        const desired = Math.atan2(p.target[0] - p.x, p.target[1] - p.z);
        p.heading += (desired - p.heading) * Math.min(1, dt * 4);
      }
      const sp = p.fleeing ? p.speed * 3.2 : p.speed;
      const nx = p.x + Math.sin(p.heading) * sp * dt;
      const nz = p.z + Math.cos(p.heading) * sp * dt;
      const res = this.city.slide(p.x, p.z, nx, nz, 0.6);
      p.x = res.x; p.z = res.z;
      p.walkPhase += dt * sp * 3;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      p.mesh.userData.legs[0].rotation.x = Math.sin(p.walkPhase) * 0.5;
      p.mesh.userData.legs[1].rotation.x = -Math.sin(p.walkPhase) * 0.5;
    }
    // Goons advance on the player and fire.
    for (const g of this.goons) {
      if (g.dead) continue;
      const d = Math.hypot(playerPos.x - g.x, playerPos.z - g.z);
      const desired = Math.atan2(playerPos.x - g.x, playerPos.z - g.z);
      g.heading += (desired - g.heading) * Math.min(1, dt * 5);
      if (d > 14) {
        const nx = g.x + Math.sin(g.heading) * 3.4 * dt;
        const nz = g.z + Math.cos(g.heading) * 3.4 * dt;
        const res = this.city.slide(g.x, g.z, nx, nz, 0.6);
        g.x = res.x; g.z = res.z;
        g.walkPhase += dt * 10;
      }
      g.mesh.position.set(g.x, 0, g.z);
      g.mesh.rotation.y = g.heading;
      g.mesh.userData.legs[0].rotation.x = Math.sin(g.walkPhase) * 0.5;
      g.mesh.userData.legs[1].rotation.x = -Math.sin(g.walkPhase) * 0.5;
      g.shootCd -= dt;
    }
  }
}
