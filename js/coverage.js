/* Builds quiz questions automatically from a plain vocabulary COVERAGE.
   Coverage columns (CSV) or "vocab" list (JSON): topic, word, pinyin, meaning */
(function () {
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const uniq = a => [...new Set(a)];

  function build(words) {
    const qs = []; let n = 0;
    const add = (level, topic, prompt, pinyin, options, answer, explain) =>
      qs.push({ id: 'G' + String(++n).padStart(3, '0'), level, topic, prompt, pinyin, options, answer, explain });

    // 3 wrong answers (nearby words first), correct answer placed at a random spot
    const mc = (level, w, prompt, pinyin, correct, near, far, explain) => {
      if (!correct) return;
      const bad = shuffle(uniq(near.filter(x => x && x !== correct)))
        .concat(shuffle(uniq(far.filter(x => x && x !== correct)))).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3);
      if (bad.length < 3) return;
      const i = Math.floor(Math.random() * 4); bad.splice(i, 0, correct);
      add(level, w.topic, prompt, pinyin, bad, i, explain);
    };

    words.forEach(w => {
      const others = words.filter(x => x !== w), same = others.filter(x => x.topic === w.topic);
      const info = `${w.word}${w.pinyin ? ' (' + w.pinyin + ')' : ''} = ${w.meaning}.`;
      mc('easy',   w, w.word, w.pinyin, w.meaning, same.map(x => x.meaning), others.map(x => x.meaning), info);
      if (w.pinyin) mc('easy', w, `What does “${w.pinyin}” mean?`, '', w.meaning, same.map(x => x.meaning), others.map(x => x.meaning), info);
      mc('medium', w, `Which word means “${w.meaning}”?`, '', w.word, same.map(x => x.word), others.map(x => x.word), info);
      if (w.pinyin) {
        mc('medium', w, `Which is the correct pinyin for ${w.word}?`, '', w.pinyin, same.map(x => x.pinyin), others.map(x => x.pinyin), info);
        mc('hard',   w, `How do you say “${w.meaning}” in pinyin?`, '', w.pinyin, same.map(x => x.pinyin), others.map(x => x.pinyin), info);
        mc('hard',   w, `Which characters match the pinyin “${w.pinyin}”?`, '', w.word, same.map(x => x.word), others.map(x => x.word), info);
      }
    });

    // odd one out: 3 words from one topic + 1 outsider
    const topics = uniq(words.map(w => w.topic));
    topics.forEach(t => {
      const inT = words.filter(w => w.topic === t), out = words.filter(w => w.topic !== t);
      if (inT.length < 3 || !out.length) return;
      for (let k = 0; k < Math.min(8, inT.length); k++) {
        const g = shuffle(inT).slice(0, 3), o = shuffle(out)[0];
        const opts = shuffle(g.concat(o)).map(x => x.word);
        add('hard', t, 'Which word does NOT belong with the others?', '', opts, opts.indexOf(o.word),
          `${o.word} (${o.meaning}) is not part of “${t}”.`);
      }
    });
    return qs;
  }

  window.parseCoverageCSV = t => { const rows = []; let row = [], v = '', q = false;
    for (let i = 0; i < t.length; i++) { const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { v += '"'; i++; } else q = false; } else v += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(v); v = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(v); rows.push(row); row = []; v = ''; } else v += c; }
    if (v || row.length) { row.push(v); rows.push(row); } return rows.filter(r => r.some(x => x.trim())); };

  window.buildCoverageQuestions = build;

  // returns a question bank, or null when the text is not a coverage file
  window.coverageFromText = function (t, fname, parseCSV) {
    let list, name = fname.replace(/\.\w+$/, '');
    if (t[0] === '{' || t[0] === '[') {
      let j; try { j = JSON.parse(t); } catch (e) { return null; }
      list = Array.isArray(j) ? null : (j.vocab || j.words); if (!list) return null; name = j.name || name;
    } else {
      const [head, ...rows] = (parseCSV || window.parseCoverageCSV)(t), k = head.map(h => h.trim().toLowerCase());
      if (!k.includes('word') || !k.includes('meaning') || k.includes('prompt')) return null;
      list = rows.map(r => { const o = {}; k.forEach((h, i) => o[h] = (r[i] || '').trim()); return o; });
    }
    const words = list.map(w => ({ word: String(w.word || '').trim(), pinyin: String(w.pinyin || '').trim(),
      meaning: String(w.meaning || '').trim(), topic: String(w.topic || 'General').trim() })).filter(w => w.word && w.meaning);
    if (words.length < 4) throw new Error('A coverage needs at least 4 words (columns: topic, word, pinyin, meaning).');
    const questions = build(words);
    if (!questions.length) throw new Error('Could not build questions from this coverage.');
    return { name: name + ' (auto-generated)', questions, generated: true };
  };
})();
