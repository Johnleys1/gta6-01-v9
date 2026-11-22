// GOLDEN TIDE — Solara Bay tuning, districts, story, weapons, radio.
// Every number the game runs on lives here, so the city can be re-tuned in one place.

export const WORLD = 1200;            // city is WORLD x WORLD, centred on 0,0
export const ROAD_STEP = 150;         // street grid spacing
export const BEACH_X = -470;          // sand starts west of here
export const OCEAN_X = -560;          // water plane starts here

export const DISTRICTS = [
  { name: 'The Strand',    x: -460, z: 0,    r: 210, color: '#ffd76a', desc: 'Beachfront promenade' },
  { name: 'Marina del Oro',x: -380, z: 380,  r: 180, color: '#9fe8ff', desc: 'Yachts and warehouses' },
  { name: 'Old Coral',     x: 0,    z: -40,  r: 260, color: '#ff9d5a', desc: 'Tight old-town streets' },
  { name: 'Palm Heights',  x: 380,  z: -330, r: 200, color: '#c9a2ff', desc: 'Hills, mansions, lookouts' },
  { name: 'The Docks',     x: 380,  z: 380,  r: 200, color: '#8affc1', desc: 'Containers, cranes, night work' },
];

export const CREW = {
  rio:  { name: 'RIO',  role: 'Getaway driver', color: 0xff7a2a },
  mara: { name: 'MARA', role: 'Fixer, ex-cop',  color: 0x9fe8ff },
  dex:  { name: 'DEX',  role: 'Muscle, ex-racer', color: 0xffd76a },
};
export const VILLAIN = { name: 'DON ALVARO VOSS', role: 'Owns the marina and the tide' };

export const WEAPONS = [
  { name: 'Pistol',  damage: 34, rate: 0.28, mag: 12, spread: 0.012, range: 90,  color: 0xffe9b0 },
  { name: 'SMG',     damage: 16, rate: 0.09, mag: 32, spread: 0.03,  range: 70,  color: 0x9fe8ff },
  { name: 'Shotgun', damage: 22, rate: 0.85, mag: 6,  spread: 0.09,  range: 45,  color: 0xff9d5a, pellets: 6 },
  { name: 'Rifle',   damage: 55, rate: 0.16, mag: 24, spread: 0.006, range: 160, color: 0x8affc1 },
];

export const RADIOS = [
  { name: 'SOL 98.5 — Sunset FM',   hue: 'golden synthwave',  bpm: 96 },
  { name: 'CORAL 101 — Latin Heat', hue: 'salsa brass',       bpm: 120 },
  { name: 'TIDE TALK 87 — Night',   hue: 'late-night talk',   bpm: 72 },
];

// The 10 story jobs. Each mission is a chain of objective steps.
// step types: drive (reach a marker), kill (defeat N goons), race (hit checkpoints in order),
// survive (stay alive / keep the car above water for N seconds), deliver (reach marker with cargo).
export const MISSIONS = [
  { id: 1, name: 'Golden Getaway', giver: 'MARA', pay: 400,
    brief: 'Voss men torched your garage. Steal a car on The Strand and lose the heat at the pier.',
    steps: [
      { type: 'enterCar', text: 'Steal a car on The Strand (E near a car)' },
      { type: 'drive', at: [-380, -260], text: 'Lose the cops — reach the north pier marker', wanted: 2 },
    ] },
  { id: 2, name: 'Marina Heist', giver: 'DEX', pay: 700,
    brief: 'Voss keeps his ledger on the yacht "Coral Queen". Get aboard, grab it, get out.',
    steps: [
      { type: 'drive', at: [-380, 380], text: 'Drive to Marina del Oro' },
      { type: 'kill', count: 4, at: [-380, 380], text: 'Clear the dock guards (4)' },
      { type: 'drive', at: [-120, 300], text: 'Escape with the ledger — reach the Old Coral safehouse' },
    ] },
  { id: 3, name: 'Dockside Ambush', giver: 'MARA', pay: 900,
    brief: 'Voss is moving product through The Docks tonight. Hit the convoy, take the cash.',
    steps: [
      { type: 'drive', at: [380, 380], text: 'Reach The Docks' },
      { type: 'kill', count: 6, at: [380, 380], text: 'Ambush the convoy guards (6)' },
      { type: 'drive', at: [120, 420], text: 'Bring the cash to the drop-off' },
    ] },
  { id: 4, name: 'Sunset Grand Prix', giver: 'DEX', pay: 1100,
    brief: 'The hilltop race decides who owns Palm Heights. Beat Voss\'s champion, LUCIA, at sunset.',
    steps: [
      { type: 'race', at: [[380, -330], [180, -420], [-60, -380], [240, -120], [380, -330]],
        text: 'Race the sunset circuit — hit every checkpoint' },
    ] },
  { id: 5, name: 'Neon District', giver: 'MARA', pay: 1300,
    brief: 'Voss\'s enforcers run the neon strip. Clean it out, street by street.',
    steps: [
      { type: 'drive', at: [60, -40], text: 'Reach the neon strip in Old Coral' },
      { type: 'kill', count: 8, at: [60, -40], text: 'Clear the enforcers (8)' },
    ] },
  { id: 6, name: 'Container Yard', giver: 'DEX', pay: 1500,
    brief: 'A shipment of Voss\'s guns sits in the yard. Ghost in, plant the charge, ghost out.',
    steps: [
      { type: 'drive', at: [380, 380], text: 'Sneak into the container yard' },
      { type: 'survive', seconds: 45, at: [380, 380], text: 'Hold the yard while the charge arms (45s)' },
      { type: 'drive', at: [-300, -100], text: 'Get clear before it blows' },
    ] },
  { id: 7, name: 'Speedboat Chase', giver: 'MARA', pay: 1800,
    brief: 'Voss is fleeing by boat. Take the pursuit car and run him down along the coast road.',
    steps: [
      { type: 'race', at: [[-430, 300], [-430, 0], [-430, -300], [-200, -420], [0, -300]],
        text: 'Chase Voss down the coast road — every checkpoint' },
    ] },
  { id: 8, name: 'Casino Vault', giver: 'DEX', pay: 2200,
    brief: 'The Coral Casino vault holds Voss\'s war chest. Walk in quiet, walk out rich.',
    steps: [
      { type: 'drive', at: [180, -120], text: 'Reach the Coral Casino' },
      { type: 'kill', count: 6, at: [180, -120], text: 'Take down the vault guards (6)' },
      { type: 'drive', at: [-380, 380], text: 'Stash the take at the marina' },
    ] },
  { id: 9, name: 'The Informant', giver: 'MARA', pay: 2600,
    brief: 'A Voss lieutenant wants out. Escort him across the city while hit squads hunt you both.',
    steps: [
      { type: 'drive', at: [0, 0], text: 'Pick up the informant in Old Coral' },
      { type: 'survive', seconds: 60, at: [0, 0], text: 'Survive the hit squads (60s)', wanted: 4 },
      { type: 'drive', at: [-430, 120], text: 'Deliver him to the beach house' },
    ] },
  { id: 10, name: 'High Tide', giver: 'RIO', pay: 5000,
    brief: 'It ends on the pier, as the tide comes in. Voss, his crew, and the whole bay watching.',
    steps: [
      { type: 'drive', at: [-430, -260], text: 'Reach the north pier' },
      { type: 'kill', count: 10, at: [-430, -260], text: 'Break Voss\'s crew (10)', wanted: 5 },
      { type: 'survive', seconds: 30, at: [-430, -260], text: 'Hold the pier as the tide comes in (30s)' },
    ] },
];

export const SIDE_JOBS = {
  taxi:    { pay: 120, text: 'Taxi fare — pick up the rider, drop them off' },
  deliver: { pay: 150, text: 'Delivery — get the package across town, fast' },
  race:    { pay: 300, text: 'Street race — checkpoints, no cops invited' },
};

export const GARAGE = {
  engine: { base: 800, mult: 1.6, max: 4 },
  armor:  { base: 600, mult: 1.6, max: 4 },
  paint:  { base: 200, colors: [0xffc23d, 0xff5a7a, 0x2ad4c4, 0x8a5cff] },
};

export const TUNE = {
  playerAccel: 26, playerBrake: 42, playerMaxSpeed: 46, playerTurn: 1.9,
  trafficSpeed: 11, policeSpeed: 40, heliSpeed: 26,
  playerHealth: 100, carHealth: 100,
  wantedDecaySeconds: 14, bustRadius: 2.2,
  pedCount: 26, trafficCount: 14,
  dayStart: 0.0, dayEnd: 1.0,          // 0 = golden hour, 1 = deep dusk
  saveKey: 'golden-tide-solara-bay-v9',
};
