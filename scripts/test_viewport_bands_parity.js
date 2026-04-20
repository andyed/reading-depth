#!/usr/bin/env node
/**
 * Parity test for `computeViewportBandsPure` (JS) vs. the canonical
 * batch computation lifted from `viewport_ms_for_trial` in
 * attentional-foraging/scripts/viewport_time_calibration.py (by way of
 * approach-retreat's parity script).
 *
 * Writes fixtures/viewport_bands_trajectory.json (scroll timeline +
 * paragraphs) and fixtures/js_viewport_bands.json (this script's output).
 * The companion Python script reads the trajectory, runs the reference
 * logic, and writes fixtures/py_viewport_bands.json. The two files must
 * match to 1e-6 on every field.
 *
 * The script also self-asserts JS output against a committed expected
 * fixture so a JS-only run is release-blocking (no Python required to
 * verify).
 *
 * Run:
 *   node scripts/test_viewport_bands_parity.js
 *   python3 scripts/test_viewport_bands_parity.py
 *   diff fixtures/js_viewport_bands.json fixtures/py_viewport_bands.json
 */

import { computeViewportBandsPure } from '../src/viewport-bands.js';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');
mkdirSync(FIXTURES, { recursive: true });

// Synthetic trajectory exercising every edge case called out in the plan.
// Identical structure to approach-retreat's fixture so the Python reference
// is verbatim-portable. Semantics:
//   1. Paragraph 0: top of page, scrolls past.
//   2. Paragraph 1: mid of page, crosses all three bands during scroll.
//   3. Paragraph 2: appears only after scroll.
//   4. Paragraph 3: never reached.
//   5. Paragraph 4: TALL paragraph (> scr_h) — center off-viewport while
//      intersecting, accumulates any_ms without a banded third.
//   6. Paragraph 5: always above the viewport.
// Scroll events include dt=0 (must be skipped) and a stationary tail.
const trajectory = {
  doc_h: 3000,
  scr_h: 900,
  scroll_events: [
    { t: 0,    scrollY: 0   },
    { t: 1000, scrollY: 300 },
    { t: 2500, scrollY: 900 },
    { t: 2500, scrollY: 900 },  // dt = 0 — must not accumulate
    { t: 4000, scrollY: 900 },  // stationary tail
  ],
  paragraphs: [
    { position: 0, page_top: 200,   page_bot: 350  },  // top of page
    { position: 1, page_top: 400,   page_bot: 550  },  // mid of page
    { position: 2, page_top: 1200,  page_bot: 1350 },  // appears on scroll
    { position: 3, page_top: 2800,  page_bot: 2950 },  // never reached
    { position: 4, page_top: 500,   page_bot: 1700 },  // TALL (> scr_h)
    { position: 5, page_top: -500,  page_bot: -100 },  // always above viewport
  ],
};

console.log('synthetic trajectory:');
console.log(`  doc_h=${trajectory.doc_h}, scr_h=${trajectory.scr_h}`);
console.log(`  ${trajectory.scroll_events.length} scroll events, ${trajectory.paragraphs.length} paragraphs`);

const jsBands = computeViewportBandsPure(
  trajectory.scroll_events,
  trajectory.paragraphs,
  trajectory.scr_h
);

console.log('\n── JS computeViewportBandsPure ──');
console.log(`${'pos'.padEnd(4)} ${'any_ms'.padStart(8)} ${'top_ms'.padStart(8)} ${'mid_ms'.padStart(8)} ${'bot_ms'.padStart(8)}`);
for (const r of jsBands) {
  console.log(
    `${String(r.position).padEnd(4)} ${String(r.any_ms).padStart(8)} ${String(r.top_ms).padStart(8)} ${String(r.mid_ms).padStart(8)} ${String(r.bot_ms).padStart(8)}`
  );
}

writeFileSync(
  join(FIXTURES, 'viewport_bands_trajectory.json'),
  JSON.stringify(trajectory, null, 2)
);
writeFileSync(
  join(FIXTURES, 'js_viewport_bands.json'),
  JSON.stringify(jsBands, null, 2)
);
console.log(`\nwrote ${join(FIXTURES, 'viewport_bands_trajectory.json')}`);
console.log(`wrote ${join(FIXTURES, 'js_viewport_bands.json')}`);

// Self-assert against committed expected fixture. If missing on first run,
// write it (bootstrap); on subsequent runs, diff and fail on mismatch.
const TOL = 1e-6;
const expectedPath = join(FIXTURES, 'expected_js_viewport_bands.json');
if (!existsSync(expectedPath)) {
  writeFileSync(expectedPath, JSON.stringify(jsBands, null, 2));
  console.log(`\nbootstrapped expected fixture at ${expectedPath}`);
} else {
  const expected = JSON.parse(readFileSync(expectedPath, 'utf-8'));
  let fail = false;
  if (expected.length !== jsBands.length) {
    console.error(`FAIL: length mismatch — expected ${expected.length}, got ${jsBands.length}`);
    fail = true;
  } else {
    for (let i = 0; i < expected.length; i++) {
      const e = expected[i], g = jsBands[i];
      if (e.position !== g.position) {
        console.error(`FAIL: position mismatch at index ${i} — expected ${e.position}, got ${g.position}`);
        fail = true;
        continue;
      }
      for (const f of ['any_ms', 'top_ms', 'mid_ms', 'bot_ms']) {
        const d = Math.abs(e[f] - g[f]);
        if (d >= TOL) {
          console.error(`FAIL: pos ${e.position} ${f}: expected ${e[f]}, got ${g[f]}, Δ=${d}`);
          fail = true;
        }
      }
    }
  }
  if (fail) {
    console.error('\nSELF-PARITY FAILED — computed output diverged from expected fixture.');
    console.error(`If the divergence is intentional, delete ${expectedPath} and re-run to re-bootstrap.`);
    process.exit(1);
  }
  console.log(`\nJS self-parity OK (matches ${expectedPath}).`);
}

console.log('\nNext: python3 scripts/test_viewport_bands_parity.py');
