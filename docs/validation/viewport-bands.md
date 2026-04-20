# Viewport-band calibration

**What this library emits:** per-paragraph cumulative ms in each of four
bands — `rd_any_ms`, `rd_top_ms`, `rd_mid_ms`, `rd_bot_ms`. Bands are
defined by the paragraph center's viewport-y position, bucketed into
thirds of the current viewport height (`scr_h`). `any` is binary
viewport intersection (accumulates whenever any part of the paragraph
overlaps the viewport, including the tall-paragraph case where the
center is off-viewport).

Per-paragraph metadata also emitted on every flush:
`paragraph_index` (0-based DOM order) and `paragraph_position_frac`
(`paragraph_index / paragraphs_total`, rounded to 3 decimals). These
are the fields consumers need to cross paragraph-position with band
signal without re-deriving counts downstream.

**What this library does not do:** score, weight, normalize, or
interact bands with paragraph position. Raw band ms only. Consumers
apply per-paragraph-position interaction weights downstream — the
coefficient structure is position-dependent (see AR calibration note
below and the position-dependence section when this doc is filled in).
The library also does not normalize band ms against `expected_ms`;
consumers who want a band-weighted absorption compute it themselves.

## Empirical calibration

**TBD.** Calibration pending a ReadingDoppler corpus. This section will
mirror the AdSERP bootstrap + LOSO treatment in
`approach-retreat/docs/validation/viewport-bands-calibration.md` once
the polars-based sciprogfi absorption analysis lands and a ground-truth
behavioral label (scroll-back, social share, click-through on related
content) is chosen.

### Coefficient signs — TBD

Once calibrated, will report standardized logistic-regression
coefficients against the chosen behavioral label. AR's AdSERP finding
(for reference, not transferred): `vt_top = +1.83`, `vt_mid = +0.83`,
`vt_bot = +0.21` — top-of-viewport dwell is ~9× more discriminative
than bottom. Whether this gradient holds in a ReadingDoppler corpus
is an empirical question, not an assumption.

### Paragraph-position dependence — TBD

The analog of AR's rank-dependence finding. In AR, the `vt_top`
coefficient varies sharply by SERP rank (P0 = +2.02, P5 = +0.21 with CI
crossing 0, deep ranks fragile). For reading content, paragraph index
is the likely analog — dwell on paragraph 1 (headline / intro) vs.
paragraph 20 (conclusion / footer region) should carry different
meaning. Will report per-position estimates with cluster-bootstrap CIs
when the corpus exists.

## Parity test

`scripts/test_viewport_bands_parity.{js,py}` exercise the pure JS
helper `computeViewportBandsPure` against the canonical Python
`compute_viewport_bands_py` logic (lifted verbatim from
`viewport_ms_for_trial` in
`attentional-foraging/scripts/viewport_time_calibration.py`, by way of
approach-retreat's parity script). The synthetic fixture covers:

1. Paragraph fully above viewport throughout → all zeros.
2. Paragraph fully below viewport throughout → all zeros.
3. Paragraph center crosses all three thirds during scroll.
4. Tall paragraph with center outside `[0, scr_h]` while intersecting
   → `any_ms` only, no third.
5. Zero-duration interval (two events at same `t`) → skipped.
6. Final stationary interval after last scroll.

All 24 fields (6 paragraphs × 4 bands) match exactly (Δ = 0) in the
current run. The JS script also self-asserts against a committed
`fixtures/expected_js_viewport_bands.json` so a JS-only run is
release-blocking even without Python.

## Basis caveat

Band definitions depend on `window.innerHeight` at snapshot time. The
library uses the live value; bands accumulated before a mid-session
resize are under the old basis, after under the new. The session
summary carries `rd_viewport_band_basis_px` (current at summary
capture) and `rd_viewport_h` (from construction time). Downstream
analyses needing basis-stable bands should filter on sessions where
these match.

`ResizeObserver` on `documentElement` invalidates the page-space
geometry cache on reflow so the next snapshot uses fresh centers.
Between events, geometry is cached in a Map and reused — this is the
only reason iterating `_tracked.keys()` every rAF is cheap for long
articles.

## Schema

Session summaries carry `rd_viewport_band_schema: 'reading-doppler-vpbands-v1'`
so downstream consumers can filter on schema version. Bump the version
if band semantics change (e.g. boundary conventions, seed behavior).
Additive field changes (new bands, new metadata) do not bump the
schema.
