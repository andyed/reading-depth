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

function stripModuleSyntax(src) {
  return src
    .replace(/^export default /gm, '')
    .replace(/^export /gm, '')
    .replace(/^import .+$/gm, '');
}

const bands = stripModuleSyntax(readFileSync('src/viewport-bands.js', 'utf-8'));
const main = stripModuleSyntax(readFileSync('src/index.js', 'utf-8'));

const iife = `/**
 * ReadingDoppler v0.2.0
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
