const prisma = require('../../config/prisma');
const vocabularyRepository = require('./vocabulary.repository');

// Mirrors export.service.js's toCsv() header exactly, so a list exported
// from this app re-imports with full fidelity (round-trip / "share a list
// with another user" use case).
const CSV_HEADER = ['simplified', 'traditional', 'pinyin', 'meaning', 'hskLevel', 'seenCount', 'contextSentence', 'contextTranslation'];

function splitCsvLine(line) {
  // Minimal CSV field splitter matching export.service.js's csvEscape():
  // fields containing a comma, quote, or newline are wrapped in "...",
  // with internal quotes doubled.
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  let start = 0;
  const firstRowRaw = splitCsvLine(lines[0]).map((f) => f.trim());
  const looksLikeHeader = CSV_HEADER.some((h) => firstRowRaw.some((f) => f.toLowerCase() === h.toLowerCase()));
  // Normalize whichever casing the header used (e.g. "hsklevel") back to our
  // canonical camelCase keys, so row[col] lookups below (row.hskLevel etc.)
  // actually match instead of silently landing on `undefined`.
  const canonicalByLower = new Map(CSV_HEADER.map((h) => [h.toLowerCase(), h]));
  let columns = CSV_HEADER;
  if (looksLikeHeader) {
    columns = firstRowRaw.map((f) => canonicalByLower.get(f.toLowerCase()) || f);
    start = 1;
  }

  const words = [];
  for (let i = start; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]);
    const row = {};
    columns.forEach((col, idx) => { row[col] = fields[idx]; });

    const simplified = (row.simplified || '').trim();
    if (!simplified) continue;

    words.push({
      simplified,
      traditional: (row.traditional || '').trim() || null,
      pinyin: (row.pinyin || '').trim(),
      meaning: (row.meaning || '').trim(),
      hskLevel: row.hskLevel && !Number.isNaN(Number(row.hskLevel)) ? parseInt(row.hskLevel, 10) : null,
      contextSentence: (row.contextSentence || '').trim() || null,
      contextTranslation: (row.contextTranslation || '').trim() || null,
    });
  }
  return words;
}

// Mirrors export.service.js's toAnki(): tab-separated `simplified\tpinyin<br>meaning`,
// no header row (that's how Anki's own importer expects it, which is why
// the export is saved as a .txt file in the first place).
function parseTxt(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const words = [];
  for (const line of lines) {
    const [front, back = ''] = line.split('\t');
    const simplified = (front || '').trim();
    if (!simplified) continue;
    const [pinyin = '', meaning = ''] = back.split('<br>');
    words.push({
      simplified,
      pinyin: pinyin.trim(),
      meaning: meaning.trim(),
      traditional: null,
      hskLevel: null,
      contextSentence: null,
      contextTranslation: null,
    });
  }
  return words;
}

function parseWords(text, format) {
  if (format === 'csv') return parseCsv(text);
  if (format === 'txt') return parseTxt(text);
  const err = new Error('Unsupported import format. Use csv or txt.');
  err.status = 400;
  throw err;
}

/** Import a previously-exported list (csv or txt) into a brand-new list for this user. */
async function importList({ userId, name, format, text }) {
  const words = parseWords(text, format);
  if (words.length === 0) {
    const err = new Error('No words found in the imported file');
    err.status = 400;
    throw err;
  }

  const baseName = name || 'Imported list';
  let listName = baseName;
  let counter = 1;
  while (await prisma.vocabularyList.findFirst({ where: { userId, name: listName } })) {
    listName = `${baseName} (${counter++})`;
  }

  const list = await vocabularyRepository.createList({
    userId,
    name: listName,
    type: 'USER_CREATED',
    sourceMetadata: { description: 'Imported from a shared list file.' },
  });

  let wordsAdded = 0;
  for (const word of words) {
    try {
      await vocabularyRepository.addWordToList(list.id, word);
      wordsAdded++;
    } catch (err) {
      console.error(`Failed to import word ${word.simplified} into list ${list.id}:`, err.message);
    }
  }

  return { success: true, listId: list.id, listName: list.name, wordsAdded, wordsFound: words.length };
}

module.exports = { importList };
