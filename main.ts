// GOLDEN TIDE — Solara Bay, a gta6-01 entry (Node 22, standard library only).
// The game is this repository's game/ folder: plain static files a desktop
// browser loads offline (game/index.html plus its ES modules and the vendored
// three.js build under game/vendor/). This program hands it in: it copies
// game/ and screenshots/ from beside this file into the output directory and
// writes /output/dossier.json with the kit's vendored make.fun library.
//
// The output directory is a grader bind mount, so it is never removed: the
// program makes it first, then clears only the two subdirectories it owns
// (game and screenshots) before copying fresh. Inputs are resolved from this
// file's own directory, never from the working directory. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Make the output directory first — never delete it, the grader mounts it.
// A package.json with "type": "module" sits at the repo root so Node treats
// this file as an ES module without a reparse warning.
mkdirSync(out, { recursive: true });
// Clear only the subdirectories this program owns.
rmSync(join(out, 'game'), { recursive: true, force: true });
rmSync(join(out, 'screenshots'), { recursive: true, force: true });
mkdirSync(join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });

cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files in all, or a path under game/ over 1000 bytes — game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
