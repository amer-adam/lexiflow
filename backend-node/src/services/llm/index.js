// ─────────────────────────────────────────────────────────────────────────
//  Provider-agnostic LLM access. Swap providers with the LLM_PROVIDER env
//  var (default "groq") — every provider module under ./providers exports
//  the same { chatComplete, name, model } shape, so nothing outside this
//  file needs to change to switch providers (or add a new one: drop a
//  ./providers/<name>.js with the same exports and add it to PROVIDERS).
// ─────────────────────────────────────────────────────────────────────────
const PROVIDERS = {
  groq: () => require('./providers/groqProvider'),
  // openai: () => require('./providers/openaiProvider'),
};

function loadProvider() {
  const key = (process.env.LLM_PROVIDER || 'groq').toLowerCase();
  const factory = PROVIDERS[key];
  if (!factory) throw new Error(`Unknown LLM_PROVIDER "${key}" — available: ${Object.keys(PROVIDERS).join(', ')}`);
  return factory();
}

module.exports = loadProvider();
