// GOLDEN TIDE — vehicles: arcade car physics, traffic AI, carjacking.
// One factory builds every car (player, traffic, police) from primitives.

import * as THREE from 'three';
import { TUNE, ROAD_STEP } from './config.js';

const CAR_COLORS = [0xff5a5a, 0x2ad4c4, 0xffd76a, 0x8a5ac8, 0xf2f2f2, 0x3a7ac8, 0xff9d5a, 0x9fe8ff];

export function makeCarMesh(color, isPolice = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshPhongMaterial({ color, shininess: 70, specular: 0x888888 });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x182838, shininess: 120 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.6), bodyMat);
  body.position.y = 0.75; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.35, -0.3); g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w); wheels.push(w);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2233ff }));
    bar.position.set(0, 1.8, -0.3); g.add(bar);
    const lightR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.24, 0.52),
      new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    lightR.position.set(-0.4, 1.82, -0.3); g.add(lightR);
    const lightB = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.24, 0.52),
      new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    lightB.position.set(0.4, 1.82, -0.3); g.add(lightB);
    g.userData.lightR = lightR; g.userData.lightB = lightB;
    const star = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    star.position.set(-1.06, 1.0, 0.4); g.add(star);
    const star2 = star.clone(); star2.position.x = 1.06; g.add(star2);
  }
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  constructor(mesh, x, z, heading) {
    this.mesh = mesh; this.x = x; this.z = z; this.heading = heading;
    this.speed = 0; this.health = TUNE.carHealth; this.isPlayer = false;
    this.engineLv = 1; this.armorLv = 1; this.paint = 0xff7a2a;
    this.wrecked = false; this.smoke = 0;
  }
  get maxSpeed() { return TUNE.playerMaxSpeed * (0.55 + 0.18 * this.engineLv); }
  get armor() { return 1 + 0.25 * (this.armorLv - 1); }

  update(dt, input, city) {
    if (this.wrecked) return;
    const accel = input.forward ? TUNE.playerAccel : input.back ? -TUNE.playerBrake * 0.6 : 0;
    const target = input.forward ? this.maxSpeed : input.back ? -this.maxSpeed * 0.45 : 0;
    if (accel !== 0) this.speed += accel * dt * (this.speed < target ? 1 : 0.2);
    else this.speed *= Math.max(0, 1 - 2.2 * dt); // coast
    if (input.back && this.speed > 0.5) this.speed -= TUNE.playerBrake * dt; // brake
    if (input.handbrake) this.speed *= Math.max(0, 1 - 4 * dt);
    if (input.boost) this.speed = Math.min(this.speed + 14 * dt, this.maxSpeed * 1.25);
    this.speed = Math.max(-this.maxSpeed * 0.45, Math.min(this.speed, this.maxSpeed * 1.25));
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const dir = this.speed >= 0 ? 1 : -1;
    this.heading += steer * TUNE.playerTurn * dt * Math.min(1, Math.abs(this.speed) / 8) * dir;
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const res = city.slide(this.x, this.z, nx, nz, 2.2);
    if (res.hit) { if (Math.abs(this.speed) > 12) this.health -= Math.abs(this.speed) * 0.4; this.speed *= 0.45; }
    this.x = Math.max(-590, Math.min(590, res.x));
    this.z = Math.max(-590, Math.min(590, res.z));
    if (this.health <= 0) { this.wrecked = true; }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * dt * 2.4;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
  }
}

export class TrafficSystem {
  constructor(scene, city) {
    this.scene = scene; this.city = city; this.cars = [];
    this.waypoints = [];
    for (let v = -450; v <= 450; v += ROAD_STEP) {
      for (let u = -450; u <= 450; u += ROAD_STEP) this.waypoints.push([v, u]);
    }
    for (let i = 0; i < TUNE.trafficCount; i++) this.spawnCar();
  }

  spawnCar() {
    const [x, z] = this.waypoints[Math.floor(Math.random() * this.waypoints.length)];
    const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    const mesh = makeCarMesh(color);
    const heading = Math.floor(Math.random() * 4) * Math.PI / 2;
    const car = new Car(mesh, x + (Math.random() - 0.5) * 8, z + (Math.random() - 0.5) * 8, heading);
    car.isTraffic = true;
    this.scene.add(mesh); this.cars.push(car);
    return car;
  }

  /** Traffic follows the street grid: pick the next intersection, steer toward it. */
  update(dt) {
    for (const car of this.cars) {
      if (car.wrecked) continue;
      // Nearest intersection ahead.
      const gx = Math.round(car.x / ROAD_STEP) * ROAD_STEP;
      const gz = Math.round(car.z / ROAD_STEP) * ROAD_STEP;
      const tx = Math.abs(car.x - gx) < 6 ? car.x : gx;
      const tz = Math.abs(car.z - gz) < 6 ? car.z : gz;
      const desired = Math.atan2(tx - car.x, tz - car.z);
      let dh = desired - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
      car.speed += (TUNE.trafficSpeed - car.speed) * Math.min(1, dt * 1.5);
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const res = this.city.slide(car.x, car.z, nx, nz, 2.2);
      car.x = res.x; car.z = res.z;
      if (res.hit) { car.heading += Math.PI / 2; car.speed *= 0.5; }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
      // Respawn far-away wrecks as fresh traffic.
      if (car.wrecked) { this.scene.remove(car.mesh); this.cars.splice(this.cars.indexOf(car), 1); this.spawnCar(); }
    }
  }

  nearestCar(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const c of this.cars) {
      if (c.wrecked) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
}
