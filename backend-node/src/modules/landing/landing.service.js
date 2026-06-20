const previewClip = require('../../data/landingPreviewClip.json');

/**
 * The landing-page preview clip. Deliberately a static file checked into the
 * backend source tree (src/data/landingPreviewClip.json) rather than a live
 * lookup against the video pipeline's MongoDB store — that store is meant to
 * be prunable/deletable, but the marketing preview must keep working
 * regardless. The clip itself is gated server-side: only the locked
 * [lockStart, lockEnd) window is ever served to unauthenticated visitors.
 */
function getPreviewClip() {
  return previewClip;
}

module.exports = { getPreviewClip };
