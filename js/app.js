(() => {
'use strict';
const M = window.MMT;
const HER = Object.assign({ name: 'Ate', from: '', since: '', notes: [] }, window.HER || {});
const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const ORDER = ['easy', 'medium', 'hard'], PTS = { easy: 1, medium: 2, hard: 3 };
const LABEL = { easy: 'Easy 🍌', medium: 'Medium 🐵', hard: 'Hard 🌴' };
const STARTER = { id: 'starter', name: window.QUESTION_BANK.name, count: window.QUESTION_BANK.questions.length, builtin: true };
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const show = id => { document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== id; }); scrollTo(0, 0); if (id !== 'quiz') M.stickers.hush(); };
const say = (e, t, err) => { e.textContent = t; e.className = 'msg' + (err ? ' err' : ''); };
const fmtBytes = n => n > 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB';
const cjkOnly = s => (String(s).match(/[\u3400-\u9fff，。？！]+/g) || []).join('');
const dayKey = d => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200); }

const S = { metas: [], bankId: 'starter', questions: [], cache: new Map(), level: 'all', countTouched: false, selLevels: new Set(), selTopics: new Set(), results: [], mistakes: [], voice: false, lastImported: null };
let cur = null, last = null;

/* ================= PERSONAL HOME ================= */
const TIMES = [
  { key: 'morning', from: 5, emoji: '🌅', hi: 'Good morning', zh: '早上好', py: 'zǎoshang hǎo' },
  { key: 'day', from: 12, emoji: '🌞', hi: 'Good afternoon', zh: '下午好', py: 'xiàwǔ hǎo' },
  { key: 'evening', from: 18, emoji: '🌇', hi: 'Good evening', zh: '晚上好', py: 'wǎnshang hǎo' },
  { key: 'night', from: 22, emoji: '🌙', hi: 'Still up', zh: '晚安', py: 'wǎn’ān' }
];
function timeOfDay() { const h = new Date().getHours(); if (h < 5) return TIMES[3]; return TIMES.slice().reverse().find(t => h >= t.from) || TIMES[0]; }
function personalise() {
  const t = timeOfDay();
  document.body.dataset.time = t.key;
  const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.content = t.key === 'night' ? '#2F2B52' : t.key === 'evening' ? '#FFD8B8' : '#FFE98F';
  $('#hiEmoji').textContent = t.emoji; $('#hiTime').textContent = t.hi + ',';
  $('#hiName').textContent = HER.name + (t.key === 'night' ? ' 🌙' : '!');
  $('#hiZh').textContent = t.zh; $('#hiPy').textContent = t.py;
  $('#hiSay').onclick = () => M.speak(t.zh);
  const notes = HER.notes.length ? HER.notes : ['Every new word is a tiny banana 🍌'];
  const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
  $('#noteTxt').textContent = notes[doy % notes.length];
  $('#noteFrom').textContent = HER.from ? '— ' + HER.from + ' 💛' : '';
  if (HER.since && !isNaN(new Date(HER.since))) {
    const days = Math.floor((Date.now() - new Date(HER.since)) / 864e5) + 1;
    if (days > 0) { const p = $('#sincePill'); p.textContent = 'Day ' + days + ' together 💛'; p.hidden = false; }
  }
  return t;
}
function streakDays(results) {
  const days = new Set(results.map(r => dayKey(new Date(r.date))));
  let d = new Date(), n = 0;
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function renderStats() {
  const r = S.results, box = $('#stats'); box.textContent = '';
  const tiles = [['🔥', streakDays(r), 'day streak'], ['✅', r.length, r.length === 1 ? 'test taken' : 'tests taken'], ['⭐', r.length ? Math.max(...r.map(x => x.percent)) + '%' : '–', 'best score'], ['🍌', r.reduce((a, x) => a + (x.correct || 0), 0), 'answers right']];
  tiles.forEach(([e, n, l]) => { const d = el('div', 'stat'); d.append(el('span', 'e', e), el('b', null, String(n)), el('span', null, l)); box.append(d); });
}
function renderToday() {
  const box = $('#wotd'); box.textContent = ''; box.hidden = false;
  let pool = S.questions.filter(q => q.pinyin && /^[\u3400-\u9fff]+$/.test(q.prompt) && q.options[q.answer] && /^[\x20-\x7e]+$/.test(q.options[q.answer]));
  if (!pool.length) pool = window.QUESTION_BANK.questions.filter(q => q.pinyin && /^[\u3400-\u9fff]+$/.test(q.prompt) && /^[\x20-\x7e]+$/.test(q.options[q.answer]));
  if (pool.length) {
    const seed = [...dayKey()].reduce((a, c) => a + c.charCodeAt(0) * 7, 0), q = pool[seed % pool.length];
    const b = el('button', 'mini', '🔊'); b.type = 'button'; b.setAttribute('aria-label', 'Hear the word'); b.onclick = () => M.speak(q.prompt);
    const t = el('div'); t.append(el('small', null, 'Word of the day'), el('b', null, q.pinyin + ' = ' + q.options[q.answer]));
    box.append(el('span', 'big', q.prompt), t, b);
  } else box.hidden = true;
  const mb = $('#mistakes'); mb.hidden = !S.mistakes.length;
  mb.textContent = 'Practice what I missed (' + S.mistakes.length + ') 🧠';
}

/* ================= LIBRARY / BUILDER ================= */
async function loadQuestions(id) {
  if (id === 'starter') return window.QUESTION_BANK.questions.map(q => Object.assign({ group: q.id }, q));
  if (!S.cache.has(id)) S.cache.set(id, await M.db.getQuestions(id));
  return S.cache.get(id);
}
function renderLibrary() {
  const box = $('#libList'); box.textContent = '';
  S.metas.forEach(m => {
    const row = el('div', 'libitem' + (m.id === S.bankId ? ' sel' : ''));
    const meta = el('div', 'meta'); meta.append(el('b', null, m.name), el('small', null, m.count + ' questions' + (m.builtin ? ' · built in' : ' · ' + new Date(m.created).toLocaleDateString())));
    const acts = el('div', 'acts');
    const use = el('button', 'tiny' + (m.id === S.bankId ? ' on' : ''), m.id === S.bankId ? '✓ In use' : 'Use'); use.type = 'button'; use.onclick = () => selectBank(m.id);
    acts.append(use);
    if (m.hasFile) { const dl = el('button', 'tiny', '⬇'); dl.type = 'button'; dl.title = 'Download the original file'; dl.setAttribute('aria-label', 'Download original file for ' + m.name); dl.onclick = () => downloadOriginal(m); acts.append(dl); }
    if (!m.builtin) { const del = el('button', 'tiny', '🗑'); del.type = 'button'; del.setAttribute('aria-label', 'Delete ' + m.name); del.onclick = () => removeBank(m); acts.append(del); }
    row.append(meta, acts); box.append(row);
  });
  refreshUsage();
}
async function refreshUsage() {
  const u = await M.db.usage(), foot = $('#libFoot'), chip = $('#storeChip');
  const n = S.metas.length - 1;
  foot.textContent = n + (n === 1 ? ' imported coverage' : ' imported coverages') + ' saved on this device' + (u ? ' · ' + fmtBytes(u.used) + ' used of ' + fmtBytes(u.quota) + ' available' : '') + (M.db.mode() === 'memory' ? ' · ⚠️ private mode: nothing will be kept after you close this tab' : '');
  if (u) { $('#storeTxt').textContent = fmtBytes(u.used); chip.hidden = false; }
}
async function selectBank(id, keepFilters) {
  S.bankId = id; await M.db.kvSet('bank', id);
  S.questions = await loadQuestions(id);
  const m = S.metas.find(x => x.id === id) || STARTER;
  $('#bankLine').textContent = m.name + ' · ' + S.questions.length + ' questions';
  renderCoverage(); renderLibrary(); renderToday();
}
function chip(text, on, fn) {
  const b = el('button', 'chip', text); b.type = 'button'; b.setAttribute('aria-pressed', on);
  b.onclick = () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', v); fn(v); updateAvail(); };
  return b;
}
function renderCoverage() {
  const qs = S.questions; S.level = 'all'; S.countTouched = false;
  const counts = {}; qs.forEach(q => { counts[q.topic] = (counts[q.topic] || 0) + 1; });
  const tops = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  S.selTopics = new Set(tops);
  const tp = $('#topics'); tp.textContent = '';
  tops.slice(0, 30).forEach(t => tp.append(chip(t, true, on => on ? S.selTopics.add(t) : S.selTopics.delete(t))));
  if (tops.length > 30) tp.append(el('small', null, '…and ' + (tops.length - 30) + ' more topics (all included)'));
  const pr = $('#presets'); pr.textContent = '';
  [5, 10, 20].forEach(n => { const b = el('button', 'chip', String(n)); b.type = 'button'; b.onclick = () => { S.countTouched = true; $('#count').value = n; }; pr.append(b); });
  const all = el('button', 'chip', 'All'); all.type = 'button'; all.onclick = () => { S.countTouched = false; $('#count').value = pool().length; }; pr.append(all);
  updateAvail();
}
const pool = () => S.questions.filter(q => S.selLevels.has(q.level) && S.selTopics.has(q.topic));
const lvlPool = l => S.questions.filter(q => (l === 'all' || q.level === l) && S.selTopics.has(q.topic));
function renderLevels() {   // difficulty buttons: she picks All / Easy / Medium / Hard
  const lv = $('#levels'); lv.textContent = '';
  if (S.level !== 'all' && !lvlPool(S.level).length) S.level = 'all';
  S.selLevels = new Set(S.level === 'all' ? ORDER : [S.level]);
  [['all', '🎯 All levels'], ['easy', '🍌 Easy'], ['medium', '🐵 Medium'], ['hard', '🌴 Hard']].forEach(([l, name]) => {
    const n = lvlPool(l).length, b = el('button', 'lvl'); b.type = 'button'; b.disabled = !n; b.setAttribute('aria-pressed', l === S.level);
    b.append(el('b', null, name), el('small', null, n + ' questions' + (l === 'all' ? ' · easy → hard' : '')));
    b.onclick = () => { S.level = l; S.countTouched = false; updateAvail(); };
    lv.append(b);
  });
}
function updateAvail() {
  renderLevels(); const n = pool().length;
  $('#avail').textContent = n + ' questions match';
  $('#count').max = n; if (!S.countTouched) $('#count').value = n;   // default = ALL questions
}
$('#count').addEventListener('input', () => { S.countTouched = true; });
async function removeBank(m) {
  if (!confirm('Delete “' + m.name + '” from this device?')) return;
  await M.db.deleteBank(m.id); await M.db.clearMistakesFor(m.id); S.cache.delete(m.id);
  S.metas = [STARTER, ...(await M.db.listBanks())]; S.mistakes = await M.db.listMistakes();
  if (S.bankId === m.id) await selectBank('starter'); else renderLibrary();
  renderToday(); toast('Deleted ✔');
}
async function downloadOriginal(m) {
  const f = await M.db.getFile(m.id); if (!f) return toast('That file is no longer stored.');
  const a = document.createElement('a'); a.href = URL.createObjectURL(f.blob); a.download = f.name || m.name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ================= IMPORT ================= */
const queue = []; let busy = false;
function enqueue(files) { files.forEach(f => queue.push(f)); if (!busy) runQueue(); else toast('Added to the line 🐒'); }
function progShow(name) { $('#prog').hidden = false; $('#progName').textContent = name; $('#progFill').style.width = '4%'; $('#progLabel').textContent = 'Starting…'; }
function progSet(p) { if (p.label) $('#progLabel').textContent = p.label; $('#progFill').style.width = (p.pct == null ? 12 : Math.max(4, Math.round(p.pct * 100))) + '%'; }
function logLine(text, bad) { const d = el('div', bad ? 'bad' : null, text); $('#progLog').prepend(d); }
async function runQueue() {
  busy = true; $('#importOk').hidden = true; $('#progLog').textContent = '';
  let good = null;
  M.stickers.say('importStart');
  while (queue.length) {
    const file = queue.shift();
    progShow(file.name || 'Pasted text');
    try {
      if (file.size > 150e6) toast('That’s a big one - this may take a minute ⏳');
      let cov = null;   // a plain word-list CSV (topic,word,pinyin,meaning) -> full easy/medium/hard question set
      if (/\.csv$/i.test(file.name || '')) { try { cov = window.coverageFromText((await file.text()).replace(/^\uFEFF/, '').trim(), (file.name || '').replace(/\.\w+$/, ''), null); } catch (e) { cov = null; } }
      const doc = cov ? { kind: 'coverage', notes: [] } : await M.extract(file, progSet);
      progSet({ label: 'Building questions…', pct: 0.95 }); await new Promise(r => setTimeout(r, 20));
      const res = cov ? { name: cov.name.replace(' (auto-generated)', ''), questions: cov.questions, stats: { structured: cov.questions.length }, warnings: [] } : M.generate.fromDoc(doc);
      if (!res.questions.length) throw new Error('I couldn’t find Chinese words or questions in “' + file.name + '”. Words with pinyin or English next to them work best (word lists, lesson notes, tables, a photo of a textbook page).');
      const meta = M.db.makeMeta(res.name, res.questions, { source: doc.kind, fileName: file.name });
      await M.db.saveBank(meta, res.questions, file.name ? file : null);
      S.cache.set(meta.id, res.questions);
      const extra = [res.stats.items && res.stats.items + ' words', res.stats.sentences && res.stats.sentences + ' sentences', res.stats.mcq && res.stats.mcq + ' quiz questions', res.stats.structured && res.stats.structured + ' ready-made questions'].filter(Boolean).join(', ');
      logLine('✅ ' + file.name + ' → ' + res.questions.length + ' questions' + (extra ? ' (' + extra + ')' : ''));
      [...res.warnings, ...doc.notes].forEach(w => logLine('ℹ️ ' + w));
      good = meta;
    } catch (e) {
      logLine('❌ ' + (file.name || 'Pasted text') + ': ' + (e && e.message ? e.message : 'something went wrong'), true);
      M.stickers.say('importFail');
    }
  }
  $('#prog').hidden = !$('#progLog').children.length;
  $('#progFill').style.width = '100%'; $('#progName').textContent = 'All done'; $('#progLabel').textContent = '';
  busy = false;
  if (good) {
    S.metas = [STARTER, ...(await M.db.listBanks())]; S.lastImported = good.id;
    await selectBank(good.id);
    $('#okTitle').textContent = 'Ready: “' + good.name + '” (' + good.count + ' questions)';
    $('#okSub').textContent = 'Pick levels or topics below, or just go!';
    $('#importOk').hidden = false; $('#importOk').scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    M.stickers.say('importDone', { n: good.count }); M.stickers.party();
  }
}
const textFile = (text, name) => new File([text], name || 'Pasted text.txt', { type: 'text/plain' });

function wireImport() {
  const drop = $('#drop'), input = $('#file'), scan = $('#scan');
  const open = () => input.click();
  drop.addEventListener('click', e => { if (!e.target.closest('button')) open(); });
  drop.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === drop) { e.preventDefault(); open(); } });
  $('#pickBtn').onclick = open; $('#scanBtn').onclick = () => scan.click();
  input.onchange = () => { enqueue([...input.files]); input.value = ''; };
  scan.onchange = () => { enqueue([...scan.files]); scan.value = ''; };
  $('#importPaste').onclick = () => { const t = $('#paste').value; if (t.trim()) { enqueue([textFile(t)]); $('#paste').value = ''; } };
  $('#okStart').onclick = () => startTest('normal');

  let depth = 0, lastHover = 0;
  const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); depth++; $('#dropOverlay').hidden = false; drop.classList.add('over'); if (Date.now() - lastHover > 5000) { lastHover = Date.now(); M.stickers.say('dropHover'); } });
  addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  addEventListener('dragleave', e => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) { $('#dropOverlay').hidden = true; drop.classList.remove('over'); } });
  addEventListener('drop', e => {
    if (!e.dataTransfer) return;
    e.preventDefault(); depth = 0; $('#dropOverlay').hidden = true; drop.classList.remove('over');
    const files = [...e.dataTransfer.files];
    if (files.length) { show('home'); enqueue(files); }
    else { const t = e.dataTransfer.getData('text/plain'); if (t && t.trim()) { show('home'); enqueue([textFile(t)]); } }
  });
  addEventListener('paste', e => {
    const files = [...(e.clipboardData ? e.clipboardData.files : [])];
    if (files.length && !$('#home').hidden) { e.preventDefault(); enqueue(files.map((f, i) => f.name && f.name !== 'image.png' ? f : new File([f], 'Pasted picture ' + (i + 1) + '.png', { type: f.type }))); }
  });
}

/* ================= QUIZ ================= */
function pickQuestions(p, n) {
  const sh = shuffle(p), seen = new Set(), first = [], rest = [];
  sh.forEach(q => { const g = q.group || q.id; if (seen.has(g)) rest.push(q); else { seen.add(g); first.push(q); } });
  return first.concat(rest).slice(0, n);
}
async function startTest(mode) {
  let qs, bankName;
  if (mode === 'mistakes') {
    const ms = await M.db.listMistakes();
    if (!ms.length) return toast('No mistakes saved - nice! 🎉');
    qs = shuffle(ms).slice(0, 15).map(m => Object.assign({}, m.q, { bankId: m.bankId })); bankName = 'My mistakes';
  } else {
    const p = pool(); if (!p.length) return say($('#homeMsg'), 'Pick at least one level and topic.', true);
    const n = Math.max(1, Math.min(+$('#count').value || p.length, p.length));
    qs = pickQuestions(p, n).map(q => Object.assign({}, q, { bankId: S.bankId })); bankName = (S.metas.find(m => m.id === S.bankId) || STARTER).name;
  }
  qs.sort((a, b) => ORDER.indexOf(a.level) - ORDER.indexOf(b.level));
  cur = { level: S.level, bank: bankName, qs, i: 0, answers: [], streak: 0, hints: 0, hinted: 0, mistakesMode: mode === 'mistakes' };
  say($('#homeMsg'), ''); $('#importOk').hidden = true; show('quiz'); showQ();
  M.stickers.say('quizStart');
}
function showQ() {
  const q = cur.qs[cur.i];
  $('#qCount').textContent = 'Question ' + (cur.i + 1) + ' / ' + cur.qs.length;
  $('#qLevel').textContent = LABEL[q.level];
  $('#barFill').style.width = (cur.i / cur.qs.length * 100) + '%';
  $('#qTopic').textContent = q.topic; $('#qPrompt').textContent = q.prompt; $('#qPinyin').textContent = q.pinyin || '';
  $('#fb').textContent = ''; $('#next').hidden = true; cur.hinted = 0;
  const hb = $('#hint'); hb.disabled = false; hb.hidden = false;
  const zh = cjkOnly(q.prompt);
  const sb = $('#say'); sb.hidden = !zh || !('speechSynthesis' in window); sb.dataset.t = zh;
  const opts = shuffle(q.options.map((t, i) => ({ t, ok: i === q.answer })));
  const box = $('#opts'); box.textContent = '';
  opts.forEach((o, i) => {
    const b = el('button', 'opt'); b.type = 'button';
    b.append(el('span', 'k', String(i + 1)), el('span', 'tx', o.t));
    b.onclick = () => choose(b, o, opts, q);
    box.append(b); o.el = b;
  });
  cur.opts = opts; cur.locked = false;
  if (S.voice && zh) M.speak(zh);
}
function choose(btn, o, opts, q) {
  if (cur.locked) return; cur.locked = true;
  opts.forEach(x => { x.el.disabled = true; if (x.ok) x.el.classList.add('ok'); });
  if (!o.ok) btn.classList.add('no');
  const correct = opts.find(x => x.ok).t;
  cur.answers.push({ id: q.id, level: q.level, topic: q.topic, prompt: q.prompt, chosen: o.t, correct, isCorrect: o.ok, hinted: cur.hinted > 0 });
  M.db.noteAnswer(q.bankId, q, o.ok).catch(() => {});
  $('#hint').disabled = true;
  $('#fb').textContent = (o.ok ? '🎉 Correct! ' : '🙈 Not quite. ') + (q.explain || '');
  const zhA = cjkOnly(correct), sb = $('#say'); if (zhA && 'speechSynthesis' in window) { sb.dataset.t = zhA; sb.hidden = false; }
  if (o.ok) {
    cur.streak++;
    const sp = $('#streakPill'); if (cur.streak >= 2) { sp.textContent = '🔥 ' + cur.streak; sp.hidden = false; sp.style.animation = 'none'; void sp.offsetWidth; sp.style.animation = ''; }
    M.stickers.react(null, 'hop');
    if (cur.streak === 3 || cur.streak === 5 || cur.streak === 8) M.stickers.say('streak', { streak: cur.streak });
    else if (Math.random() < 0.6) M.stickers.say('correct');
  } else {
    cur.streak = 0; $('#streakPill').hidden = true;
    M.stickers.say('wrong');
  }
  const lastQ = cur.i === cur.qs.length - 1;
  const nx = $('#next'); nx.textContent = lastQ ? 'See my score ⭐' : 'Next'; nx.hidden = false; nx.focus();
}
function askHint() {
  if (!cur || cur.locked) return;
  const live = cur.opts.filter(x => !x.ok && !x.el.classList.contains('gone'));
  if (live.length <= 1) { M.stickers.say('hintNone', { who: 'bear' }); return; }
  const x = live[rnd(live.length)]; x.el.classList.add('gone'); x.el.disabled = true;
  cur.hints++; cur.hinted++;
  M.stickers.say('hint', { x: x.t, who: 'bear' });
}
$('#hint').onclick = askHint;
$('#backHome').onclick = leaveTest;
function leaveTest() {
  if (!cur) { show('home'); return; }
  if (cur.answers.length && !confirm('Leave this test? Your answers so far won\u2019t be saved.')) return;
  cur = null; $('#streakPill').hidden = true;
  show('home'); renderStats(); renderToday();
  M.stickers.say('leave');
}
$('#next').onclick = () => { cur.i++; cur.i < cur.qs.length ? showQ() : finish(); };
$('#say').onclick = () => M.speak($('#say').dataset.t, 0.8);
addEventListener('keydown', e => {
  if ($('#quiz').hidden || !cur || e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (document.activeElement || {}).tagName;
  if (/^[1-4]$/.test(e.key) && cur.opts && cur.opts[+e.key - 1] && !cur.locked) { const o = cur.opts[+e.key - 1]; if (!o.el.disabled) o.el.click(); }
  else if (e.key === 'Enter' && !$('#next').hidden && tag !== 'BUTTON') { $('#next').click(); }
  else if ((e.key === 'h' || e.key === 'H') && tag !== 'TEXTAREA') askHint();
  else if (e.key === 'Escape') leaveTest();
});

/* ================= RESULT ================= */
async function finish() {
  let earned = 0, total = 0;
  cur.answers.forEach(a => { total += PTS[a.level]; if (a.isCorrect) earned += PTS[a.level]; });
  const pct = Math.round(earned / total * 100);
  last = { name: HER.name, bank: cur.bank, date: new Date().toISOString(), earned, total, percent: pct, correct: cur.answers.filter(a => a.isCorrect).length, questions: cur.answers.length, hints: cur.hints, answers: cur.answers };
  await M.db.addResult(last); S.results = await M.db.listResults(); S.mistakes = await M.db.listMistakes();
  $('#rName').textContent = 'Well done, ' + HER.name + '!';
  $('#rScore').textContent = pct + '%'; $('#rRing').style.setProperty('--p', pct);
  $('#rPts').textContent = last.correct + '/' + last.questions + ' correct · ' + earned + '/' + total + ' weighted points (easy 1, medium 2, hard 3)' + (cur.hints ? ' · ' + cur.hints + ' hint' + (cur.hints > 1 ? 's' : '') : '');
  const acc = {}; ORDER.forEach(l => { const a = cur.answers.filter(x => x.level === l); if (a.length) acc[l] = a.filter(x => x.isCorrect).length / a.length; });
  const ok = ORDER.filter(l => acc[l] >= 0.6).pop();
  const tier = pct >= 85 ? 'Star speaker ⭐' : pct >= 65 ? 'Growing strong 🌱' : pct >= 40 ? 'Getting there 🐒' : 'Just starting 🍌';
  $('#rEst').textContent = 'Estimated level: ' + tier + (ok ? ' · comfortable up to ' + LABEL[ok] : ' · keep practicing the basics!');
  const love = $('#rLove'); if (HER.from) { love.textContent = HER.from + ' is proud of you 💛'; love.hidden = false; } else love.hidden = true;
  bars('#rLevels', ORDER.filter(l => acc[l] != null).map(l => [LABEL[l], cur.answers.filter(x => x.level === l)]));
  bars('#rTopics', [...new Set(cur.answers.map(a => a.topic))].slice(0, 12).map(t => [t, cur.answers.filter(a => a.topic === t)]));
  const rv = $('#rReview'); rv.textContent = '';
  const wrong = cur.answers.filter(a => !a.isCorrect);
  if (!wrong.length) rv.textContent = 'No mistakes - perfect! 🎉';
  wrong.forEach(a => { const d = el('div', 'rv'); d.append(el('b', null, a.prompt), ' → ' + a.correct + ' (you chose: ' + a.chosen + ')'); rv.append(d); });
  $('#rMistakes').hidden = !wrong.length;
  show('result'); renderStats(); renderToday(); renderHistory();
  const nx = !cur.mistakesMode && { easy: 'medium', medium: 'hard' }[cur.level], nb = $('#nextLvl');
  const nn = nx ? S.questions.filter(q => q.level === nx && S.selTopics.has(q.topic)).length : 0;
  nb.hidden = !nn;
  if (nn) { nb.textContent = 'Next level: ' + LABEL[nx] + ' ➜'; nb.onclick = () => { S.level = nx; S.countTouched = false; updateAvail(); startTest('normal'); }; }
  M.stickers.say(pct >= 85 ? 'finishHigh' : pct >= 55 ? 'finishMid' : 'finishLow', { pct });
  if (pct >= 70) { confetti(); M.stickers.party(); }
}
function bars(sel, rows) {
  const box = $(sel); box.textContent = '';
  rows.forEach(([label, arr]) => {
    const c = arr.filter(a => a.isCorrect).length, p = Math.round(c / arr.length * 100);
    const r = el('div', 'brow'), top = el('div'); top.append(el('span', null, label), el('span', null, c + '/' + arr.length));
    const t = el('div', 'track'), i = el('i'); i.style.width = p + '%'; t.append(i); r.append(top, t); box.append(r);
  });
}
function confetti() {
  if (reduce) return;
  const bits = ['🍌', '🐵', '💛', '⭐', '🌸', '🎉'];
  for (let i = 0; i < 28; i++) {
    const s = el('span', 'confetti', bits[rnd(bits.length)]);
    s.style.left = rnd(100) + 'vw'; s.style.setProperty('--dx', (rnd(160) - 80) + 'px'); s.style.setProperty('--rot', (rnd(720) - 360) + 'deg'); s.style.animationDelay = (rnd(800)) + 'ms'; s.style.fontSize = (18 + rnd(18)) + 'px';
    document.body.append(s); setTimeout(() => s.remove(), 3800);
  }
}
$('#again').onclick = async () => { show('home'); renderStats(); };
$('#rMistakes').onclick = () => startTest('mistakes');
$('#mistakes').onclick = () => startTest('mistakes');
$('#start').onclick = () => startTest('normal');

/* ================= EXPORT / HISTORY ================= */
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const csvCell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
const stamp = r => r.date.slice(0, 10) + '_' + r.name.replace(/\W+/g, '-');
$('#expJson').onclick = () => download('result_' + stamp(last) + '.json', JSON.stringify(last, null, 2), 'application/json');
$('#expCsv').onclick = () => {
  const rows = [['name', 'date', 'bank', 'id', 'level', 'topic', 'prompt', 'chosen', 'correct', 'is_correct', 'used_hint']];
  last.answers.forEach(a => rows.push([last.name, last.date, last.bank, a.id, a.level, a.topic, a.prompt, a.chosen, a.correct, a.isCorrect, !!a.hinted]));
  download('result_' + stamp(last) + '.csv', '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
};
function renderHistory() {
  const h = S.results.slice(-10).reverse(), box = $('#history'); box.textContent = '';
  if (!h.length) box.textContent = 'No tests yet.';
  h.forEach(r => { const d = el('div', 'hist'); d.append(el('span', null, r.date.slice(0, 10) + ' · ' + r.bank), el('b', null, r.percent + '%')); box.append(d); });
}
$('#expAll').onclick = () => download('all_results.json', JSON.stringify(S.results, null, 2), 'application/json');
$('#clearAll').onclick = async () => { if (confirm('Delete all saved results on this device?')) { await M.db.clearResults(); S.results = []; renderHistory(); renderStats(); } };
$('#tplCsv').onclick = () => download('coverage-template.csv', 'level,topic,prompt,pinyin,option_a,option_b,option_c,option_d,answer,explain\neasy,Fruit,香蕉,xiāngjiāo,Banana,Apple,Grape,Pear,A,香蕉 = banana\n', 'text/csv');
$('#tplJson').onclick = () => download('coverage-template.json', JSON.stringify({ name: 'My coverage', questions: [{ level: 'easy', topic: 'Fruit', prompt: '香蕉', pinyin: 'xiāngjiāo', options: ['Banana', 'Apple', 'Grape', 'Pear'], answer: 0, explain: '香蕉 = banana' }] }, null, 2), 'application/json');

/* ================= VOICE TOGGLE ================= */
function paintVoice() { const b = $('#voiceBtn'); b.setAttribute('aria-pressed', S.voice); b.firstChild.textContent = S.voice ? '🔊' : '🔈'; }
$('#voiceBtn').onclick = async () => { S.voice = !S.voice; paintVoice(); await M.db.kvSet('voice', S.voice); M.stickers.setVoice(S.voice); };

/* ================= START ================= */
M.useNewBank = async (meta, qs) => {   // used by the AI photo scan
  S.cache.set(meta.id, qs); S.metas = [STARTER, ...(await M.db.listBanks())]; S.lastImported = meta.id; await selectBank(meta.id);
  $('#okTitle').textContent = 'Ready: “' + meta.name + '” (' + meta.count + ' questions)'; $('#okSub').textContent = 'Pick a difficulty below, or just go!';
  $('#importOk').hidden = false; $('#importOk').scrollIntoView({ block: 'center' }); M.stickers.say('importDone', { n: meta.count }); M.stickers.party();
};
async function init() {
  const t = personalise();
  await M.db.init();
  S.voice = await M.db.kvGet('voice', false); paintVoice();
  M.stickers.init({ voice: S.voice });
  S.metas = [STARTER, ...(await M.db.listBanks())];
  S.results = await M.db.listResults(); S.mistakes = await M.db.listMistakes();
  const saved = await M.db.kvGet('bank', null);
  const startId = S.metas.some(m => m.id === saved) ? saved : (S.metas.length > 1 ? S.metas[S.metas.length - 1].id : 'starter');
  wireImport();
  await selectBank(startId);
  renderStats(); renderHistory();
  const sd = streakDays(S.results);
  setTimeout(() => { if (sd >= 2) M.stickers.say('comeback', { streak: sd }); else M.stickers.say('greet_' + t.key); }, 1100);
}
init().catch(e => { console.error(e); toast('Something went wrong starting up. Try refreshing.'); });
})();
