/* ===== COVERAGE -> QUESTIONS =====
   Takes whatever was read from a file (see extract.js) and builds multiple-choice questions.
   It understands, in this order:
     1. Ready-made question files (JSON / CSV with prompt + options + answer)
     2. Typed quiz papers  ("1. ... A) ... B) ... Answer: B")
     3. Vocabulary  (Chinese + pinyin + English, in lists, tables, spreadsheets, photos of notes...)
     4. Chinese sentences (turned into fill-in-the-blank questions)
   Pure logic: no DOM, so it can be tested in Node.
*/
(() => {
'use strict';
const root = typeof window !== 'undefined' ? window : globalThis;
const M = (root.MMT = root.MMT || {});

const CJK = '\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff';
const CJK_PUNCT = '，。！？、；：“”‘’（）《》〈〉【】…—·「」『』';
const reCJK = new RegExp('[' + CJK + ']');
const reCJKish = new RegExp('[' + CJK + CJK_PUNCT + ']+', 'g');
const reTrimZh = /^[（）《》〈〉【】「」『』“”‘’：、；，\s]+|[（）《》〈〉【】「」『』“”‘’：、；，\s]+$/g;
const ORDER = ['easy', 'medium', 'hard'];
const FALLBACK_EN = ['Hello', 'Thank you', 'Water', 'Monkey', 'Red', 'Mother', 'School', 'Today', 'Friend', 'Rice', 'Book', 'Happy'];
const FALLBACK_ZH = ['你好', '谢谢', '学校', '今天', '朋友', '喜欢', '老师', '明天', '高兴', '书本'];
const FALLBACK_PY = ['nǐ hǎo', 'xièxie', 'xuéxiào', 'jīntiān', 'péngyou', 'xǐhuan', 'lǎoshī', 'míngtiān'];

const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (a, n) => { if (a.length <= n) return a.slice(); const out = new Set(); while (out.size < n) out.add(rnd(a.length)); return [...out].map(i => a[i]); };
const cjkLen = s => (s.match(new RegExp('[' + CJK + ']', 'g')) || []).length;
const bump = l => ORDER[Math.min(2, ORDER.indexOf(l) + 1)];

/* ---------- pinyin recognition ---------- */
const SYL = new Set();
(function buildSyllables() {
  const T = {
    b: 'a ai an ang ao ei en eng i ian iao ie in ing o u', p: 'a ai an ang ao ei en eng i ian iao ie in ing o ou u',
    m: 'a ai an ang ao e ei en eng i ian iao ie in ing iu o ou u', f: 'a an ang ei en eng o ou u',
    d: 'a ai an ang ao e ei en eng i ia ian iao ie ing iu ong ou u uan ui un uo', t: 'a ai an ang ao e eng i ian iao ie ing ong ou u uan ui un uo',
    n: 'a ai an ang ao e ei en eng i ian iang iao ie in ing iu ong ou u uan uo ü üe', l: 'a ai an ang ao e ei eng i ia ian iang iao ie in ing iu o ong ou u uan un uo ü üe',
    g: 'a ai an ang ao e ei en eng ong ou u ua uai uan uang ui un uo', k: 'a ai an ang ao e ei en eng ong ou u ua uai uan uang ui un uo',
    h: 'a ai an ang ao e ei en eng ong ou u ua uai uan uang ui un uo',
    j: 'i ia ian iang iao ie in ing iong iu u uan ue un', q: 'i ia ian iang iao ie in ing iong iu u uan ue un', x: 'i ia ian iang iao ie in ing iong iu u uan ue un',
    zh: 'a ai an ang ao e ei en eng i ong ou u ua uai uan uang ui un uo', ch: 'a ai an ang ao e en eng i ong ou u ua uai uan uang ui un uo',
    sh: 'a ai an ang ao e ei en eng i ou u ua uai uan uang ui un uo', r: 'an ang ao e en eng i ong ou u ua uan ui un uo',
    z: 'a ai an ang ao e ei en eng i ong ou u uan ui un uo', c: 'a ai an ang ao e en eng i ong ou u uan ui un uo', s: 'a ai an ang ao e en eng i ong ou u uan ui un uo',
    y: 'a ai an ang ao e i in ing o ong ou u uan ue un', w: 'a ai an ang ei en eng o u',
    '': 'a ai an ang ao e ei en eng er o ou'
  };
  Object.keys(T).forEach(i => T[i].split(' ').forEach(f => { SYL.add(i + f); if (f.includes('ü')) SYL.add(i + f.replace('ü', 'u')); }));
})();
const TONES = { ā: 'a', á: 'a', ǎ: 'a', à: 'a', ē: 'e', é: 'e', ě: 'e', è: 'e', ê: 'e', ī: 'i', í: 'i', ǐ: 'i', ì: 'i', ō: 'o', ó: 'o', ǒ: 'o', ò: 'o', ū: 'u', ú: 'u', ǔ: 'u', ù: 'u', ǖ: 'ü', ǘ: 'ü', ǚ: 'ü', ǜ: 'ü', v: 'ü' };
const reToneMark = /[āáǎàēéěèêīíǐìōóǒòūúǔùǖǘǚǜ]/;
const NEUTRAL = new Set(['ma', 'ne', 'ba', 'de', 'le', 'a', 'ya', 'zi', 'men', 'me', 'zhe', 'guo', 'ge', 'xie', 'tou']);
const stripTone = w => w.toLowerCase().replace(/[\u00c0-\u02ff]|[a-z]/g, c => TONES[c] || c).replace(/[1-5]/g, '');
function segmentSyllables(word) {
  const w = stripTone(word.replace(/[^A-Za-zÀ-ɏ1-5]/g, ''));
  if (!w || w.length > 40) return null;
  const run = str => {
    const memo = new Map();
    const f = i => {
      if (i === str.length) return [];
      if (memo.has(i)) return memo.get(i);
      let res = null;
      for (let len = Math.min(6, str.length - i); len >= 1 && !res; len--) {
        if (SYL.has(str.slice(i, i + len))) { const rest = f(i + len); if (rest) res = [str.slice(i, i + len), ...rest]; }
      }
      memo.set(i, res); return res;
    };
    return f(0);
  };
  let r = run(w);
  if (!r && /r$/.test(w) && w.length > 2) r = run(w.slice(0, -1)); // erhua: nàr, wǎnr
  return r;
}
function hasToneEvidence(tok) { return reToneMark.test(tok) || /[A-Za-z][1-5]\b/.test(tok); }
/** Splits "nǐ hǎo hello" into { py: "nǐ hǎo", rest: "hello" } when the front looks like pinyin.
 *  allowToneless: also accept "ni hao hello" when the syllable count equals the number of Chinese characters. */
function takePinyin(piece, hanziLen, allowToneless) {
  if (allowToneless === undefined) allowToneless = true;
  const toks = piece.split(/[\s'’]+/).filter(Boolean);
  const clean = t => t.replace(/^[^A-Za-zÀ-ɏ]+|[^A-Za-zÀ-ɏ1-5]+$/g, '');
  // 1) tone marks / tone numbers present: consume leading pinyin tokens
  let i = 0, toned = false, syl = 0;
  while (i < toks.length) {
    const t = clean(toks[i]); if (!t) { i++; continue; }
    const seg = segmentSyllables(t);
    if (!seg) break;
    if (hasToneEvidence(t)) { toned = true; syl += seg.length; i++; }
    else if (toned && seg.length === 1 && NEUTRAL.has(seg[0])) { syl += 1; i++; }
    else break;
  }
  if (toned) return { py: toks.slice(0, i).join(' ').replace(/[,;，；]+$/, '').trim(), rest: toks.slice(i).join(' ').trim(), syl, toneless: false };
  // 2) no tones at all ("ni hao"): only trust it when the syllables add up to the number of Chinese characters
  if (allowToneless && hanziLen >= 2) {
    let total = 0, take = 0;
    for (let k = 0; k < toks.length; k++) {
      const seg = segmentSyllables(clean(toks[k])); if (!seg) break;
      total += seg.length; if (total > hanziLen) break;
      take = k + 1; if (total === hanziLen) break;
    }
    if (take && total === hanziLen) return { py: toks.slice(0, take).join(' ').replace(/[,;，；]+$/, '').trim(), rest: toks.slice(take).join(' ').trim(), syl: total, toneless: true };
  }
  return { py: '', rest: piece.trim(), syl: 0, toneless: false };
}

/* ---------- entry parsing (one line / one table row -> {zh, py, en}) ---------- */
const POS = /^(n|v|vi|vt|adj|adv|prep|conj|pron|m|mw|num|int|aux|part|noun|verb|adjective|adverb|measure word|particle|idiom|phrase)\.?$/i;
function trimZh(s) { return s.replace(reTrimZh, ''); }
function latinPieces(str, hanziLen) {
  // (nǐ hǎo) / (hello) become their own piece; a trailing note like "hello (formal)" is dropped
  str = str.replace(/\(([^()]*)\)|\[([^\[\]]*)\]/g, (m, a, b, off, whole) => {
    const inner = (a != null ? a : b || '').trim();
    if (!/[A-Za-zÀ-ɏ]/.test(inner)) return ' ';
    if (takePinyin(inner, hanziLen).py) return '\t' + inner + '\t';
    return /[A-Za-zÀ-ɏ]{2,}/.test(whole.slice(0, off)) ? ' ' : '\t' + inner + '\t';
  });
  return str.replace(/[()\[\]{}（）]/g, '\t').split(/\t+|\s[-–—=:：]\s|[=|]/)
    .map(x => x.replace(/^[\s\-–—=:;,.·•*]+|[\s\-–—=:;,·•*]+$/g, '').trim())
    .reduce((acc, x) => {   // "nǐ hǎo, hello" typed with commas: peel the pinyin off the front
      const m = x.match(/^([^,;，；]+)[,;，；]\s*(\S.*)$/);
      if (m && takePinyin(m[1], hanziLen, false).py && !takePinyin(m[1], hanziLen, false).rest) acc.push(m[1], m[2]); else acc.push(x);
      return acc;
    }, [])
    .map(x => x.trim()).filter(x => /[A-Za-zÀ-ɏ]/.test(x) && !POS.test(x));
}
function splitRuns(line) {
  const zh = [], latin = []; let last = 0, m;
  reCJKish.lastIndex = 0;
  while ((m = reCJKish.exec(line))) {
    if (!reCJK.test(m[0])) continue;
    latin.push(line.slice(last, m.index)); zh.push(trimZh(m[0])); last = m.index + m[0].length;
  }
  latin.push(line.slice(last));
  return { zh: zh.filter(Boolean), latin };
}
function cleanLead(s) { return s.replace(/^\s*(?:\d{1,4}\s*[.)、．:：]\s*|[-•*·▪●○■□►▶]\s*|[(（]?[A-Da-d][)）.．、]\s*)/, ''); }

function parseEntry(cells) {
  const line = cleanLead(cells.map(c => String(c == null ? '' : c)).join('\t'));
  const { zh, latin } = splitRuns(line);
  if (!zh.length) return null;
  const head = zh[0], hanziLen = cjkLen(head);
  let py = '', en = '';
  const pieces = [];
  latin.forEach(l => latinPieces(l, hanziLen).forEach(p => pieces.push(p)));
  let leftovers = [];
  for (const p of pieces) {                      // pass 1: pinyin with tone marks / numbers
    const r = takePinyin(p, hanziLen, false);
    if (r.py && !py) { py = r.py; if (r.rest) leftovers.push(r.rest); } else leftovers.push(p);
  }
  if (!py) {                                      // pass 2: tone-less pinyin ("ni hao"), never for a lone English word
    leftovers = [];
    for (const p of pieces) {
      const r = takePinyin(p, hanziLen, true);
      if (r.py && !py && !(!r.rest && pieces.length === 1)) { py = r.py; if (r.rest) leftovers.push(r.rest); } else leftovers.push(p);
    }
  }
  en = (leftovers.find(x => /[A-Za-z]{2,}/.test(x) || /^(I|a)$/.test(x)) || '').replace(/[;,.\s]+$/, '');
  return { zh: head, py, en, extra: zh.slice(1) };
}

/* ---------- headings ---------- */
const HEAD_RE = /^\s*(?:#{1,6}\s+|(?:lesson|unit|chapter|topic|week|day|part|section|module|vocab(?:ulary)?|review|theme|hsk\s*\d)\b|第\s*[0-9一二三四五六七八九十百]+\s*[课課章节節单單元周週天篇部分])/i;
function headingText(line) {
  const t = line.replace(/^#{1,6}\s+/, '').replace(/[：:]\s*$/, '').replace(/\s+/g, ' ').trim();
  return t.length > 60 ? t.slice(0, 57) + '…' : t;
}
function isHeading(line) {
  const t = line.trim();
  if (!t || t.length > 70) return false;
  if (HEAD_RE.test(t)) return true;
  if (/[：:]\s*$/.test(t) && t.length <= 40 && !/\t/.test(t) && !/^\s*(?:\d+\s*[.)、．:：]|[(（]?[A-Da-d][)）.．、])/.test(t) && !/[?？]/.test(t)) return true;
  if (reCJK.test(t) && !/[A-Za-z]/.test(t) && t.length <= 14 && /(课|課|章|单元|單元|词汇|詞彙|话题|話題|主题|主題|语法|語法|练习|練習|复习|復習)/.test(t)) return true;
  return false;
}

/* ---------- level helpers ---------- */
function normLevel(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (!s) return '';
  if (ORDER.includes(s)) return s;
  if (/^(1|e|beginner|basic|初级|初級|入门|简单|簡單)$/.test(s)) return 'easy';
  if (/^(2|m|med|intermediate|中级|中級|一般)$/.test(s)) return 'medium';
  if (/^(3|h|advanced|高级|高級|难|難|困难)$/.test(s)) return 'hard';
  const hsk = s.match(/hsk\s*(\d)/) || s.match(/^(\d)\s*级/);
  if (hsk) { const n = +hsk[1]; return n <= 2 ? 'easy' : n <= 4 ? 'medium' : 'hard'; }
  return '';
}
const levelByZh = n => n <= 2 ? 'easy' : n <= 4 ? 'medium' : 'hard';

/* ---------- structured question lists (JSON / CSV with options) ---------- */
function fromStructured(list, warn) {
  const out = []; let skipped = 0, firstErr = '';
  list.forEach((o, i) => {
    try {
      const level = normLevel(o.level) || 'medium';
      let opts = Array.isArray(o.options) ? o.options.map(String) : ['option_a', 'option_b', 'option_c', 'option_d'].map(k => o[k]).filter(v => v != null && String(v).trim() !== '').map(String);
      opts = opts.map(x => x.trim()).filter(Boolean);
      let a = o.answer;
      if (typeof a === 'number') a = a; else { const s = String(a == null ? '' : a).trim(); a = /^[A-Da-d]$/.test(s) ? 'abcd'.indexOf(s.toLowerCase()) : opts.indexOf(s); }
      if (!o.prompt || opts.length < 2 || !(a >= 0 && a < opts.length)) throw new Error('Row ' + (i + 1) + ' needs a prompt, 2+ options and a valid answer.');
      out.push({ id: o.id || ('I' + String(i + 1).padStart(4, '0')), level, topic: o.topic || 'General', prompt: String(o.prompt), pinyin: o.pinyin || '', options: opts, answer: a, explain: o.explain || '', group: 'S' + i });
    } catch (e) { skipped++; if (!firstErr) firstErr = e.message; }
  });
  if (skipped) warn.push('Skipped ' + skipped + ' row(s) that were incomplete. First problem: ' + firstErr);
  return out;
}
function rowsToObjects(rows) {
  const head = rows[0].map(h => String(h).trim().toLowerCase());
  return rows.slice(1).map(r => { const o = {}; head.forEach((h, i) => { o[h] = r[i] == null ? '' : String(r[i]).trim(); }); return o; });
}

/* ---------- typed quiz papers: "1. question  A) ..  B) ..  Answer: B" ---------- */
const OPT_RE = /^\s*[(（]?([A-Da-dＡ-Ｄ])[)）.．、:：]\s*(\S.*)$/;
const Q_RE = /^\s*(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[.)、．:：）]\s*(\S.*)$/i;
const ANS_RE = /^\s*(?:answer|ans\.?|correct answer|key|答案|正确答案|參考答案|参考答案)\s*[:：=\-]?\s*[(（]?([A-Da-dＡ-Ｄ])[)）]?/i;
const KEYLINE_RE = /^\s*(?:(?:answers?|answer key|key|答案)\s*[:：]?\s*(?:\d{1,3}\s*[.)、:：\-]?\s*[A-Da-d]\s*[,;，；\s]*)+|(?:\d{1,3}\s*[.)、:：\-]?\s*[A-Da-d]\s*[,;，；\s]*){3,})$/i;
const toIdx = c => 'abcd'.indexOf(String(c).toLowerCase().replace(/[Ａ-Ｄ]/, x => 'abcd'['ＡＢＣＤ'.indexOf(x)]));
function splitInlineOptions(line) {
  const parts = line.split(/(?:^|\s)(?=[(（]?[A-DＡ-Ｄ][)）.．、]\s*\S)/).map(s => s.trim()).filter(Boolean);
  return parts.length >= 3 && parts.every(p => OPT_RE.test(p)) ? parts : null;
}
function parseMCQ(entries) { // entries: [{text, idx, heading}]
  const qs = [], used = new Set(), keyMap = {}; let cur = null, skipped = 0;
  const finish = () => {
    if (cur && cur.options.length >= 2) qs.push(cur);
    cur = null;
  };
  for (const e of entries) {
    const t = e.text;
    if (KEYLINE_RE.test(t)) {
      (t.match(/(\d{1,3})\s*[.)、:：\-]?\s*([A-Da-d])/g) || []).forEach(p => { const m = p.match(/(\d{1,3})\s*[.)、:：\-]?\s*([A-Da-d])/); keyMap[+m[1]] = toIdx(m[2]); });
      used.add(e.idx); continue;
    }
    const ans = t.match(ANS_RE);
    if (ans && cur) { cur.answer = toIdx(ans[1]); cur.lines.push(e.idx); continue; }
    const inline = splitInlineOptions(t);
    if (inline && cur) { inline.forEach(p => cur.options.push(p.match(OPT_RE)[2].trim())); cur.lines.push(e.idx); continue; }
    const o = t.match(OPT_RE);
    if (o && cur && (cur.options.length || cur.prompt)) { cur.options.push(o[2].trim()); cur.lines.push(e.idx); continue; }
    const q = t.match(Q_RE);
    if (q && !HEAD_RE.test(t)) { finish(); cur = { num: +q[1], prompt: q[2].trim(), options: [], answer: -1, lines: [e.idx], topic: e.topic }; continue; }
    if (cur && !cur.options.length && cur.prompt.length < 300 && !e.heading) { cur.prompt += ' ' + t.trim(); cur.lines.push(e.idx); continue; }
  }
  finish();
  const good = [];
  qs.forEach(q => {
    if (q.answer < 0 && keyMap[q.num] != null) q.answer = keyMap[q.num];
    q.lines.forEach(i => used.add(i));
    if (q.answer >= 0 && q.answer < q.options.length) good.push(q); else skipped++;
  });
  return { qs: good, used, skipped };
}

/* ---------- distractors ---------- */
function distract(correct, pool, n, metric, fallback) {
  const norm = s => String(s).toLowerCase().replace(/\s+/g, '');
  const c = norm(correct), seen = new Set([c]);
  const base = metric(correct);
  const cand = sample(pool, 70).filter(x => { const k = norm(x); if (seen.has(k)) return false; seen.add(k); return true; });
  const out = cand.map(x => [Math.abs(metric(x) - base) + Math.random() * 2.5, x]).sort((a, b) => a[0] - b[0]).slice(0, n).map(x => x[1]);
  for (const f of shuffle(fallback)) { if (out.length >= n) break; if (!seen.has(norm(f)) && !out.includes(f)) { out.push(f); seen.add(norm(f)); } }
  return out;
}
const lenMetric = s => String(s).length;

function segmentWords(sentence) {
  const out = [];
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter('zh', { granularity: 'word' });
      for (const s of seg.segment(sentence)) if (s.isWordLike && reCJK.test(s.segment)) out.push({ w: s.segment, i: s.index });
      return out;
    }
  } catch (e) { /* fall through */ }
  const chars = [...sentence];
  for (let i = 0; i + 1 < chars.length; i += 2) { const w = chars[i] + chars[i + 1]; if (reCJK.test(chars[i]) && reCJK.test(chars[i + 1])) out.push({ w, i: chars.slice(0, i).join('').length }); }
  return out;
}

/* ---------- main ---------- */
/**
 * doc = { name, blocks: [{t:'p',text} | {t:'h',text} | {t:'row',cells:[..]}], json? }
 * returns { questions, stats, warnings }
 */
function fromDoc(doc, opts) {
  opts = opts || {};
  const warnings = [], baseName = doc.name || 'Imported coverage';
  const blocks = doc.blocks || [];

  /* 1) JSON question lists */
  if (doc.json) {
    const j = doc.json, list = Array.isArray(j) ? j : (j && Array.isArray(j.questions) ? j.questions : null);
    if (list && list.length && list.some(o => o && typeof o === 'object' && o.prompt)) {
      const qs = fromStructured(list.filter(o => o && typeof o === 'object'), warnings);
      if (qs.length) return { name: (j && j.name) || baseName, questions: qs, stats: { structured: qs.length }, warnings };
    }
  }
  /* 1b) CSV with prompt/option columns */
  const rowBlocks = blocks.filter(b => b.t === 'row');
  if (rowBlocks.length > 1) {
    const h = rowBlocks[0].cells.map(c => String(c).trim().toLowerCase());
    if (h.includes('prompt') && (h.includes('option_a') || h.includes('options'))) {
      const qs = fromStructured(rowsToObjects(rowBlocks.map(b => b.cells)), warnings);
      if (qs.length) return { name: baseName, questions: qs, stats: { structured: qs.length }, warnings };
    }
  }

  /* walk blocks: track headings (= topics), gather lines */
  let topic = baseName, header = null;
  const lines = []; // {kind:'line'|'row', text|cells, topic, idx}
  blocks.forEach((b, idx) => {
    if (b.t === 'h') { topic = headingText(b.text) || topic; return; }
    if (b.t === 'row') { lines.push({ kind: 'row', cells: b.cells, topic, idx, start: !!b.start }); return; }
    const text = (b.text || '').trim(); if (!text) return;
    if (isHeading(text) && !/\t/.test(text)) { topic = headingText(text) || topic; lines.push({ kind: 'heading', text, topic, idx }); return; }
    lines.push({ kind: 'line', text, topic, idx });
  });

  const out = [], stats = { items: 0, sentences: 0, mcq: 0 };
  let n = 0;
  const nextId = () => 'G' + String(++n).padStart(4, '0');

  /* 2) typed quiz paper */
  const consumed = new Set();
  const mcqIn = lines.filter(l => l.kind === 'line' || l.kind === 'heading').map(l => ({ text: l.text, idx: l.idx, topic: l.topic, heading: l.kind === 'heading' }));
  if (mcqIn.length) {
    const r = parseMCQ(mcqIn);
    if (r.qs.length >= 2) {
      r.qs.forEach(q => {
        const plen = cjkLen(q.prompt) || q.prompt.length;
        const level = plen <= 3 && q.options.every(o => o.length <= 12) ? 'easy' : plen > 14 ? 'hard' : 'medium';
        out.push({ id: nextId(), level, topic: q.topic || baseName, prompt: q.prompt, pinyin: '', options: q.options, answer: q.answer, explain: '', group: 'Q' + q.num + '-' + n });
      });
      stats.mcq = r.qs.length; r.used.forEach(i => consumed.add(i));
      if (r.skipped) warnings.push(r.skipped + ' quiz question(s) had no answer I could find, so I skipped them.');
    }
  }

  /* 3) vocabulary + sentences */
  const items = [], sentences = [], words = new Set(); const seenKey = new Set();
  const addItem = (it, tp, level) => {
    const key = it.zh + '|' + (it.en || it.py).toLowerCase();
    if (seenKey.has(key)) return; seenKey.add(key);
    items.push(Object.assign(it, { topic: tp, level }));
  };
  const addSentence = (s, tp) => { if (cjkLen(s) >= 4 && s.length <= 70) sentences.push({ zh: s, topic: tp }); };
  const addWords = txt => { for (const m of txt.matchAll(reCJKish)) { const w = trimZh(m[0]); if (cjkLen(w) >= 2 && cjkLen(w) <= 4 && !/[，。！？、；：…]/.test(w)) words.add(w); } };

  // header row mapping for tables (hanzi | pinyin | english | topic | level)
  const HDR = { zh: /hanzi|chinese|character|mandarin|word|汉字|漢字|中文|词|詞|字|vocab/i, py: /pinyin|pronunc|拼音|romani/i, en: /english|meaning|translat|definition|gloss|英文|英语|英語|意思|翻译|翻譯/i, tp: /topic|categor|lesson|unit|chapter|theme|group|主题|主題|类别|類別|课|課/i, lv: /level|difficult|hsk|级|級|难度|難度/i, ex: /example|sentence|例句/i };
  const detectHeader = cells => {
    const map = {}; let hits = 0;
    cells.forEach((c, i) => {
      const t = String(c).trim();
      if (!t || t.length > 24) return;
      for (const k of Object.keys(HDR)) if (map[k] == null && HDR[k].test(t)) { map[k] = i; hits++; break; }
    });
    return hits >= 2 ? map : null;
  };

  let firstRow = true;
  lines.forEach(l => {
    if (consumed.has(l.idx) || l.kind === 'heading') return;
    if (l.kind === 'row') {
      if (l.start) { firstRow = true; header = null; }
      const cells = l.cells.map(c => String(c == null ? '' : c).trim());
      if (!cells.some(Boolean)) return;
      if (firstRow) { firstRow = false; const m = detectHeader(cells); if (m) { header = m; return; } }
      if (header) {
        const g = k => (header[k] != null ? cells[header[k]] || '' : '');
        const zhRaw = g('zh'), zh = trimZh(zhRaw);
        if (zh && reCJK.test(zh)) {
          const en = g('en').trim(), py = g('py').trim(), tp = g('tp').trim() || l.topic, lv = normLevel(g('lv')) || '';
          if (en || py) addItem({ zh, py, en }, tp, lv || levelByZh(cjkLen(zh)));
          else addWords(zh);
          const ex = g('ex'); if (ex) addSentence(trimZh(ex), tp);
          return;
        }
      }
      const e = parseEntry(cells);
      if (e && (e.en || e.py)) { addItem(e, l.topic, levelByZh(cjkLen(e.zh))); e.extra.forEach(x => addSentence(x, l.topic)); }
      else if (e) { cells.forEach(c => { const z = trimZh(c); if (reCJK.test(z)) { addSentence(z, l.topic); addWords(z); } }); }
      return;
    }
    /* plain line */
    const text = l.text;
    if (!reCJK.test(text)) return;
    const e = parseEntry(text.split('\t'));
    if (!e) return;
    const latinWords = (text.replace(reCJKish, ' ').match(/[A-Za-z]{2,}/g) || []).length;
    // long CJK-only lines are sentences/paragraphs; lines that pair Chinese with English/pinyin are vocabulary
    if ((e.en || e.py) && !(latinWords === 0 && cjkLen(text) > 12)) {
      addItem(e, l.topic, levelByZh(cjkLen(e.zh)));
      e.extra.forEach(x => addSentence(x, l.topic));
    } else {
      for (const m of text.matchAll(/[^。！？!?；;\n]+[。！？!?；;]?/g)) { const s = trimZh(m[0]).replace(/^\d+[.)、]\s*/, ''); if (reCJK.test(s)) { addSentence(s, l.topic); addWords(s); } }
    }
  });
  items.forEach(it => { if (cjkLen(it.zh) >= 2 && cjkLen(it.zh) <= 4) words.add(it.zh); });
  // long vocab entries (full sentences with a translation) can also be fill-in-the-blank sources
  items.forEach(it => { if (cjkLen(it.zh) >= 5) sentences.push({ zh: it.zh, topic: it.topic, en: it.en }); });

  const withEn = items.filter(i => i.en), withPy = items.filter(i => i.py);
  const enPool = [...new Set(withEn.map(i => i.en))], zhPool = [...new Set(items.map(i => i.zh))], pyPool = [...new Set(withPy.map(i => i.py))];
  const zhLenMetric = s => cjkLen(s) || String(s).length;
  const MAX_ITEMS = 1800, MAX_SENT = 1500;
  stats.items = items.length;

  items.slice(0, MAX_ITEMS).forEach(it => {
    const g = 'V' + it.zh;
    if (it.en) {
      const opts = [it.en, ...distract(it.en, enPool, 3, lenMetric, FALLBACK_EN)];
      out.push({ id: nextId(), level: it.level, topic: it.topic, prompt: it.zh, pinyin: it.py, options: opts, answer: 0, explain: it.zh + (it.py ? ' (' + it.py + ')' : '') + ' = ' + it.en, group: g });
      if (cjkLen(it.zh) <= 8 && it.en.length <= 60) {
        const o2 = [it.zh, ...distract(it.zh, zhPool, 3, zhLenMetric, FALLBACK_ZH)];
        out.push({ id: nextId(), level: bump(it.level), topic: it.topic, prompt: 'How do you say “' + it.en + '”?', pinyin: '', options: o2, answer: 0, explain: it.zh + (it.py ? ' (' + it.py + ')' : '') + ' = ' + it.en, group: g });
      }
    }
    if (it.py && cjkLen(it.zh) <= 8 && pyPool.length >= 3) {
      const o3 = [it.py, ...distract(it.py, pyPool, 3, lenMetric, FALLBACK_PY)];
      out.push({ id: nextId(), level: it.level === 'hard' ? 'hard' : 'medium', topic: it.topic, prompt: 'Which is the pinyin for ' + it.zh + '?', pinyin: '', options: o3, answer: 0, explain: it.zh + ' = ' + it.py + (it.en ? ' (' + it.en + ')' : ''), group: g });
    }
  });

  /* fill-in-the-blank from sentences */
  const seenS = new Set(), segs = [];
  sentences.slice(0, MAX_SENT).forEach(s => {
    if (seenS.has(s.zh)) return; seenS.add(s.zh);
    const cands = segmentWords(s.zh).filter(x => { const L = cjkLen(x.w); return L >= 2 && L <= 4 && !/[，。！？、；：…]/.test(x.w); });
    cands.forEach(x => words.add(x.w));
    if (cands.length) segs.push({ s, cands });
  });
  const wordPool = [...words];
  segs.forEach(({ s, cands }) => {
    const pick = cands[rnd(cands.length)];
    const stem = s.zh.slice(0, pick.i) + '＿＿' + s.zh.slice(pick.i + pick.w.length);
    const opts = [pick.w, ...distract(pick.w, wordPool, 3, zhLenMetric, FALLBACK_ZH)];
    if (opts.length < 3) return;
    out.push({ id: nextId(), level: cjkLen(s.zh) >= 16 ? 'hard' : 'medium', topic: s.topic, prompt: stem, pinyin: '', options: opts, answer: 0, explain: s.zh + (s.en ? ' = ' + s.en : ''), group: 'C' + s.zh });
    stats.sentences++;
  });

  /* de-duplicate prompts, cap size, shuffle option order is done at quiz time */
  const seenP = new Set();
  let qs = out.filter(q => { const k = q.prompt + '|' + q.options[q.answer]; if (seenP.has(k)) return false; seenP.add(k); return true; });
  if (qs.length > 6000) { warnings.push('That file was huge, so I kept a 6,000-question sample.'); qs = shuffle(qs).slice(0, 6000); }
  return { name: baseName, questions: qs, stats, warnings };
}

M.generate = { fromDoc, parseEntry, takePinyin, segmentSyllables, isHeading, normLevel, fromStructured, parseMCQ };
if (typeof module !== 'undefined' && module.exports) module.exports = M.generate;
})();
