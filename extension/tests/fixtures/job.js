// Shared fake job payload, shaped exactly like the real backend's
// GET /lexiflow/jobs/:id response (see backend-node videos.controller.js /
// frontend/src/lib/api.ts mapSegment) — `characters` keyed by whole
// tokenized words, not single hanzi.
const FAKE_SEGMENTS = [
  {
    start: 0,
    end: 5,
    text: "我认为",
    translated_text: "I think",
    characters: {
      "我": { pinyin: "wǒ", hsk_level: 1, translations: ["I", "me"] },
      "认为": { pinyin: "rènwéi", hsk_level: 3, translations: ["to think", "to believe"] },
    },
  },
  {
    start: 5,
    end: 10,
    text: "你好",
    translated_text: "Hello",
    characters: {
      "你好": { pinyin: "nǐhǎo", hsk_level: 1, translations: ["hello"] },
    },
  },
];

const FAKE_JOB_ID = "job-test-123";

function fakeCompletedJobResponse() {
  return {
    job_id: FAKE_JOB_ID,
    status: "completed",
    progress: 100,
    title: "Test video",
    result: { segments: FAKE_SEGMENTS, title: "Test video" },
  };
}

module.exports = { FAKE_SEGMENTS, FAKE_JOB_ID, fakeCompletedJobResponse };
