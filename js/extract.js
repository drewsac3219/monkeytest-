/* ===== READ ANY FILE =====
   Turns a file into "blocks" the question engine understands:
     {t:'h', text}                 a heading (becomes the topic)
     {t:'p', text}                 a line of text
     {t:'row', cells:[...], start} a table / spreadsheet row (start = first row of that table)

   Plain text, CSV/TSV, JSON, HTML, RTF and Markdown work fully offline.
   PDF, Word, PowerPoint, Excel, ZIP and photos use small helper libraries that are loaded
   from a CDN only when needed (so those need an internet connection the first time).
*/
(() => {
'use strict';
const M = (window.MMT = window.MMT || {});
const CDN = {
  pdf: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  pdfWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
  mammoth: 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js',
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  jszip: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  tess: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'
};
const TEXT_EXT = 'txt md markdown text log csv tsv json html htm xhtml xml rtf srt vtt lrc yml yaml tex rst ini'.split(' ');
const SHEET_EXT = 'xlsx xls xlsm xlsb ods fods'.split(' ');
const IMG_EXT = 'png jpg jpeg webp gif bmp tif tiff jfif avif'.split(' ');
const MEDIA_EXT = 'mp3 wav m4a aac ogg flac mp4 mov avi mkv webm m4v'.split(' ');
const OCR_PAGE_LIMIT = 40;
const LEGACY = { doc: 'Word (.docx) or PDF', ppt: 'PowerPoint (.pptx) or PDF', pages: 'PDF or Word (.docx)', numbers: 'Excel (.xlsx) or CSV', key: 'PowerPoint (.pptx) or PDF', wps: 'Word (.docx) or PDF' };

const ext = n => (String(n).split('.').pop() || '').toLowerCase();
const base = n => String(n).replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
const P = text => ({ t: 'p', text });
const H = (text, extra) => Object.assign({ t: 'h', text }, extra || {});
const R = (cells, start) => ({ t: 'row', cells, start: !!start });
const yieldUI = () => new Promise(r => setTimeout(r, 0));

/* ---------- helper libraries (lazy, loaded once) ---------- */
const loading = {};
function loadScript(url) {
  if (!loading[url]) loading[url] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = url; s.async = true;
    s.onload = res; s.onerror = () => { delete loading[url]; rej(new Error('I need an internet connection the first time to read this kind of file. Connect and try again (plain .txt / .csv / .json files always work offline).')); };
    document.head.append(s);
  });
  return loading[url];
}
const lib = {
  async pdf() { await loadScript(CDN.pdf); window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfWorker; return window.pdfjsLib; },
  async mammoth() { await loadScript(CDN.mammoth); return window.mammoth; },
  async xlsx() { await loadScript(CDN.xlsx); return window.XLSX; },
  async jszip() { await loadScript(CDN.jszip); return window.JSZip; },
  async tess() { await loadScript(CDN.tess); return window.Tesseract; }
};

/* ---------- text helpers ---------- */
function decodeText(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return new TextDecoder('utf-8').decode(u8.subarray(3));
  if (u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(u8.subarray(2));
  if (u8[0] === 0xFE && u8[1] === 0xFF) return new TextDecoder('utf-16be').decode(u8.subarray(2));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (e) { /* not utf-8 */ }
  for (const enc of ['gb18030', 'big5', 'shift_jis', 'windows-1252']) { try { return new TextDecoder(enc, { fatal: true }).decode(u8); } catch (e) { /* next */ } }
  return new TextDecoder('utf-8').decode(u8);
}
const looksBinary = u8 => { const n = Math.min(u8.length, 8192); let z = 0; for (let i = 0; i < n; i++) if (u8[i] === 0) z++; return z > 0 && !(u8[0] === 0xFF && u8[1] === 0xFE) && !(u8[0] === 0xFE && u8[1] === 0xFF); };
const clean = s => s.replace(/[\u200b-\u200d\ufeff]/g, '').replace(/[\u00a0\u3000]/g, ' ').replace(/\r\n?/g, '\n');
/** OCR puts spaces between every Chinese character - close them up. */
const closeCJKGaps = s => s.replace(/([\u3400-\u9fff，。！？、：；])[ \t]+(?=[\u3400-\u9fff，。！？、：；])/g, '$1');
const textToBlocks = t => clean(t).split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim()).map(P);

function parseDelimited(text, d) {
  const rows = []; let row = [], v = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { v += '"'; i++; } else q = false; } else v += c; }
    else if (c === '"' && v === '') q = true;
    else if (c === d) { row.push(v); v = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(v); rows.push(row); row = []; v = ''; }
    else v += c;
  }
  if (v || row.length) { row.push(v); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim()));
}
function sniffDelimiter(text) {
  const head = text.split('\n').slice(0, 5).join('\n');
  const score = d => (head.match(new RegExp(d === '\t' ? '\\t' : '\\' + d, 'g')) || []).length;
  return [',', '\t', ';', '|'].map(d => [d, score(d)]).sort((a, b) => b[1] - a[1])[0];
}
function rtfToText(rtf) {
  return rtf.replace(/\\u(-?\d+)\??/g, (m, n) => String.fromCharCode(n < 0 ? +n + 65536 : +n))
    .replace(/\\'([0-9a-f]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\{\\\*[^{}]*\}/g, '').replace(/\\(par|line)\b ?/g, '\n').replace(/\\tab\b ?/g, '\t')
    .replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '').replace(/\\([\\{}])/g, '$1');
}

/* ---------- DOM / XML -> blocks ---------- */
function domToBlocks(rootEl) {
  const blocks = [];
  rootEl.querySelectorAll('script,style,noscript,template').forEach(n => n.remove());
  rootEl.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  const LEAF = /^(P|LI|PRE|BLOCKQUOTE|DT|DD|FIGCAPTION|SUMMARY|CAPTION)$/;
  const walk = node => {
    for (const ch of node.childNodes) {
      if (ch.nodeType === 3) { const t = ch.textContent.trim(); if (t) blocks.push(P(t)); continue; }
      if (ch.nodeType !== 1) continue;
      const tag = ch.tagName.toUpperCase();
      if (tag === 'TABLE') {
        let first = true;
        ch.querySelectorAll('tr').forEach(tr => {
          const cells = [...tr.children].filter(c => /^(TD|TH)$/i.test(c.tagName)).map(c => c.textContent.replace(/\s+/g, ' ').trim());
          if (cells.some(Boolean)) { blocks.push(R(cells, first)); first = false; }
        });
      } else if (/^H[1-6]$/.test(tag)) { const t = ch.textContent.trim(); if (t) blocks.push(H(t)); }
      else if (LEAF.test(tag)) { ch.textContent.split('\n').forEach(l => { if (l.trim()) blocks.push(P(l.trim())); }); }
      else walk(ch);
    }
  };
  walk(rootEl);
  return blocks;
}
function xmlBlocks(root, cfg) {
  const blocks = [];
  const walk = node => {
    for (const ch of node.childNodes) {
      if (ch.nodeType !== 1) continue;
      const n = ch.nodeName;
      if (n === cfg.table) {
        let first = true;
        for (const tr of ch.getElementsByTagName(cfg.row)) {
          const cells = [...tr.getElementsByTagName(cfg.cell)].map(c => c.textContent.replace(/\s+/g, ' ').trim());
          if (cells.some(Boolean)) { blocks.push(R(cells, first)); first = false; }
        }
      } else if (cfg.h.includes(n)) { const t = ch.textContent.trim(); if (t) blocks.push(H(t)); }
      else if (cfg.p.includes(n)) { const t = ch.textContent.trim(); if (t) t.split('\n').forEach(l => { if (l.trim()) blocks.push(P(l.trim())); }); }
      else walk(ch);
    }
  };
  walk(root);
  return blocks;
}
const parseXml = s => new DOMParser().parseFromString(s, 'application/xml');
const numSort = (a, b) => (+(a.match(/(\d+)\D*$/) || [0, 0])[1]) - (+(b.match(/(\d+)\D*$/) || [0, 0])[1]);

/* ---------- OCR (photos & scanned pages) ---------- */
let ocrWorker = null, ocrTimer = null;
async function getOcr(progress) {
  clearTimeout(ocrTimer);
  if (ocrWorker) return ocrWorker;
  const T = await lib.tess();
  ocrWorker = await T.createWorker('chi_sim+eng', 1, {
    logger: m => {
      if (!m || !progress) return;
      if (/loading|initializ/.test(m.status || '')) progress({ label: 'Getting Mandarin reading ready (first time takes a minute)…', pct: null });
    }
  });
  return ocrWorker;
}
async function endOcr() { if (ocrWorker) { try { await ocrWorker.terminate(); } catch (e) { /* ignore */ } ocrWorker = null; } }
const endOcrSoon = () => { clearTimeout(ocrTimer); ocrTimer = setTimeout(endOcr, 60000); };
async function fileToCanvas(file, maxSide) {
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch (e) {
    bmp = await new Promise((res, rej) => { const img = new Image(), u = URL.createObjectURL(file); img.onload = () => { URL.revokeObjectURL(u); res(img); }; img.onerror = () => rej(new Error('I could not open that image.')); img.src = u; });
  }
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight, k = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  try { ctx.filter = 'grayscale(1) contrast(1.25)'; } catch (e) { /* not supported */ }
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return c;
}
async function ocrCanvas(canvas, progress) {
  const w = await getOcr(progress);
  const { data } = await w.recognize(canvas);
  return closeCJKGaps(clean(data.text || ''));
}

/* ---------- per-format readers ---------- */
async function readText(file, name) {
  const u8 = new Uint8Array(await file.arrayBuffer());
  if (looksBinary(u8)) throw new Error('“' + name + '” looks like a file type I can’t read. Try a PDF, Word, PowerPoint, Excel, photo or text file instead.');
  return decodeText(u8);
}
async function readPDF(file, progress) {
  const pdfjs = await lib.pdf();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const blocks = [], scanned = [];
  for (let i = 1; i <= doc.numPages; i++) {
    progress({ label: 'Reading page ' + i + ' of ' + doc.numPages + '…', pct: (i / doc.numPages) * 0.85 });
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items.filter(it => it.str && it.str.trim() !== '' || it.str === ' ').map(it => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0, h: Math.abs(it.height || it.transform[3] || 10) }));
    items.sort((a, b) => b.y - a.y);
    let line = [], lineY = null, lines = [];
    const flush = () => { if (!line.length) return; line.sort((a, b) => a.x - b.x); let out = ''; line.forEach((it, k) => { if (k) { const gap = it.x - (line[k - 1].x + line[k - 1].w), fs = Math.max(it.h, 6); out += gap > fs * 1.6 ? '\t' : gap > fs * 0.22 ? ' ' : ''; } out += it.s; }); if (out.trim()) lines.push(out.trim()); line = []; };
    items.forEach(it => { if (lineY !== null && Math.abs(it.y - lineY) > Math.max(2, it.h * 0.5)) { flush(); } if (!line.length) lineY = it.y; line.push(it); });
    flush();
    if (lines.join('').replace(/\s/g, '').length < 8) scanned.push(i);
    lines.forEach(l => blocks.push(P(l)));
    blocks.push({ t: 'pagebreak', page: i });
    if (i % 4 === 0) await yieldUI();
    page.cleanup();
  }
  if (scanned.length) {
    const todo = scanned.slice(0, OCR_PAGE_LIMIT);
    const ocrBlocks = {};
    for (let k = 0; k < todo.length; k++) {
      progress({ label: 'Scanned page → reading the writing (' + (k + 1) + ' of ' + todo.length + ')…', pct: 0.85 + 0.15 * (k / todo.length) });
      const page = await doc.getPage(todo[k]);
      const vp = page.getViewport({ scale: 2 });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      ocrBlocks[todo[k]] = textToBlocks(await ocrCanvas(c, progress));
      page.cleanup();
    }
    const merged = []; let pg = 1;
    blocks.forEach(b => { if (b.t === 'pagebreak') { if (ocrBlocks[b.page]) merged.push(...ocrBlocks[b.page]); pg++; } else merged.push(b); });
    return { blocks: merged, ocr: todo.length, skippedOcr: scanned.length - todo.length };
  }
  return { blocks: blocks.filter(b => b.t !== 'pagebreak') };
}
async function readDocx(file) {
  const mammoth = await lib.mammoth();
  const res = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  return domToBlocks(new DOMParser().parseFromString('<body>' + res.value + '</body>', 'text/html').body);
}
async function readSheets(file, progress) {
  const X = await lib.xlsx();
  const wb = X.read(await file.arrayBuffer(), { type: 'array' });
  const blocks = [];
  wb.SheetNames.forEach((name, si) => {
    progress({ label: 'Reading sheet “' + name + '”…', pct: (si + 1) / wb.SheetNames.length });
    const rows = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, blankrows: false, defval: '' });
    if (wb.SheetNames.length > 1 && !/^(sheet|工作表|表)\s*\d*$/i.test(name)) blocks.push(H(name));
    rows.slice(0, 200000).forEach((r, i) => { if (r.some(c => String(c).trim())) blocks.push(R(r.map(c => String(c)), i === 0)); });
  });
  return blocks;
}
async function readPptx(file, progress) {
  const Z = await lib.jszip(), zip = await Z.loadAsync(await file.arrayBuffer());
  const slides = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort(numSort);
  const blocks = [];
  for (let i = 0; i < slides.length; i++) {
    progress({ label: 'Reading slide ' + (i + 1) + ' of ' + slides.length + '…', pct: (i + 1) / slides.length });
    blocks.push(...xmlBlocks(parseXml(await zip.files[slides[i]].async('string')), { table: 'a:tbl', row: 'a:tr', cell: 'a:tc', h: [], p: ['a:p'] }));
  }
  return blocks;
}
async function readOpenDoc(file) {
  const Z = await lib.jszip(), zip = await Z.loadAsync(await file.arrayBuffer());
  const f = zip.files['content.xml']; if (!f) throw new Error('That OpenDocument file looks empty.');
  return xmlBlocks(parseXml(await f.async('string')), { table: 'table:table', row: 'table:table-row', cell: 'table:table-cell', h: ['text:h'], p: ['text:p'] });
}
async function readEpub(file, progress) {
  const Z = await lib.jszip(), zip = await Z.loadAsync(await file.arrayBuffer());
  const pages = Object.keys(zip.files).filter(n => /\.(xhtml|html|htm)$/i.test(n)).sort(numSort);
  const blocks = [];
  for (let i = 0; i < pages.length; i++) {
    progress({ label: 'Reading chapter ' + (i + 1) + ' of ' + pages.length + '…', pct: (i + 1) / pages.length });
    blocks.push(...domToBlocks(new DOMParser().parseFromString(await zip.files[pages[i]].async('string'), 'text/html').body));
    if (i % 5 === 0) await yieldUI();
  }
  return blocks;
}
async function readImage(file, progress) {
  progress({ label: 'Looking at the picture…', pct: null });
  const canvas = await fileToCanvas(file, 2400);
  progress({ label: 'Reading the writing…', pct: null });
  return textToBlocks(await ocrCanvas(canvas, progress));
}

/* ---------- main entry ---------- */
async function extract(file, progress, depth) {
  progress = progress || (() => {}); depth = depth || 0;
  const name = file.name || 'Pasted text', e = ext(name), doc = { name: base(name), kind: e || 'file', blocks: [], json: null, notes: [] };
  try {
    if (e === 'docx' || e === 'dotx' || e === 'docm') { progress({ label: 'Opening Word document…', pct: null }); doc.blocks = await readDocx(file); doc.kind = 'Word'; }
    else if (e === 'pdf') { const r = await readPDF(file, progress); doc.blocks = r.blocks; doc.kind = 'PDF'; if (r.ocr) doc.notes.push('Read ' + r.ocr + ' scanned page(s) with text recognition.'); if (r.skippedOcr) doc.notes.push('Skipped ' + r.skippedOcr + ' more scanned pages (limit ' + OCR_PAGE_LIMIT + ').'); }
    else if (e === 'pptx' || e === 'potx' || e === 'ppsx') { doc.blocks = await readPptx(file, progress); doc.kind = 'PowerPoint'; }
    else if (e === 'odt' || e === 'odp') { progress({ label: 'Opening document…', pct: null }); doc.blocks = await readOpenDoc(file); doc.kind = 'OpenDocument'; }
    else if (e === 'epub') { doc.blocks = await readEpub(file, progress); doc.kind = 'eBook'; }
    else if (SHEET_EXT.includes(e)) { doc.blocks = await readSheets(file, progress); doc.kind = 'Spreadsheet'; }
    else if (IMG_EXT.includes(e) || (file.type || '').startsWith('image/')) { doc.blocks = await readImage(file, progress); doc.kind = 'Photo'; if (!doc.blocks.length) throw new Error('I couldn’t read any writing in that picture. Try a straighter, brighter photo of printed text.'); }
    else if (e === 'zip') {
      if (depth > 0) throw new Error('Zip files inside zip files are too deep for me.');
      const Z = await lib.jszip(), zip = await Z.loadAsync(await file.arrayBuffer());
      const entries = Object.values(zip.files).filter(f => !f.dir && !/(^|\/)(__MACOSX|\.)/.test(f.name)).slice(0, 200);
      for (let i = 0; i < entries.length; i++) {
        const f = entries[i], short = f.name.replace(/^.*\//, '');
        if (MEDIA_EXT.includes(ext(short))) continue;
        progress({ label: 'Inside the zip: ' + short + ' (' + (i + 1) + '/' + entries.length + ')', pct: (i + 1) / entries.length });
        try {
          const sub = await extract(new File([await f.async('blob')], short), p => progress({ label: 'Inside the zip: ' + short + ' - ' + (p.label || ''), pct: p.pct }), depth + 1);
          if (sub.json) doc.json = doc.json || sub.json;
          if (sub.blocks.length) { doc.blocks.push(H(base(short))); doc.blocks.push(...sub.blocks); }
        } catch (err) { doc.notes.push('Skipped ' + short + ': ' + err.message); }
      }
      doc.kind = 'Zip';
    }
    else if (LEGACY[e]) throw new Error('.' + e + ' is an older format I can’t open. Please save or export it as ' + LEGACY[e] + ' and drop it in again.');
    else if (MEDIA_EXT.includes(e)) throw new Error('I can’t listen to audio or watch video yet. If you have the words written down (notes, a PDF, a photo), I can use those!');
    else {
      progress({ label: 'Reading text…', pct: null });
      const text = await readText(file, name);
      if (e === 'json') { try { doc.json = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (err) { /* maybe not strict json */ } }
      if (doc.json && Array.isArray(doc.json) && doc.json.length && typeof doc.json[0] === 'object' && !doc.json[0].prompt) {
        const keys = Object.keys(doc.json[0]);
        doc.blocks.push(R(keys, true)); doc.json.forEach(o => doc.blocks.push(R(keys.map(k => String(o[k] == null ? '' : o[k])))));
      } else if (doc.json) {
        const strs = []; (function flat(v) { if (typeof v === 'string') strs.push(v); else if (Array.isArray(v)) v.forEach(flat); else if (v && typeof v === 'object') Object.values(v).forEach(flat); })(doc.json);
        doc.blocks = strs.map(P);
      } else if (e === 'csv' || e === 'tsv') {
        const [d] = e === 'tsv' ? ['\t'] : sniffDelimiter(text);
        parseDelimited(clean(text), d).forEach((r, i) => doc.blocks.push(R(r, i === 0)));
        doc.kind = 'Table';
      } else if (e === 'html' || e === 'htm' || e === 'xhtml') { doc.blocks = domToBlocks(new DOMParser().parseFromString(text, 'text/html').body); doc.kind = 'Web page'; }
      else if (e === 'xml') { doc.blocks = textToBlocks(text.replace(/<[^>]+>/g, '\n')); }
      else if (e === 'rtf') { doc.blocks = textToBlocks(rtfToText(text)); doc.kind = 'RTF'; }
      else {
        doc.blocks = textToBlocks(text);
      }
    }
  } finally { if (depth === 0 && ocrWorker) endOcrSoon(); }
  return doc;
}

M.extract = extract;
M.extractInfo = { TEXT_EXT, SHEET_EXT, IMG_EXT, MEDIA_EXT };
if (typeof module !== 'undefined' && module.exports) module.exports = { decodeText, parseDelimited, sniffDelimiter, rtfToText, textToBlocks };
})();
