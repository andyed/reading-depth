# ReadingDepth

Paragraph-level reading time tracker. Measures absorption, not just visibility.

## Architecture

- `src/index.js` — ESM source: `ReadingDepth` class + `createPostHogAdapter`
- `dist/reading-depth.js` — IIFE build for `<script>` tag usage (exposes `window.ReadingDepthLib`)
- `build.js` — wraps ESM → IIFE (no bundler)
- `test/index.html` — visual test page with debug panel

## Core Concept

IntersectionObserver tracks paragraph visibility (50% threshold). Each paragraph's dwell time is compared to expected read time (word count / 238 WPM) to produce an **absorption ratio**:

| Absorption | Interpretation |
|-----------|----------------|
| 0 | Never seen |
| < 0.3 | Skipped |
| 0.3 - 0.7 | Skimmed |
| 0.7 - 1.3 | Read normally |
| > 1.5 | Studied / re-read |

## Integration

First consumer: SciprogFi (`~/Documents/dev/sciprogfi-web/`). PostHog adapter sends:
- `reading_depth_flush` — periodic with top-absorbed and skipped paragraph IDs
- `reading_depth_summary` — on page exit with overall stats

## Commands

```bash
node build.js     # build IIFE to dist/
npx serve test    # visual test page
```
