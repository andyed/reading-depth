/**
 * Minimal build script — wraps ESM source into an IIFE for <script> tag usage.
 * No bundler required.
 *
 * Source layout:
 *   src/viewport-bands.js  — pure helpers (prepended first so its names are
 *                            in scope for src/index.js)
 *   src/index.js           — ReadingDoppler class + PostHog adapter
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const BUILD_DATE = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function stripModuleSyntax(src) {
  return src
    .replace(/^export default /gm, '')
    .replace(/^export /gm, '')
    .replace(/^import .+$/gm, '');
}

// Replace the build-injectable version tokens with real string literals.
// Run AFTER stripModuleSyntax — the token-bearing lines in src/index.js start
// with `const RD_VERSION`/`const RD_BUILD`, so the strip regexes don't touch
// them, and order is not actually load-bearing; we stamp last for clarity.
// After this runs the built dist must contain NO `__RD_*__` tokens.
function stamp(src) {
  return src
    .replaceAll('__RD_VERSION__', JSON.stringify(pkg.version))
    .replaceAll('__RD_BUILD__', JSON.stringify(BUILD_DATE));
}

const bands = stamp(stripModuleSyntax(readFileSync('src/viewport-bands.js', 'utf-8')));
const main = stamp(stripModuleSyntax(readFileSync('src/index.js', 'utf-8')));

const iife = `/**
 * ReadingDoppler v${pkg.version} (build ${BUILD_DATE})
 * Paragraph-level reading time tracker with viewport-band decomposition.
 * https://github.com/andyed/reading-doppler
 */
(function(global) {
  "use strict";

${bands}

${main}

  global.ReadingDopplerLib = {
    ReadingDoppler,
    createPostHogAdapter,
    computeViewportBandsPure,
    classifyParagraphInViewport,
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;

writeFileSync('dist/reading-doppler.js', iife);
console.log(`Built dist/reading-doppler.js (${(iife.length / 1024).toFixed(1)} KB)`);
