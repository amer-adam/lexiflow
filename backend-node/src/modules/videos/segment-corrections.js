const prisma = require('../../config/prisma');

/** All active corrections for one video, keyed by segment index. */
async function getCorrectionsMap(videoId) {
  if (!videoId) return new Map();
  const rows = await prisma.segmentCorrection.findMany({ where: { videoId } });
  const map = new Map();
  for (const row of rows) map.set(row.segmentIndex, row);
  return map;
}

/** Returns `result` with any active corrections merged into its segments —
 *  the original object is left untouched, since the source-of-truth copy in
 *  MongoDB must never be patched in place (see SegmentCorrection in schema.prisma). */
function applyCorrections(result, corrections) {
  if (!result?.segments?.length || !corrections || corrections.size === 0) return result;
  const segments = result.segments.map((seg, i) => {
    const c = corrections.get(i);
    if (!c) return seg;
    return { ...seg, text: c.text, translated_text: c.translatedText, characters: c.characters };
  });
  return { ...result, segments };
}

/** Convenience wrapper: looks up corrections for `videoId` and applies them to `result` in one call. */
async function withCorrections(videoId, result) {
  const corrections = await getCorrectionsMap(videoId);
  return applyCorrections(result, corrections);
}

/** Upserts the active correction for one segment — replacing any prior correction on it. */
async function upsertCorrection({ videoId, segmentIndex, text, translatedText, characters, reason, note, reviewId }) {
  return prisma.segmentCorrection.upsert({
    where: { videoId_segmentIndex: { videoId, segmentIndex } },
    create: { videoId, segmentIndex, text, translatedText, characters, reason, note, reviewId },
    update: { text, translatedText, characters, reason, note, reviewId },
  });
}

module.exports = { getCorrectionsMap, applyCorrections, withCorrections, upsertCorrection };
