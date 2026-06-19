const PDFDocument = require('pdfkit');
const prisma = require('../../config/prisma');
const vocabularyRepository = require('./vocabulary.repository');

function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function loadListForExport(listId, userId) {
  const list = await prisma.vocabularyList.findUnique({ where: { id: listId } });
  if (!list) {
    const err = new Error('List not found');
    err.status = 404;
    throw err;
  }
  if (list.userId && list.userId !== userId) {
    const err = new Error('Access denied');
    err.status = 403;
    throw err;
  }
  const items = await vocabularyRepository.getListItems(listId);
  return { list, items };
}

function toCsv(list, items) {
  const header = ['simplified', 'traditional', 'pinyin', 'meaning', 'hskLevel', 'seenCount', 'contextSentence', 'contextTranslation'];
  const rows = [header.join(',')];
  for (const it of items) {
    rows.push([
      it.vocabulary.simplified,
      it.vocabulary.traditional,
      it.vocabulary.pinyin,
      it.vocabulary.meaning,
      it.vocabulary.hskLevel,
      it.seenCount,
      it.contextSentence,
      it.contextTranslation
    ].map(csvEscape).join(','));
  }
  return rows.join('\n');
}

// Anki import format: tab-separated, no header, Front\tBack (HTML allowed in fields).
function toAnki(list, items) {
  const rows = items.map(it => {
    const front = it.vocabulary.simplified;
    const back = [it.vocabulary.pinyin, it.vocabulary.meaning].filter(Boolean).join('<br>');
    return `${front}\t${back}`;
  });
  return rows.join('\n');
}

function toPdf(list, items, res) {
  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  doc.fontSize(18).text(list.name, { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('gray').text(`${items.length} words • exported from LexiFlow`);
  doc.moveDown();
  doc.fillColor('black');

  items.forEach((it, idx) => {
    if (doc.y > 700) doc.addPage();
    doc.fontSize(14).text(`${it.vocabulary.simplified}${it.vocabulary.traditional ? ` (${it.vocabulary.traditional})` : ''}`, { continued: false });
    doc.fontSize(11).fillColor('#555').text(`${it.vocabulary.pinyin}${it.vocabulary.hskLevel ? `  ·  HSK ${it.vocabulary.hskLevel}` : ''}`);
    doc.fontSize(11).fillColor('black').text(it.vocabulary.meaning);
    if (it.contextSentence) {
      doc.fontSize(9).fillColor('#777').text(it.contextSentence, { italics: true });
    }
    doc.fillColor('black').moveDown(0.6);
  });

  doc.end();
}

module.exports = { loadListForExport, toCsv, toAnki, toPdf };
