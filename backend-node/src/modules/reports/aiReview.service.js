const { v4: uuidv4 } = require('uuid');
const { collections } = require('../../config/db');
const llm = require('../../services/llm');
const videosRepository = require('../videos/videos.repository');
const segmentCorrections = require('../videos/segment-corrections');

const CONTEXT_WINDOW = 3; // segments before/after sent to the LLM

const REASON_PROMPTS = {
  translation: 'The English translation ("translated_text") is wrong or inaccurate for the given Chinese text.',
  pinyin: 'One or more pinyin readings inside "characters" are wrong for the given Chinese text.',
  text: 'The transcribed Chinese text itself is wrong (a mis-transcription) — fix "text", and update "translated_text" and "characters" to match.',
  other: "Something else about this line is wrong — use the surrounding context to find and fix it.",
};

function buildPrompt(reason, note, before, contextBefore, contextAfter) {
  const system = [
    'You are a meticulous Mandarin Chinese subtitle editor.',
    'You are given one subtitle segment a viewer reported as wrong, plus the segments immediately before and after it for context only.',
    'Each segment is a JSON object: {"start": seconds, "end": seconds, "text": "<Chinese text>", "translated_text": "<English translation>", "characters": {"<char>": {"pinyin": "...", "hsk_level": 0-6, "translations": ["..."]}}}.',
    'Fix only the reported problem in the target segment. Do not change "start" or "end". Every character in the corrected "text" must have a matching entry in "characters".',
    'Respond with ONLY the corrected target segment as a single raw JSON object — no markdown fences, no explanation, no surrounding text.',
  ].join(' ');

  const user = [
    `Reported problem: ${REASON_PROMPTS[reason] || REASON_PROMPTS.other}`,
    note ? `Reporter's note: "${note}"` : null,
    `Segments immediately before (context only, do not return these):\n${JSON.stringify(contextBefore)}`,
    `--- Target segment to fix ---\n${JSON.stringify(before)}`,
    `Segments immediately after (context only, do not return these):\n${JSON.stringify(contextAfter)}`,
    'Return ONLY the corrected version of the target segment, as one JSON object.',
  ].filter(Boolean).join('\n\n');

  return { system, user };
}

function parseLlmJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    // Some models wrap the response in a markdown fence despite instructions.
    const stripped = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    return JSON.parse(stripped);
  }
}

function sanitizeCorrected(raw, before) {
  const parsed = parseLlmJson(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('LLM did not return a JSON object');
  if (typeof parsed.text !== 'string' || typeof parsed.translated_text !== 'string' || typeof parsed.characters !== 'object' || parsed.characters === null) {
    throw new Error('LLM response is missing required segment fields');
  }
  // Timestamps are never the LLM's to change — force them back regardless of
  // what it returned, so a hallucinated value can't desync the subtitle track.
  return { ...parsed, start: before.start, end: before.end };
}

/** Runs an instant LLM review of one reported segment, applies the
 *  correction immediately, and records a before/after review for later
 *  rating (see rateReview) so correction quality can be judged over time. */
async function reviewReport({ jobId, segmentIndex, userId, reason, note }) {
  const videoResult = await videosRepository.getResultByJobOrVideoId(jobId);
  if (!videoResult) {
    const err = new Error('Video not found'); err.status = 404; throw err;
  }
  const segments = videoResult.result?.segments || [];
  const before = segments[segmentIndex];
  if (!before) {
    const err = new Error('Segment not found'); err.status = 404; throw err;
  }
  const contextBefore = segments.slice(Math.max(0, segmentIndex - CONTEXT_WINDOW), segmentIndex);
  const contextAfter = segments.slice(segmentIndex + 1, segmentIndex + 1 + CONTEXT_WINDOW);

  const { system, user } = buildPrompt(reason, note, before, contextBefore, contextAfter);
  const raw = await llm.chatComplete({ system, user, jsonMode: true });
  const after = sanitizeCorrected(raw, before);

  const reviewId = uuidv4();

  // The original segment in MongoDB is left untouched — the correction is
  // recorded as a patch in Postgres (SegmentCorrection) and merged in
  // whenever subtitles are fetched (see segment-corrections.js / videos.service.js).
  await segmentCorrections.upsertCorrection({
    videoId: videoResult.video_id,
    segmentIndex,
    text: after.text,
    translatedText: after.translated_text,
    characters: after.characters,
    reason,
    note: note || null,
    reviewId,
  });

  const review = {
    id: reviewId,
    job_id: jobId,
    video_id: videoResult.video_id,
    segment_index: segmentIndex,
    reason,
    note: note || null,
    user_id: userId,
    provider: llm.name,
    model: llm.model,
    before,
    after,
    satisfied: null,
    rating: null,
    created_at: new Date(),
  };
  await collections.segmentReviewsCollection.insertOne(review);

  return { reviewId: review.id, before, after };
}

/** Records the reporter's satisfaction + 1-5 rating of a correction — the
 *  dataset used to judge (and eventually compare) LLM correction quality. */
async function rateReview({ reviewId, userId, satisfied, rating }) {
  if (!reviewId) {
    const err = new Error('reviewId is required'); err.status = 400; throw err;
  }
  const safeRating = Math.max(1, Math.min(5, Math.round(Number(rating)) || 1));
  const result = await collections.segmentReviewsCollection.updateOne(
    { id: reviewId },
    { $set: { satisfied: !!satisfied, rating: safeRating, rated_by: userId, rated_at: new Date() } }
  );
  if (result.matchedCount === 0) {
    const err = new Error('Review not found'); err.status = 404; throw err;
  }
  return { success: true };
}

module.exports = { reviewReport, rateReview };
