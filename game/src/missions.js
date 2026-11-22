// GOLDEN TIDE — story: the 10-job campaign against Don Alvaro Voss, plus
// taxi / delivery / street-race side jobs, with beacons, dialogue and pay.

import * as THREE from 'three';
import { MISSIONS, SIDE_JOBS } from './config.js';

export function makeBeacon(color = 0xffd76a) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 90, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 45; g.add(beam);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.6),
    new THREE.MeshBasicMaterial({ color }));
  diamond.position.y = 7; g.add(diamond);
  g.userData.diamond = diamond;
  const ring = new THREE.Mesh(new THREE.RingGeometry(3, 4.4, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
  return g;
}

export class MissionSystem {
  constructor(scene, people, audio) {
    this.scene = scene; this.people = people; this.audio = audio;
    this.missionIdx = 0;         // 0-based into MISSIONS
    this.stepIdx = 0;
    this.active = false;
    this.beacon = null;
    this.racePoints = [];
    this.raceIdx = 0;
    this.killTarget = 0; this.kills = 0;
    this.surviveT = 0;
    this.sideJob = null;         // {kind, stage, at, pay}
    this.sideBeacon = null;
    this.onMissionDone = null;   // (mission, pay) => void
    this.onToast = null;         // (title, sub) => void
    this.onWanted = null;        // (level) => void
  }

  get mission() { return MISSIONS[this.missionIdx]; }
  get step() { return this.mission ? this.mission.steps[this.stepIdx] : null; }
  get done() { return this.missionIdx >= MISSIONS.length; }

  toast(title, sub = '') { if (this.onToast) this.onToast(title, sub); }

  startMission(idx) {
    this.missionIdx = idx; this.stepIdx = 0; this.active = true;
    this.toast(`JOB ${this.mission.id}: ${this.mission.name}`, `${this.mission.giver}: ${this.mission.brief}`);
    this.enterStep();
  }

  enterStep() {
    const s = this.step;
    if (!s) { this.finishMission(); return; }
    this.clearBeacon();
    this.kills = 0; this.raceIdx = 0; this.racePoints = [];
    if (s.type === 'drive' || s.type === 'kill' || s.type === 'survive') {
      const at = s.at;
      this.beacon = makeBeacon(s.type === 'kill' ? 0xff5a5a : 0xffd76a);
      this.beacon.position.set(at[0], 0, at[1]);
      this.scene.add(this.beacon);
      if (s.type === 'kill') {
        this.killTarget = s.count;
        this.people.spawnGoons(at[0], at[1], s.count);
      }
      if (s.type === 'survive') this.surviveT = s.seconds;
    }
    if (s.type === 'race') {
      this.racePoints = s.at;
      this.raceIdx = 0;
      this.beacon = makeBeacon(0x2ad4c4);
      const p = this.racePoints[0];
      this.beacon.position.set(p[0], 0, p[1]);
      this.scene.add(this.beacon);
    }
    if (s.wanted && this.onWanted) this.onWanted(s.wanted);
  }

  clearBeacon() {
    if (this.beacon) { this.scene.remove(this.beacon); this.beacon = null; }
  }

  finishMission() {
    this.clearBeacon();
    this.active = false;
    this.people.clearGoons();
    const pay = this.mission.pay;
    this.audio.missionDone();
    this.toast(`JOB COMPLETE: ${this.mission.name}`, `+$${pay} — ${this.missionIdx + 1 < MISSIONS.length ? 'Next job: ' + MISSIONS[this.missionIdx + 1].name : 'The bay is yours.'}`);
    if (this.onMissionDone) this.onMissionDone(this.mission, pay);
    this.missionIdx++;
    this.stepIdx = 0;
  }

  nextStep() {
    this.stepIdx++;
    if (this.stepIdx >= this.mission.steps.length) this.finishMission();
    else this.enterStep();
  }

  /** Called every frame with the player position. Returns objective text. */
  update(dt, playerPos, inCar) {
    if (this.beacon) {
      this.beacon.userData.diamond.rotation.y += dt * 2.4;
      this.beacon.userData.diamond.position.y = 7 + Math.sin(performance.now() / 300) * 0.8;
    }
    if (this.sideBeacon) {
      this.sideBeacon.userData.diamond.rotation.y += dt * 2.4;
      this.sideBeacon.userData.diamond.position.y = 7 + Math.sin(performance.now() / 300) * 0.8;
    }
    if (!this.active || this.done) return this.stepText();
    const s = this.step;
    if (!s) return this.stepText();
    const d = (at) => Math.hypot(playerPos.x - at[0], playerPos.z - at[1]);
    if (s.type === 'drive') {
      if (d(s.at) < 7) { this.audio.pickup(); this.nextStep(); }
    } else if (s.type === 'enterCar') {
      // Get in any car — the step only counts once the player is driving.
      if (inCar) { this.audio.pickup(); this.nextStep(); }
    } else if (s.type === 'kill') {
      if (this.kills >= this.killTarget) { this.audio.pickup(); this.nextStep(); }
    } else if (s.type === 'race') {
      const p = this.racePoints[this.raceIdx];
      if (p && d(p) < 9) {
        this.audio.pickup();
        this.raceIdx++;
        if (this.raceIdx >= this.racePoints.length) { this.nextStep(); }
        else {
          const np = this.racePoints[this.raceIdx];
          this.beacon.position.set(np[0], 0, np[1]);
        }
      }
    } else if (s.type === 'survive') {
      this.surviveT -= dt;
      if (this.surviveT <= 0) { this.audio.pickup(); this.nextStep(); }
    }
    return this.stepText();
  }

  stepText() {
    if (this.done) return { main: 'SOLARA BAY IS YOURS — Don Voss is finished.', sub: 'Free roam: side jobs, races and the garage are still open.' };
    if (!this.active) return { main: `Next job: ${this.mission.name}`, sub: 'Drive to the gold beacon to start.' };
    const s = this.step;
    if (!s) return { main: '', sub: '' };
    let sub = s.text;
    if (s.type === 'kill') sub += ` — ${this.kills}/${this.killTarget} down`;
    if (s.type === 'race') sub += ` — checkpoint ${this.raceIdx + 1}/${this.racePoints.length}`;
    if (s.type === 'survive') sub += ` — ${Math.max(0, Math.ceil(this.surviveT))}s left`;
    return { main: `JOB ${this.mission.id}: ${this.mission.name}`, sub };
  }

  noteKill() { if (this.active && this.step && this.step.type === 'kill') this.kills++; }

  // ---- side jobs ----
  startSideJob(kind, playerPos) {
    if (this.sideJob) return false;
    const spots = [[-430, 120], [180, -120], [380, 380], [-380, 380], [0, -420], [240, 180]];
    const a = spots[Math.floor(Math.random() * spots.length)];
    let b = spots[Math.floor(Math.random() * spots.length)];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 200) b = spots[(spots.indexOf(a) + 3) % spots.length];
    this.sideJob = { kind, stage: 0, pickup: a, dropoff: b, pay: SIDE_JOBS[kind].pay };
    this.sideBeacon = makeBeacon(0x8affc1);
    this.sideBeacon.position.set(a[0], 0, a[1]);
    this.scene.add(this.sideBeacon);
    this.toast(SIDE_JOBS[kind].text.toUpperCase(), 'Follow the green beacon.');
    return true;
  }

  updateSideJob(dt, playerPos) {
    if (!this.sideJob) return 0;
    const j = this.sideJob;
    const target = j.stage === 0 ? j.pickup : j.dropoff;
    const d = Math.hypot(playerPos.x - target[0], playerPos.z - target[1]);
    if (d < 7) {
      if (j.stage === 0) {
        j.stage = 1;
        this.sideBeacon.position.set(j.dropoff[0], 0, j.dropoff[1]);
        this.audio.pickup();
        this.toast('PICKED UP', 'Now get to the green marker.');
      } else {
        const pay = j.pay;
        this.scene.remove(this.sideBeacon); this.sideBeacon = null;
        this.sideJob = null;
        this.audio.missionDone();
        this.toast('SIDE JOB DONE', `+$${pay}`);
        return pay;
      }
    }
    return 0;
  }

  sideJobText() {
    if (!this.sideJob) return null;
    return this.sideJob.stage === 0 ? 'Pick up at the green beacon' : 'Drop off at the green beacon';
  }
}
