/* AI photo scan: up to 10 photos -> Claude vision -> editable word list -> test saved in her library */
(function () {
  const $ = s => document.querySelector(s), M = window.MMT;
  const MODEL = 'claude-sonnet-5-5', MAX = 10;
  let photos = [], aiQs = [], scanName = 'Scanned notes';
  const say = (t, err) => { const m = $('#aiMsg'); m.textContent = t; m.className = 'msg' + (err ? ' err' : ''); };
  const get = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
  const parseCSV = t => { const rows = []; let row = [], v = '', q = false;
    for (let i = 0; i < t.length; i++) { const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { v += '"'; i++; } else q = false; } else v += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(v); v = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(v); rows.push(row); row = []; v = ''; } else v += c; }
    if (v || row.length) { row.push(v); rows.push(row); } return rows.filter(r => r.some(x => x.trim())); };
  $('#apiKey').value = get('mmt_key');
  $('#saveKey').onclick = () => { try { localStorage.setItem('mmt_key', $('#apiKey').value.trim()); } catch {} say('Key saved on this device ✔'); };

  $('#photos').onchange = async e => {
    const files = [...e.target.files].filter(f => f.type.startsWith('image/')).slice(0, MAX);
    photos = []; $('#thumbs').textContent = ''; $('#aiGo').disabled = true;
    if (e.target.files.length > MAX) say('Only the first ' + MAX + ' photos are used.', true);
    for (const f of files) {
      try {
        const bmp = await createImageBitmap(f), s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', .85); photos.push(url.split(',')[1]);
        const im = new Image(); im.src = url; im.className = 'thumb'; $('#thumbs').append(im);
      } catch { say('One photo could not be read (try JPG or PNG).', true); }
    }
    $('#aiGo').disabled = !photos.length; if (photos.length) say(photos.length + ' photo(s) ready.');
  };

  const PROMPT = `These photos are pages from a Mandarin lesson module or handwritten notes of a first-year student in Taiwan (Traditional Chinese with pinyin).
Read ALL photos and return ONLY one JSON object, no other text:
{"name":"short title","vocab":[{"topic":"","word":"","pinyin":"","meaning":""}],"questions":[{"level":"easy|medium|hard","topic":"","prompt":"","pinyin":"","options":["","","",""],"answer":0,"explain":""}]}
Rules:
- vocab: every word/phrase you can clearly read. Keep characters exactly as written (Traditional). Add pinyin with tone marks if missing. meaning in English. Group into 3-6 short topics.
- questions: as many multiple-choice questions as the photos support (aim for 30-40) about sentences, dialogues, grammar and word usage that appear in the photos, spread across easy, medium and hard. Exactly 4 options, "answer" is the 0-based index of the one correct option.
- Never guess illegible text: skip it. Use only what is in the photos.`;

  $('#aiGo').onclick = async () => {
    const key = get('mmt_key'); if (!key) return say('Paste your API key under “AI settings” and press Save first.', true);
    $('#aiGo').disabled = true; say('Reading your photos… this can take up to a minute ⏳');
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: MODEL, max_tokens: 12000, messages: [{ role: 'user', content: [
          ...photos.map(d => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: d } })), { type: 'text', text: PROMPT }] }] }) });
      const j = await r.json(); if (!r.ok) throw new Error(r.status === 401 ? 'The API key was not accepted.' : (j.error && j.error.message) || 'Request failed.');
      const txt = j.content.filter(b => b.type === 'text').map(b => b.text).join('').replace(/```json|```/g, '').trim();
      const d = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
      scanName = d.name || 'Scanned notes';
      aiQs = (d.questions || []).filter(q => ['easy', 'medium', 'hard'].includes(q.level) && q.prompt && Array.isArray(q.options) && q.options.length === 4 && q.answer >= 0 && q.answer < 4)
        .map((q, i) => ({ id: 'S' + String(i + 1).padStart(2, '0'), level: q.level, topic: q.topic || 'Sentences', prompt: String(q.prompt), pinyin: q.pinyin || '', options: q.options.map(String), answer: q.answer | 0, explain: q.explain || '' }));
      const cell = v => '"' + String(v || '').replace(/"/g, '""') + '"';
      $('#aiReview').value = 'topic,word,pinyin,meaning\n' + (d.vocab || []).map(w => [w.topic, w.word, w.pinyin, w.meaning].map(cell).join(',')).join('\n');
      $('#aiBox').hidden = false;
      say('Found ' + (d.vocab || []).length + ' words and ' + aiQs.length + ' sentence questions. Check the list — fix mistakes — then press “Build test”.');
    } catch (e) { say('Could not read the photos: ' + e.message, true); }
    $('#aiGo').disabled = !photos.length;
  };

  $('#aiBuild').onclick = async () => {
    try {
      const bank = window.coverageFromText($('#aiReview').value.trim(), scanName, null);
      if (!bank) throw new Error('Keep the first line: topic,word,pinyin,meaning');
      const qs = bank.questions.concat(aiQs), name = scanName + ' (photos)';
      const meta = M.db.makeMeta(name, qs, { source: 'ai-scan', fileName: name });
      await M.db.saveBank(meta, qs, null); await M.useNewBank(meta, qs);
      $('#aiBox').hidden = true; say('Done! “' + name + '” has ' + qs.length + ' questions ✔');
    } catch (e) { say('Could not build: ' + e.message, true); }
  };
})();
