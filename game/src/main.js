// GOLDEN TIDE — Solara Bay. Boot, input, the player on foot and behind the
// wheel, chase camera, the game loop, and the screenshot staging hook.

import * as THREE from 'three';
import { WORLD, TUNE, MISSIONS, WEAPONS, GARAGE, DISTRICTS } from './config.js';
import { City } from './city.js';
import { TrafficSystem, makeCarMesh, Car } from './vehicles.js';
import { PeopleSystem } from './people.js';
import { PoliceSystem } from './police.js';
import { Combat } from './combat.js';
import { MissionSystem } from './missions.js';
import { AudioEngine } from './audio.js';
import { HUD } from './hud.js';
import { loadSave, writeSave, clearSave } from './save.js';

const params = new URLSearchParams(location.search);
const SHOT_SCENE = params.get('scene');      // cover | race | heist | neon | marina
const AUTO_START = params.get('auto') === '1';

const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.5, 5000);
camera.position.set(-420, 40, 120);

const city = new City(scene);
const audio = new AudioEngine();
const traffic = new TrafficSystem(scene, city);
const people = new PeopleSystem(scene, city);
const police = new PoliceSystem(scene, city, audio);
const combat = new Combat(scene, audio);
const missions = new MissionSystem(scene, people, audio);
const hud = new HUD();

// ---- player state ----
const saved = loadSave();
const state = {
  mode: 'title',           // title | playing | paused | gameover
  cash: saved?.cash ?? 250,
  missionIdx: saved?.missionIdx ?? 0,
  engineLv: saved?.engineLv ?? 1,
  armorLv: saved?.armorLv ?? 1,
  paint: saved?.paint ?? 0xff7a2a,
  respect: saved?.respect ?? {},
  radioStation: saved?.radioStation ?? 0,
  radioOn: false,
  timeOfDay: saved?.timeOfDay ?? 0,
  health: TUNE.playerHealth,
  wanted: 0,
  inCar: false,
  speed: 0,
  weaponIdx: 0,
};

// Player on-foot avatar.
const playerMesh = (() => {
  const g = new THREE.Group();
  const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.05, 8),
    new THREE.MeshLambertMaterial({ color: 0xff7a2a }));
  jacket.position.y = 1.05; g.add(jacket);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xc89878 }));
  head.position.y = 1.82; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.31, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0x222233 }));
  cap.position.y = 2.02; g.add(cap);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const l1 = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.55, 6), legMat);
  l1.position.set(-0.15, 0.28, 0); g.add(l1);
  const l2 = l1.clone(); l2.position.x = 0.15; g.add(l2);
  g.userData.legs = [l1, l2];
  return g;
})();
scene.add(playerMesh);

const player = {
  x: -430, z: 120, heading: Math.PI / 2, onFoot: true,
  walkPhase: 0, car: null, speed: 0,
};
playerMesh.position.set(player.x, 0, player.z);

// The player's own car (starts parked on The Strand).
const playerCar = new Car(makeCarMesh(state.paint), -424, 128, Math.PI / 2);
playerCar.isPlayer = true; playerCar.engineLv = state.engineLv; playerCar.armorLv = state.armorLv;
scene.add(playerCar.mesh);

// ---- input ----
const keys = {};
let camYaw = player.heading, camPitch = 0.32;
let mouseDown = false;
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyP' && state.mode === 'playing') pauseGame();
  else if (e.code === 'KeyP' && state.mode === 'paused') resumeGame();
  if (e.code === 'KeyE' && state.mode === 'playing') tryEnterExitCar();
  if (e.code === 'KeyQ' && state.mode === 'playing') cycleRadio();
  if (e.code === 'KeyG' && state.mode === 'playing') tryGarage();
  if (e.code === 'KeyJ' && state.mode === 'playing') startSideJob();
  if (e.code === 'Digit1') combat.switchWeapon(0);
  if (e.code === 'Digit2') combat.switchWeapon(1);
  if (e.code === 'Digit3') combat.switchWeapon(2);
  if (e.code === 'Digit4') combat.switchWeapon(3);
  if (e.code === 'KeyR') combat.reload();
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('mousedown', (e) => {
  mouseDown = true;
  if (state.mode === 'playing' && !player.onFoot || state.mode === 'playing') shoot();
  if (state.mode === 'playing') { try { canvas.requestPointerLock(); } catch (err) {} }
});
window.addEventListener('mouseup', () => { mouseDown = false; });
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) camYaw -= e.movementX * 0.0032;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- actions ----
function tryEnterExitCar() {
  if (!player.onFoot) {
    // Step out: park the car, keep it as the player's car.
    player.onFoot = true; state.inCar = false;
    const bx = player.car.x - Math.sin(player.car.heading) * 3.5;
    const bz = player.car.z - Math.cos(player.car.heading) * 3.5;
    player.x = bx; player.z = bz; player.heading = player.car.heading;
    playerMesh.visible = true;
    audio.setEngine(0, false);
    return;
  }
  const near = traffic.nearestCar(player.x, player.z, 6) || (Math.hypot(playerCar.x - player.x, playerCar.z - player.z) < 6 ? playerCar : null);
  if (!near) return;
  if (near !== playerCar && near.isTraffic) {
    // Steal it: the old player car joins traffic, this one becomes the player's.
    traffic.cars.splice(traffic.cars.indexOf(near), 1);
    traffic.cars.push(playerCar); playerCar.isTraffic = true; playerCar.isPlayer = false;
    player.car = near; player.car.isPlayer = true; player.car.isTraffic = false;
    if (state.wanted < 1) setWanted(1);
    hud.toast('CAR JACKED', 'The law noticed. Lose them or pay up.');
  } else {
    player.car = playerCar;
  }
  player.onFoot = false; state.inCar = true;
  playerMesh.visible = false;
  audio.click();
}

function shoot() {
  if (state.mode !== 'playing' || combat.cooldown > 0) return;
  const origin = camera.position.clone();
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const targets = [...people.goons, ...people.peds];
  const hits = combat.fire(origin, dir, targets);
  for (const h of hits) {
    if (h.isGoon) missions.noteKill();
    else if (!h.dead) setWanted(Math.min(5, state.wanted + 1));
    people.fleeFrom(player.x, player.z, 50);
  }
}

function cycleRadio() {
  state.radioStation = (state.radioStation + 1) % 3;
  if (!state.radioOn) { state.radioOn = true; audio.setRadio(state.radioStation, true); }
  else audio.setRadio(state.radioStation, true);
  hud.toast(`RADIO: ${audio.radioName()}`, 'Q cycles stations');
}

function tryGarage() {
  // Garage sits in Old Coral at [150, 150].
  if (Math.hypot(player.x - 150, player.z - 150) > 14) {
    hud.toast('GARAGE', 'Drive to the Solara Garage in Old Coral (gold wrench on the map).');
    return;
  }
  document.getElementById('garage').style.display = 'block';
  refreshGarage();
}

function refreshGarage() {
  document.getElementById('gEng').textContent = state.engineLv;
  document.getElementById('gArm').textContent = state.armorLv;
  document.getElementById('gCash').textContent = `$${state.cash}`;
  document.getElementById('buyEng').textContent = state.engineLv >= GARAGE.engine.max ? 'MAX' : `$${Math.round(GARAGE.engine.base * GARAGE.engine.mult ** (state.engineLv - 1))}`;
  document.getElementById('buyArm').textContent = state.armorLv >= GARAGE.armor.max ? 'MAX' : `$${Math.round(GARAGE.armor.base * GARAGE.armor.mult ** (state.armorLv - 1))}`;
}
document.getElementById('buyEng').addEventListener('click', () => {
  const cost = Math.round(GARAGE.engine.base * GARAGE.engine.mult ** (state.engineLv - 1));
  if (state.engineLv < GARAGE.engine.max && state.cash >= cost) { state.cash -= cost; state.engineLv++; playerCar.engineLv = state.engineLv; audio.pickup(); refreshGarage(); save(); }
});
document.getElementById('buyArm').addEventListener('click', () => {
  const cost = Math.round(GARAGE.armor.base * GARAGE.armor.mult ** (state.armorLv - 1));
  if (state.armorLv < GARAGE.armor.max && state.cash >= cost) { state.cash -= cost; state.armorLv++; playerCar.armorLv = state.armorLv; audio.pickup(); refreshGarage(); save(); }
});
document.getElementById('buyPaint').addEventListener('click', () => {
  if (state.cash < GARAGE.paint.base) return;
  state.cash -= GARAGE.paint.base;
  state.paint = GARAGE.paint.colors[(GARAGE.paint.colors.indexOf(state.paint) + 1) % GARAGE.paint.colors.length];
  playerCar.mesh.children[0].material.color.setHex(state.paint);
  audio.pickup(); refreshGarage(); save();
});
document.getElementById('closeGarage').addEventListener('click', () => {
  document.getElementById('garage').style.display = 'none';
});

function startSideJob() {
  const kinds = ['taxi', 'deliver', 'race'];
  missions.startSideJob(kinds[Math.floor(Math.random() * kinds.length)], player);
}

function setWanted(level) {
  state.wanted = level;
  police.setWanted(level);
}

function save() {
  writeSave({
    cash: state.cash, missionIdx: missions.missionIdx, engineLv: state.engineLv,
    armorLv: state.armorLv, paint: state.paint, respect: state.respect,
    radioStation: state.radioStation, timeOfDay: state.timeOfDay,
  });
}

missions.onToast = (t, s) => hud.toast(t, s);
missions.onWanted = (level) => setWanted(Math.max(state.wanted, level));
missions.onMissionDone = (mission, pay) => {
  state.cash += pay;
  const d = city.districtAt(player.x, player.z);
  state.respect[d.name] = (state.respect[d.name] || 0) + 25;
  state.timeOfDay = Math.min(1, state.timeOfDay + 0.09);
  save();
  if (missions.missionIdx < MISSIONS.length) missions.startMission(missions.missionIdx);
  else setWanted(0);
};

// ---- flow ----
function startGame(fresh) {
  if (fresh) { clearSave(); state.cash = 250; state.missionIdx = 0; state.timeOfDay = 0; state.respect = {}; }
  audio.init();
  document.getElementById('title').style.display = 'none';
  document.getElementById('gameover').style.display = 'none';
  document.getElementById('pause').style.display = 'none';
  state.mode = 'playing';
  state.health = TUNE.playerHealth;
  setWanted(0);
  if (state.radioOn) audio.setRadio(state.radioStation, true);
  missions.startMission(Math.min(state.missionIdx, MISSIONS.length - 1));
  hud.toast('GOLDEN TIDE', 'Solara Bay is yours. Follow the gold beacon.');
}
function pauseGame() {
  state.mode = 'paused';
  document.getElementById('pause').style.display = 'flex';
  audio.setEngine(0, false); audio.setSiren(false);
}
function resumeGame() {
  state.mode = 'playing';
  document.getElementById('pause').style.display = 'none';
  audio.setSiren(state.wanted > 0);
}
function gameOver(reason) {
  state.mode = 'gameover';
  document.getElementById('gameoverText').textContent = reason;
  document.getElementById('gameover').style.display = 'flex';
  audio.setEngine(0, false); audio.setSiren(false);
}
document.getElementById('btnStart').addEventListener('click', () => startGame(true));
document.getElementById('btnContinue').addEventListener('click', () => startGame(false));
document.getElementById('btnResume').addEventListener('click', resumeGame);
document.getElementById('btnQuit').addEventListener('click', () => {
  document.getElementById('pause').style.display = 'none';
  document.getElementById('title').style.display = 'flex';
  state.mode = 'title'; save();
});
document.getElementById('btnRetry').addEventListener('click', () => {
  state.health = TUNE.playerHealth;
  player.x = -430; player.z = 120; player.onFoot = true; player.car = null;
  playerMesh.visible = true; state.inCar = false;
  setWanted(0);
  document.getElementById('gameover').style.display = 'none';
  state.mode = 'playing';
  missions.startMission(Math.min(missions.missionIdx, MISSIONS.length - 1));
});

// ---- screenshot staging (?scene=...) ----
function stageScene(name) {
  startGame(false);
  audio.init();
  const place = (x, z, heading, inCar) => {
    player.x = x; player.z = z; player.heading = heading;
    if (inCar) {
      player.car = playerCar; player.car.x = x; player.car.z = z; player.car.heading = heading;
      player.car.mesh.position.set(x, 0, z);
      player.onFoot = false; state.inCar = true; playerMesh.visible = false;
    } else { player.onFoot = true; state.inCar = false; playerMesh.visible = true; }
    camYaw = heading;
  };
  if (name === 'cover') {
    state.timeOfDay = 0.15;
    // Beach road heading south toward the marina: ocean on the right, palms clear of the lens.
    place(-450, -100, 0, true);
    playerCar.speed = 26;
    setWanted(3);
    // One patrol car head-on in the opposite lane (visible ahead), one chasing from behind.
    const p1 = police.spawnPatrol(player); p1.x = -442; p1.z = -40; p1.heading = Math.PI; p1.speed = 20;
    const p2 = police.spawnPatrol(player); p2.x = -446; p2.z = -130; p2.heading = 0; p2.speed = 24;
    police.spawnHeli();
    missions.startMission(0);
    window.__autoDrive = true;
  } else if (name === 'race') {
    state.timeOfDay = 0.4;
    place(180, -300, Math.PI / 2, true);
    playerCar.speed = 30;
    // Two rivals ahead on the same road.
    const r1 = traffic.spawnCar(); r1.x = 260; r1.z = -300; r1.heading = Math.PI / 2; r1.speed = 26;
    const r2 = traffic.spawnCar(); r2.x = 320; r2.z = -298; r2.heading = Math.PI / 2; r2.speed = 24;
    missions.startMission(3);
    window.__autoDrive = true;
  } else if (name === 'heist') {
    state.timeOfDay = 0.55;
    // Right at the pier edge: yachts and goons in the mid-ground, beacon behind them.
    place(-415, 330, 0.57, false);
    people.spawnGoons(-420, 338, 3);
    missions.startMission(1);
  } else if (name === 'neon') {
    state.timeOfDay = 0.88;
    place(60, -20, Math.PI * 0.75, false);
    people.spawnGoons(60, -40, 4);
    setWanted(2);
    missions.startMission(4);
  } else if (name === 'marina') {
    state.timeOfDay = 0.25;
    place(-420, 330, Math.PI * 1.1, true);
    missions.startMission(1);
  }
  city.update(0, state.timeOfDay, 0);
  updateCamera(0.016);
  renderer.render(scene, camera);
  window.__ready = true;
}

// ---- camera ----
function updateCamera(dt) {
  const target = player.onFoot ? player : player.car;
  const back = player.onFoot ? 10 : 11;
  const up = player.onFoot ? 5 : 6;
  const yaw = player.onFoot ? camYaw : target.heading;
  const cx = target.x - Math.sin(yaw) * back;
  const cz = target.z - Math.cos(yaw) * back;
  camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 5);
  camera.position.y += ((up + (player.onFoot ? 0 : 1.5)) - camera.position.y) * Math.min(1, dt * 5);
  camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 5);
  camera.lookAt(target.x, player.onFoot ? 1.8 : 1.4, target.z);
}

// ---- main loop ----
const clock = new THREE.Clock();
let elapsed = 0;
let autosaveT = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  if (state.mode !== 'playing') { renderer.render(scene, camera); return; }

  const input = {
    forward: keys.KeyW || keys.ArrowUp || (window.__autoDrive && !player.onFoot), back: keys.KeyS || keys.ArrowDown,
    left: keys.KeyA || keys.ArrowLeft, right: keys.KeyD || keys.ArrowRight,
    handbrake: keys.Space, boost: keys.ShiftLeft || keys.ShiftRight,
  };

  // Player movement.
  if (player.onFoot) {
    const run = input.boost ? 1.5 : 1;
    const sp = 7 * run;
    let mx = 0, mz = 0;
    const fwd = { x: Math.sin(camYaw), z: Math.cos(camYaw) };
    const rgt = { x: Math.cos(camYaw), z: -Math.sin(camYaw) };
    if (input.forward) { mx += fwd.x; mz += fwd.z; }
    if (input.back) { mx -= fwd.x; mz -= fwd.z; }
    if (input.right) { mx += rgt.x; mz += rgt.z; }
    if (input.left) { mx -= rgt.x; mz -= rgt.z; }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      player.heading = Math.atan2(mx, mz);
      const nx = player.x + mx * sp * dt, nz = player.z + mz * sp * dt;
      const res = city.slide(player.x, player.z, nx, nz, 0.7);
      player.x = Math.max(-590, Math.min(590, res.x));
      player.z = Math.max(-590, Math.min(590, res.z));
      player.walkPhase += dt * sp * 1.6;
      playerMesh.userData.legs[0].rotation.x = Math.sin(player.walkPhase) * 0.6;
      playerMesh.userData.legs[1].rotation.x = -Math.sin(player.walkPhase) * 0.6;
    }
    playerMesh.position.set(player.x, 0, player.z);
    playerMesh.rotation.y = player.heading;
    state.speed = len > 0 ? sp : 0;
  } else {
    player.car.update(dt, input, city);
    player.x = player.car.x; player.z = player.car.z; player.heading = player.car.heading;
    state.speed = player.car.speed;
    if (player.car.wrecked) {
      combat.explode(new THREE.Vector3(player.car.x, 1, player.car.z));
      player.car.wrecked = false; player.car.health = TUNE.carHealth; player.car.speed = 0;
      state.health -= 25;
      player.onFoot = true; state.inCar = false; playerMesh.visible = true;
      player.x = player.car.x - Math.sin(player.car.heading) * 4;
      player.z = player.car.z - Math.cos(player.car.heading) * 4;
      hud.toast('CAR WRECKED', 'Your ride blew. Find another one.');
    }
  }

  // Shooting while the mouse is held.
  if (mouseDown) shoot();

  // World systems.
  traffic.update(dt);
  people.update(dt, player);
  const policeOut = police.update(dt, player, { x: Math.sin(player.heading), z: Math.cos(player.heading) }, player.onFoot, city);
  if (policeOut.rammed && !player.onFoot && player.car) {
    player.car.health -= 12 * dt / (player.car.armor || 1);
  }
  combat.update(dt);
  city.update(dt, state.timeOfDay, elapsed);
  state.timeOfDay = Math.min(1, state.timeOfDay + dt * 0.0004);

  // Goon return fire.
  for (const g of people.goons) {
    if (g.dead || g.shootCd > 0) continue;
    const d = Math.hypot(player.x - g.x, player.z - g.z);
    if (d < 55) {
      g.shootCd = 1.4 + Math.random() * 0.8;
      state.health -= combat.goonShot(g, player);
    }
  }

  // Missions + side jobs.
  const obj = missions.update(dt, player, !player.onFoot);
  const sidePay = missions.updateSideJob(dt, player);
  if (sidePay) state.cash += sidePay;

  // Police bust / death.
  if (police.bustCheck(player, player.onFoot)) gameOver('BUSTED — Solara Bay PD took you in.');
  if (state.health <= 0) gameOver('WASTED — The tide took you.');

  // HUD + audio.
  hud.update(dt, {
    wanted: state.wanted, cash: state.cash, respect: state.respect,
    district: city.districtAt(player.x, player.z),
    health: state.health, weaponIdx: combat.weaponIdx,
    ammo: combat.ammo, reserve: combat.reserve,
    speed: state.speed, inCar: !player.onFoot, carName: player.car ? 'Sunset GT' : '',
    radioOn: state.radioOn, radioStation: state.radioStation,
    timeOfDay: state.timeOfDay, objective: obj,
    beacon: missions.beacon ? { x: missions.beacon.position.x, z: missions.beacon.position.z } : null,
    sideBeacon: missions.sideBeacon ? { x: missions.sideBeacon.position.x, z: missions.sideBeacon.position.z } : null,
    traffic: traffic.cars, police: police.cars, goons: people.goons.filter((g) => !g.dead),
    player, heading: player.heading,
    heli: police.heli ? { x: police.heli.position.x, z: police.heli.position.z } : null,
  });
  audio.setEngine(Math.abs(state.speed) / TUNE.playerMaxSpeed, !player.onFoot);

  // Autosave.
  autosaveT += dt;
  if (autosaveT > 20) { autosaveT = 0; save(); }

  updateCamera(dt);
  renderer.render(scene, camera);
}

window.__game = {
  state, player, missions, police, combat, traffic, people, city,
  errors,
  debug: {
    teleport(x, z) { player.x = x; player.z = z; if (player.car) { player.car.x = x; player.car.z = z; } },
    setWanted(n) { setWanted(n); },
    startMission(i) { missions.startMission(i); },
    giveCash(n) { state.cash += n; },
    save() { save(); },
    enterCar() { tryEnterExitCar(); },
    shootAt(x, z) {
      const origin = camera.position.clone();
      const dir = new THREE.Vector3(x - origin.x, 1.2 - origin.y, z - origin.z).normalize();
      return combat.fire(origin, dir, [...people.goons, ...people.peds]);
    },
  },
};

if (SHOT_SCENE) stageScene(SHOT_SCENE);
else if (AUTO_START) startGame(false);
animate();
