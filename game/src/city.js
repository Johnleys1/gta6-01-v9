// GOLDEN TIDE — Solara Bay: a sun-soaked coastal city at golden hour sliding
// into neon dusk. Builds the whole world from primitives + canvas textures,
// so the game loads offline with zero image files.

import * as THREE from 'three';
import { WORLD, ROAD_STEP, BEACH_X, OCEAN_X, DISTRICTS } from './config.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function facadeTexture(base, lit) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 2);
    for (let y = 14; y < h - 8; y += 26) {
      for (let x = 10; x < w - 10; x += 24) {
        const warm = Math.random() < lit;
        g.fillStyle = warm ? 'rgba(255,196,110,0.95)' : 'rgba(30,40,70,0.85)';
        g.fillRect(x, y, 14, 16);
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y, 14, 3);
      }
    }
  });
}

function roadTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#2e2a33'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7c948'; g.fillRect(w / 2 - 2, 0, 4, 26); g.fillRect(w / 2 - 2, 64, 4, 26);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(4, 0, 2, h); g.fillRect(w - 6, 0, 2, h);
  });
}

function neonTexture(text, color) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#12041f'; g.fillRect(0, 0, w, h);
    g.font = 'bold 64px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 26; g.fillStyle = color;
    g.fillText(text, w / 2, h / 2);
    g.shadowBlur = 6; g.fillStyle = '#ffffff'; g.fillText(text, w / 2, h / 2);
  });
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];   // {x,z,hx,hz} axis-aligned boxes the cars/peds bump into
    this.palms = [];
    this.neonSigns = [];
    this.streetLights = [];
    this.ocean = null; this.oceanGeo = null;
    this.skyMat = null; this.sun = null; this.hemi = null;
    this.timeOfDay = 0;
    this.buildSky();
    this.buildGround();
    this.buildRoads();
    this.buildBuildings();
    this.buildBeachAndOcean();
    this.buildMarina();
    this.buildDocks();
    this.buildPalmsAndLights();
    this.buildNeon();
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(2400, 24, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x7a5fd0) },
        mid: { value: new THREE.Color(0xff9d5a) },
        bot: { value: new THREE.Color(0xffc978) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
        void main(){ float h = normalize(vP).y; vec3 c = h > 0.18 ? mix(mid, top, smoothstep(0.18, 0.65, h)) : mix(bot, mid, smoothstep(-0.08, 0.18, h)); gl_FragColor = vec4(c, 1.0); }`,
    });
    const sky = new THREE.Mesh(geo, this.skyMat); sky.name = 'SkyDome';
    this.scene.add(sky);
    this.sun = new THREE.DirectionalLight(0xffb36b, 2.6);
    this.sun.position.set(-900, 320, 300); this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a2a4a, 0.9); this.scene.add(this.hemi);
    this.scene.fog = new THREE.Fog(0xe8a06a, 700, 2200);
  }

  buildGround() {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD + 400, WORLD + 400),
      new THREE.MeshLambertMaterial({ color: 0x8a7a68 }));
    g.rotation.x = -Math.PI / 2; g.position.y = -0.05; g.receiveShadow = true; this.scene.add(g);
    // Sand strip along the west edge.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(140, WORLD + 200),
      new THREE.MeshLambertMaterial({ color: 0xe8c98a }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(BEACH_X - 60, 0.02, 0); this.scene.add(sand);
  }

  buildRoads() {
    const tex = roadTexture(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const coords = [];
    for (let v = -450; v <= 450; v += ROAD_STEP) coords.push(v);
    for (const c of coords) {
      const rx = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, 16), mat.clone());
      rx.material.map = tex.clone(); rx.material.map.repeat.set(WORLD / 128, 1); rx.material.map.needsUpdate = true;
      rx.rotation.x = -Math.PI / 2; rx.position.set(0, 0.06, c); this.scene.add(rx);
      const rz = new THREE.Mesh(new THREE.PlaneGeometry(16, WORLD), mat.clone());
      rz.material.map = tex.clone(); rz.material.map.repeat.set(1, WORLD / 128); rz.material.map.needsUpdate = true;
      rz.rotation.x = -Math.PI / 2; rz.position.set(c, 0.06, 0); this.scene.add(rz);
    }
    // Promenade along the beach.
    const prom = new THREE.Mesh(new THREE.PlaneGeometry(24, WORLD),
      new THREE.MeshLambertMaterial({ color: 0xc9a06a }));
    prom.rotation.x = -Math.PI / 2; prom.position.set(BEACH_X + 6, 0.08, 0); this.scene.add(prom);
  }

  buildBuildings() {
    const facades = [
      facadeTexture('#e8b48a', 0.55), facadeTexture('#c98a7a', 0.5),
      facadeTexture('#e8d5a8', 0.6), facadeTexture('#9ab8c8', 0.45),
      facadeTexture('#d98a9a', 0.5), facadeTexture('#b8a8d8', 0.45),
    ];
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a3a3a });
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const centers = [];
    for (let x = -375; x <= 375; x += ROAD_STEP) for (let z = -375; z <= 375; z += ROAD_STEP) centers.push([x, z]);
    let i = 0;
    for (const [cx, cz] of centers) {
      // Keep the marina, docks yard and beach clear.
      if (cx < -300 && cz > 280) continue;
      if (cx > 300 && cz > 280) continue;
      if (Math.abs(cx) < 90 && Math.abs(cz) < 90) continue; // central plaza
      const dist = Math.hypot(cx, cz);
      const tall = dist < 180 ? 46 + Math.random() * 34 : 12 + Math.random() * 26;
      const palmHeights = cz < -260 && cx > 260; // Palm Heights towers
      const h = palmHeights ? tall * 1.3 : tall;
      const w = 42 + Math.random() * 26, d = 42 + Math.random() * 26;
      const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ map: facades[i++ % facades.length] }));
      m.scale.set(w, h, d); m.position.set(cx, h / 2, cz); this.scene.add(m);
      const roof = new THREE.Mesh(boxGeo, roofMat);
      roof.scale.set(w * 0.9, 2, d * 0.9); roof.position.set(cx, h + 1, cz); this.scene.add(roof);
      this.colliders.push({ x: cx, z: cz, hx: w / 2 + 1, hz: d / 2 + 1 });
      // A second smaller block on some plots.
      if (Math.random() < 0.5) {
        const h2 = 10 + Math.random() * 14, w2 = 26 + Math.random() * 14, d2 = 26 + Math.random() * 14;
        const ox = cx + (Math.random() < 0.5 ? -1 : 1) * (w / 2 + w2 / 2 + 8);
        const m2 = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ map: facades[i++ % facades.length] }));
        m2.scale.set(w2, h2, d2); m2.position.set(ox, h2 / 2, cz); this.scene.add(m2);
        this.colliders.push({ x: ox, z: cz, hx: w2 / 2 + 1, hz: d2 / 2 + 1 });
      }
    }
    // Central plaza: fountain + palms.
    const fountain = new THREE.Mesh(new THREE.CylinderGeometry(14, 16, 2, 20),
      new THREE.MeshPhongMaterial({ color: 0x3aa8c8, shininess: 90 }));
    fountain.position.set(0, 1, 0); this.scene.add(fountain);
    this.colliders.push({ x: 0, z: 0, hx: 16, hz: 16 });
  }

  buildBeachAndOcean() {
    this.oceanGeo = new THREE.PlaneGeometry(500, WORLD + 600, 24, 60);
    this.ocean = new THREE.Mesh(this.oceanGeo,
      new THREE.MeshPhongMaterial({ color: 0x1a7a9a, shininess: 120, specular: 0xffc978, transparent: true, opacity: 0.94 }));
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.set(OCEAN_X - 240, 0.4, 0); this.scene.add(this.ocean);
    // Umbrellas + towels on the sand for beach life.
    const umMat = new THREE.MeshLambertMaterial({ color: 0xff5a7a });
    const umMat2 = new THREE.MeshLambertMaterial({ color: 0xffd76a });
    for (let k = 0; k < 14; k++) {
      const z = -520 + Math.random() * 1040, x = BEACH_X - 20 - Math.random() * 60;
      const um = new THREE.Mesh(new THREE.ConeGeometry(5, 3, 8), k % 2 ? umMat : umMat2);
      um.position.set(x, 3.4, z); this.scene.add(um);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.4, 6),
        new THREE.MeshLambertMaterial({ color: 0xdddddd }));
      pole.position.set(x, 1.7, z); this.scene.add(pole);
    }
  }

  buildMarina() {
    // Piers + yachts in the southwest corner.
    const wood = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
    for (let p = 0; p < 3; p++) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1.5, 90), wood);
      pier.position.set(-440 + p * 26, 0.8, 360); this.scene.add(pier);
      this.colliders.push({ x: -440 + p * 26, z: 360, hx: 5, hz: 45 });
    }
    const hullMat = new THREE.MeshPhongMaterial({ color: 0xf2f2f2, shininess: 80 });
    const cabinMat = new THREE.MeshPhongMaterial({ color: 0x2a4a6a, shininess: 60 });
    for (let y = 0; y < 6; y++) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 22), hullMat); hull.position.y = 1.5; g.add(hull);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 9), cabinMat); cabin.position.set(0, 4.2, -2); g.add(cabin);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 12, 6),
        new THREE.MeshLambertMaterial({ color: 0x888888 })); mast.position.set(0, 9, 4); g.add(mast);
      g.position.set(-452 + (y % 3) * 26, 0.4, 330 + Math.floor(y / 3) * 44);
      g.rotation.y = (Math.random() - 0.5) * 0.2;
      this.scene.add(g);
    }
  }

  buildDocks() {
    // Container stacks + cranes in the southeast corner.
    const colors = [0xc84a3a, 0x3a7ac8, 0x3aa84a, 0xc8a03a, 0x8a5ac8];
    for (let s = 0; s < 10; s++) {
      const x = 300 + (s % 5) * 34, z = 300 + Math.floor(s / 5) * 40;
      const stack = 1 + Math.floor(Math.random() * 3);
      for (let l = 0; l < stack; l++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(28, 9, 9),
          new THREE.MeshLambertMaterial({ color: colors[(s + l) % colors.length] }));
        c.position.set(x, 4.5 + l * 9, z); this.scene.add(c);
      }
      this.colliders.push({ x, z, hx: 15, hz: 6 });
    }
    const craneMat = new THREE.MeshLambertMaterial({ color: 0xd8a03a });
    for (const cx of [330, 430]) {
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(4, 60, 4), craneMat); leg1.position.set(cx, 30, 320); this.scene.add(leg1);
      const leg2 = new THREE.Mesh(new THREE.BoxGeometry(4, 60, 4), craneMat); leg2.position.set(cx, 30, 350); this.scene.add(leg2);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 70), craneMat); beam.position.set(cx, 58, 335); this.scene.add(beam);
      this.colliders.push({ x: cx, z: 335, hx: 4, hz: 18 });
    }
  }

  buildPalmsAndLights() {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
    const frondMat = new THREE.MeshLambertMaterial({ color: 0x2a8a4a, side: THREE.DoubleSide });
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.9, 12, 7);
    const frondGeo = new THREE.ConeGeometry(3.4, 7, 4); frondGeo.scale(1, 1, 0.25);
    for (let k = 0; k < 70; k++) {
      // Palms line the promenade, the plaza and Palm Heights.
      let x, z;
      const r = Math.random();
      if (r < 0.45) { x = BEACH_X + 14 + Math.random() * 8; z = -560 + Math.random() * 1120; }
      else if (r < 0.7) { x = -560 + Math.random() * 1120; z = -560 + Math.random() * 1120; if (Math.abs(x) % ROAD_STEP < 20 || Math.abs(z) % ROAD_STEP < 20) continue; }
      else { x = 260 + Math.random() * 240; z = -440 + Math.random() * 220; }
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.y = 6; trunk.rotation.z = (Math.random() - 0.5) * 0.16; g.add(trunk);
      for (let f = 0; f < 5; f++) {
        const fr = new THREE.Mesh(frondGeo, frondMat);
        fr.position.y = 12.4; fr.rotation.z = Math.PI / 2.4; fr.rotation.y = (f / 5) * Math.PI * 2;
        fr.position.x = Math.cos((f / 5) * Math.PI * 2) * 2.2; fr.position.z = Math.sin((f / 5) * Math.PI * 2) * 2.2;
        g.add(fr);
      }
      g.position.set(x, 0, z); this.scene.add(g); this.palms.push(g);
    }
    // Streetlights along the main avenues.
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x333344 });
    for (let v = -450; v <= 450; v += ROAD_STEP) {
      for (const z of [-450, 450]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 9, 6), poleMat);
        pole.position.set(v + 10, 4.5, z); this.scene.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xffe9b0 }));
        lamp.position.set(v + 10, 9.2, z); this.scene.add(lamp);
        this.streetLights.push(lamp);
      }
    }
  }

  buildNeon() {
    const signs = [
      { text: 'CASINO', color: '#ff5ad8', at: [180, 26, -120], ry: 0 },
      { text: 'HOTEL CORAL', color: '#2ad4ff', at: [60, 30, -40], ry: 0 },
      { text: 'TACOS', color: '#ffd76a', at: [-60, 18, 60], ry: 0 },
      { text: 'NEON', color: '#8affc1', at: [240, 24, 180], ry: 0 },
      { text: 'SOLARA', color: '#ff7a2a', at: [-380, 20, 120], ry: Math.PI / 2 },
    ];
    for (const s of signs) {
      const mat = new THREE.MeshBasicMaterial({ map: neonTexture(s.text, s.color), transparent: true });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(34, 8.5), mat);
      m.position.set(s.at[0], s.at[1], s.at[2]); m.rotation.y = s.ry;
      this.scene.add(m); this.neonSigns.push(m);
    }
  }

  /** Golden hour (t=0) to deep dusk (t=1): sun drops, sky cools to violet, neon wakes up. */
  update(dt, t, elapsed) {
    this.timeOfDay = t;
    const sunH = 340 - t * 260, sunW = -900 + t * 260;
    this.sun.position.set(sunW, sunH, 300 - t * 120);
    this.sun.intensity = 2.6 - t * 1.3;
    this.sun.color.setHSL(0.07 - t * 0.02, 0.85, 0.62 - t * 0.1);
    this.hemi.intensity = 0.9 - t * 0.35;
    const top = new THREE.Color().setHSL(0.72 - t * 0.04, 0.55, 0.55 - t * 0.22);
    const mid = new THREE.Color().setHSL(0.06 - t * 0.03, 0.9, 0.6 - t * 0.18);
    const bot = new THREE.Color().setHSL(0.09 - t * 0.02, 0.95, 0.66 - t * 0.2);
    this.skyMat.uniforms.top.value.copy(top);
    this.skyMat.uniforms.mid.value.copy(mid);
    this.skyMat.uniforms.bot.value.copy(bot);
    this.scene.fog.color.copy(mid).lerp(new THREE.Color(0x2a1a4a), t * 0.5);
    // Ocean swell.
    if (this.oceanGeo) {
      const pos = this.oceanGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        pos.setZ(i, Math.sin(x * 0.05 + elapsed * 1.2) * 0.5 + Math.cos(y * 0.04 + elapsed * 0.9) * 0.5);
      }
      pos.needsUpdate = true; this.oceanGeo.computeVertexNormals();
    }
    // Neon flicker at dusk.
    const neonGlow = 0.55 + t * 0.45;
    for (let i = 0; i < this.neonSigns.length; i++) {
      const m = this.neonSigns[i];
      m.material.opacity = neonGlow * (0.9 + 0.1 * Math.sin(elapsed * 7 + i * 2.3));
    }
    for (const l of this.streetLights) {
      l.material.color.setHex(t > 0.35 ? 0xffe9b0 : 0x554433);
    }
    // Palms sway gently.
    for (let i = 0; i < this.palms.length; i++) {
      this.palms[i].rotation.z = Math.sin(elapsed * 0.7 + i * 1.7) * 0.02;
    }
  }

  districtAt(x, z) {
    let best = DISTRICTS[0], bd = 1e9;
    for (const d of DISTRICTS) { const dd = (x - d.x) ** 2 + (z - d.z) ** 2; if (dd < bd) { bd = dd; best = d; } }
    return best;
  }

  /** Push a circle (x,z,r) out of every building AABB it overlaps. Returns true on hit. */
  collide(x, z, r) {
    let hit = false;
    for (const c of this.colliders) {
      const cx = Math.max(c.x - c.hx, Math.min(x, c.x + c.hx));
      const cz = Math.max(c.z - c.hz, Math.min(z, c.z + c.hz));
      const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) { hit = true; }
    }
    return hit;
  }

  /** Slide a moving circle along AABBs: returns corrected {x,z} and whether it hit. */
  slide(x, z, nx, nz, r) {
    let hit = false;
    for (const c of this.colliders) {
      const cx = Math.max(c.x - c.hx, Math.min(nx, c.x + c.hx));
      const cz = Math.max(c.z - c.hz, Math.min(nz, c.z + c.hz));
      const dx = nx - cx, dz = nz - cz;
      if (dx * dx + dz * dz < r * r) {
        hit = true;
        // Resolve along the smaller penetration axis.
        const px = c.hx + r - Math.abs(nx - c.x), pz = c.hz + r - Math.abs(nz - c.z);
        if (px < pz) nx = c.x + (nx > c.x ? c.hx + r : -(c.hx + r));
        else nz = c.z + (nz > c.z ? c.hz + r : -(c.hz + r));
      }
    }
    return { x: nx, z: nz, hit };
  }
}
