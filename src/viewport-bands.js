/**
 * Viewport-band decomposition — pure helpers.
 *
 * Ported from approach-retreat/src/approach-retreat.js (classifyAoiInViewport
 * + computeViewportBandsPure) with paragraph-domain naming. Same math, same
 * piecewise-constant semantics, same parity-test discipline.
 *
 * The library emits raw band ms only — `rd_any_ms`, `rd_top_ms`,
 * `rd_mid_ms`, `rd_bot_ms` per paragraph. It does not score, weight, or
 * normalize bands against `expected_ms`. Consumers apply per-paragraph-
 * position interaction weights downstream. See
 * docs/validation/viewport-bands.md for the calibration posture and the
 * approach-retreat AdSERP calibration that this port descends from.
 *
 * Band definitions (with `third = scr_h / 3`):
 *   top  iff 0        <= center_vp_y < third
 *   mid  iff third    <= center_vp_y < 2*third
 *   bot  iff 2*third  <= center_vp_y <= scr_h
 *   off  otherwise (includes tall-paragraph case where the paragraph
 *                   intersects viewport but its center sits outside
 *                   [0, scr_h])
 *
 * `any_ms` accumulates for any viewport intersection (strict
 * `min(p_bot, vp_bot) > max(p_top, vp_top)` — touching edges do not count),
 * including the off-band case. This is the tall-paragraph fix.
 */

/**
 * Classify a paragraph at a given scroll position into top / mid / bot / off.
 * Uses the paragraph's page-space top/bot and the current viewport thirds.
 *
 * Strict `>` on the intersection test — a paragraph whose bottom edge is
 * exactly at vpTop (or whose top is exactly at vpBot) is not intersecting.
 * Matches the Python reference `viewport_ms_for_trial` in attentional-
 * foraging/scripts/viewport_time_calibration.py.
 *
 * @param {number} paragraphPageTop   — paragraph top in page coordinates (px)
 * @param {number} paragraphPageBot   — paragraph bottom in page coordinates (px)
 * @param {number} scrollY            — current scrollY (px)
 * @param {number} scrH               — viewport height (px)
 * @returns {{ intersecting: boolean, band: 'top' | 'mid' | 'bot' | 'off' }}
 */
export function classifyParagraphInViewport(paragraphPageTop, paragraphPageBot, scrollY, scrH) {
  const vpTop = scrollY;
  const vpBot = scrollY + scrH;
  const intersecting =
    Math.min(paragraphPageBot, vpBot) > Math.max(paragraphPageTop, vpTop);
  if (!intersecting) return { intersecting: false, band: 'off' };

  const centerVpY = (paragraphPageTop + paragraphPageBot) / 2 - scrollY;
  const third = scrH / 3;
  let band = 'off';
  if (centerVpY >= 0 && centerVpY < third) band = 'top';
  else if (centerVpY >= third && centerVpY < 2 * third) band = 'mid';
  else if (centerVpY >= 2 * third && centerVpY <= scrH) band = 'bot';
  return { intersecting, band };
}

/**
 * Batch computation of per-paragraph viewport-band dwell totals from a
 * scroll timeline. Pure helper, parity-tested against the Python reference
 * lifted from `viewport_ms_for_trial` in
 * attentional-foraging/scripts/viewport_time_calibration.py.
 *
 * Piecewise-constant semantics: the interval `[timeline[i].t, timeline[i+1].t]`
 * is attributed using the scroll position at `timeline[i]` (i.e. the
 * *start* of the interval), matching Python's `(t0, y0), (t1, _) in zip(...)`.
 *
 * Zero-duration or negative intervals are skipped.
 *
 * Input shape keeps `position` as the paragraph identifier so fixture JSON
 * stays structurally identical to approach-retreat's. Consumers pass
 * `paragraph_index` (0-based DOM order) as `position`.
 *
 * @param {Array<{t: number, scrollY: number}>} timeline — must be sorted by t.
 * @param {Array<{position: number, page_top: number, page_bot: number}>} paragraphs
 * @param {number} scrH — viewport height (assumed constant across the
 *   timeline; if the page resizes, callers should segment the timeline by
 *   basis and aggregate segment totals).
 * @returns {Array<{position, any_ms, top_ms, mid_ms, bot_ms}>} sorted by position.
 */
export function computeViewportBandsPure(timeline, paragraphs, scrH) {
  const out = paragraphs.map((p) => ({
    position: p.position,
    any_ms: 0,
    top_ms: 0,
    mid_ms: 0,
    bot_ms: 0,
  }));
  for (let i = 0; i < timeline.length - 1; i++) {
    const dt = timeline[i + 1].t - timeline[i].t;
    if (dt <= 0) continue;
    const scrollY = timeline[i].scrollY;
    for (let j = 0; j < paragraphs.length; j++) {
      const p = paragraphs[j];
      const { intersecting, band } =
        classifyParagraphInViewport(p.page_top, p.page_bot, scrollY, scrH);
      if (!intersecting) continue;
      out[j].any_ms += dt;
      if (band === 'top') out[j].top_ms += dt;
      else if (band === 'mid') out[j].mid_ms += dt;
      else if (band === 'bot') out[j].bot_ms += dt;
    }
  }
  out.sort((a, b) => a.position - b.position);
  return out;
}
