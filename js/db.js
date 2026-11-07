/* ===== DATABASE =====
   IndexedDB instead of localStorage:
   - localStorage tops out around 5 MB; IndexedDB can hold hundreds of MB (often GBs).
   - Coverage "meta" (name, count, topics) is kept apart from the big question list, so the home
     screen stays instant even with huge imports.
   - The original uploaded file is kept too (as a Blob) so she can download it again.
   If IndexedDB is unavailable (some private modes) it falls back to memory + localStorage.
*/
(() => {
'use strict';
const M = (window.MMT = window.MMT || {});
const DB_NAME = 'mmt-db', VERSION = 1;
const KEYS = { banks: 'id', bankData: 'id', files: 'id', results: 'id', mistakes: 'key', kv: 'k' };
const STORES = Object.keys(KEYS);
let idb = null, mode = 'indexeddb';
const mem = {}; STORES.forEach(s => { mem[s] = new Map(); });

/* ---------- low level ---------- */
function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB not available'));
    let r;
    try { r = indexedDB.open(DB_NAME, VERSION); } catch (e) { return reject(e); }
    r.onupgradeneeded = () => {
      const d = r.result;
      STORES.forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: KEYS[s] }); });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('IndexedDB blocked'));
    setTimeout(() => reject(new Error('IndexedDB timeout')), 4000);
  });
}
function tx(store, rw, fn) {
  return new Promise((resolve, reject) => {
    let t, out;
    try { t = idb.transaction(store, rw); out = fn(t.objectStore(store)); } catch (e) { return reject(e); }
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
  });
}
const FB = s => 'mmt_fb_' + s;
function persistFallback(s) {
  if (s === 'files') return;
  try { localStorage.setItem(FB(s), JSON.stringify([...mem[s].values()])); } catch (e) { /* quota - ignore */ }
}
function loadFallback() {
  STORES.forEach(s => {
    if (s === 'files') return;
    try { (JSON.parse(localStorage.getItem(FB(s))) || []).forEach(v => mem[s].set(v[KEYS[s]], v)); } catch (e) { /* ignore */ }
  });
}
const op = {
  get: (s, k) => idb ? tx(s, 'readonly', os => os.get(k)) : Promise.resolve(mem[s].get(k)),
  all: s => idb ? tx(s, 'readonly', os => os.getAll()) : Promise.resolve([...mem[s].values()]),
  put: (s, v) => idb ? tx(s, 'readwrite', os => os.put(v)) : (mem[s].set(v[KEYS[s]], v), persistFallback(s), Promise.resolve()),
  del: (s, k) => idb ? tx(s, 'readwrite', os => os.delete(k)) : (mem[s].delete(k), persistFallback(s), Promise.resolve()),
  clear: s => idb ? tx(s, 'readwrite', os => os.clear()) : (mem[s].clear(), persistFallback(s), Promise.resolve())
};
const friendly = e => (e && e.name === 'QuotaExceededError')
  ? new Error('This device is out of storage space for the app. Delete an old coverage and try again.')
  : e;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- one-time move from the old localStorage version ---------- */
async function migrate() {
  if (await M.db.kvGet('migrated_v1', false)) return;
  try {
    const old = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
    const banks = old('mmt_banks') || [], results = old('mmt_results') || [];
    for (const b of banks) {
      if (b && Array.isArray(b.questions) && b.questions.length) {
        await M.db.saveBank(M.db.makeMeta(b.name || 'Imported coverage', b.questions, { source: 'earlier version' }), b.questions);
      }
    }
    for (const r of results) await M.db.addResult(r);
    if (banks.length || results.length) { localStorage.removeItem('mmt_banks'); localStorage.removeItem('mmt_results'); }
  } catch (e) { /* migration is best-effort */ }
  await M.db.kvSet('migrated_v1', true);
}

/* ---------- public API ---------- */
M.db = {
  mode: () => mode,
  async init() {
    try { idb = await openDB(); }
    catch (e) { idb = null; mode = 'memory'; loadFallback(); }
    await migrate();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }
  },
  async kvGet(k, d) { const r = await op.get('kv', k); return r ? r.v : d; },
  kvSet: (k, v) => op.put('kv', { k, v }),

  makeMeta(name, questions, extra) {
    const topics = {}, levels = {};
    questions.forEach(q => { topics[q.topic] = (topics[q.topic] || 0) + 1; levels[q.level] = (levels[q.level] || 0) + 1; });
    return Object.assign({ id: uid(), name, count: questions.length, topics, levels, created: Date.now(), hasFile: false }, extra || {});
  },
  async saveBank(meta, questions, file) {
    try {
      if (file) {
        try { await op.put('files', { id: meta.id, blob: file, name: file.name, type: file.type, size: file.size }); meta.hasFile = true; }
        catch (e) { meta.hasFile = false; }
      }
      await op.put('bankData', { id: meta.id, questions });
      await op.put('banks', meta);
    } catch (e) {
      try { await op.del('bankData', meta.id); await op.del('files', meta.id); } catch (x) { /* ignore */ }
      throw friendly(e);
    }
    return meta;
  },
  async listBanks() { return (await op.all('banks')).sort((a, b) => a.created - b.created); },
  async getQuestions(id) { const r = await op.get('bankData', id); return r ? r.questions : []; },
  async getFile(id) { return op.get('files', id); },
  async deleteBank(id) { await op.del('banks', id); await op.del('bankData', id); await op.del('files', id); },

  async addResult(r) { await op.put('results', Object.assign({ id: uid() }, r)); },
  async listResults() { return (await op.all('results')).sort((a, b) => a.date < b.date ? -1 : 1); },
  clearResults: () => op.clear('results'),

  /* questions she got wrong -> "Practice my mistakes". A correct answer later clears it. */
  async noteAnswer(bankId, q, ok) {
    if (!bankId || !q || q.id == null) return;
    const key = bankId + '|' + q.id, cur = await op.get('mistakes', key);
    if (ok) { if (cur) await op.del('mistakes', key); return; }
    const snap = { id: q.id, level: q.level, topic: q.topic, prompt: q.prompt, pinyin: q.pinyin, options: q.options, answer: q.answer, explain: q.explain, group: q.group };
    await op.put('mistakes', { key, bankId, q: snap, misses: (cur ? cur.misses : 0) + 1, last: Date.now() });
  },
  listMistakes: () => op.all('mistakes'),
  async clearMistakesFor(bankId) { for (const m of await op.all('mistakes')) if (m.bankId === bankId) await op.del('mistakes', m.key); },

  async usage() {
    try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); return { used: e.usage || 0, quota: e.quota || 0 }; } } catch (e) { /* ignore */ }
    return null;
  }
};
})();
