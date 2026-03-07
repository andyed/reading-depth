/**
 * Minimal build script — wraps ESM source into an IIFE for <script> tag usage.
 * No bundler required.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

const src = readFileSync('src/index.js', 'utf-8');

// Strip export keywords for IIFE wrapping
const stripped = src
  .replace(/^export /gm, '')
  .replace(/^import .+$/gm, '');

const iife = `/**
 * ReadingDepth v0.1.0
 * Paragraph-level reading time tracker.
 * https://github.com/andyed/reading-depth
 */
(function(global) {
  "use strict";

${stripped}

  global.ReadingDepthLib = {
    ReadingDepth,
    createPostHogAdapter,
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;

writeFileSync('dist/reading-depth.js', iife);
console.log(`Built dist/reading-depth.js (${(iife.length / 1024).toFixed(1)} KB)`);
