/* ===== THE STICKER FRIENDS =====
   - They TALK: speech bubbles with a bit of Mandarin (+ pinyin + English). Tap a bubble to hear it.
   - They REACT: to correct / wrong answers, streaks, imports, finishing a test...
   - They MOVE: they wander along the bottom of the screen, hop, wiggle, and can be
     picked up (drag) and thrown - they fall with gravity and bounce off the walls.
   - Tap one for a chat. Tap a lot and they giggle. Throw them a lot and they get dizzy.
*/
(() => {
'use strict';
const M = (window.MMT = window.MMT || {});
const HER = Object.assign({ name: 'Ate', from: '', friends: {} }, window.HER || {});
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const BASE = 'assets/stickers/';
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

/* ---------- speaking Mandarin out loud ---------- */
M.speak = (text, rate) => {
  if (!text || !('speechSynthesis' in window)) return;
  try { const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = rate || 0.85; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* ignore */ }
};

/* ---------- who they are ---------- */
const F = HER.friends || {};
const CAST = [
  { id: 'puppy',   file: 'puppy.png',   name: F.puppy   || 'Brilsa',   w: [60, 92] },
  { id: 'shihtzu', file: 'shihtzu.png', name: F.shihtzu || 'Spark'  , w: [58, 92] },
  { id: 'bear',    file: 'bear.png',    name: F.bear    || 'Choco',    w: [48, 78] },
  { id: 'baby',    file: 'baby.png',    name: F.baby    || 'Mochi',    w: [44, 72] }
];

/* ---------- what they say ----------  {who?, t, zh?, py?, en?}   {name} {n} {pct} {x} {streak} {from} are filled in */
const L = (who, t, zh, py, en) => ({ who, t, zh, py, en });
const LINES = {
  greet_morning: [L('puppy', 'Woof! Good morning, {name}! 🐶', '早上好！', 'zǎoshang hǎo!', 'Good morning!'), L('shihtzu', 'Morning, {name}. Ready for a little Mandarin?', '早上好', 'zǎoshang hǎo', 'Good morning')],
  greet_day: [L('puppy', 'Woof! {name}!! You’re here! 🐶', '你好！', 'nǐ hǎo!', 'Hello!'), L('bear', 'Choco reporting for study duty 🐻', '学习时间！', 'xuéxí shíjiān!', 'Study time!')],
  greet_evening: [L('shihtzu', 'Good evening, {name}. Let’s learn something cozy 🌙', '晚上好！', 'wǎnshang hǎo!', 'Good evening!'), L('baby', 'Hi hi hi! Teach me a word? 👶')],
  greet_night: [L('baby', 'Still up, {name}? Just a few words, then sleep 😴', '晚安', 'wǎn’ān', 'Good night'), L('bear', 'Late-night study? I’ll keep you company 🌙')],
  comeback: [L('puppy', 'Day {streak} in a row! 🔥 I’m so happy you came back!', '欢迎回来！', 'huānyíng huílái!', 'Welcome back!')],
  dropHover: [L('puppy', 'Drop it! Drop it! I’ll fetch the questions! 🐾'), L('baby', 'Ooh, what’s in the file? 👀')],
  importStart: [L('shihtzu', 'Mmm… reading your file 📄'), L('puppy', 'Sniff sniff… I smell vocabulary!')],
  importDone: [L('puppy', 'Found {n} questions!', '太棒了！', 'tài bàng le!', 'Awesome!'), L('bear', '{n} questions are ready whenever you are.'), L('baby', 'Wow, so many words! 🤩'), L('shihtzu', 'Lovely. Pick your levels, then press Start.')],
  importFail: [L('bear', 'Hmm, I couldn’t find questions in that one 🥺 Try a file with Chinese words and their pinyin or English.'), L('shihtzu', 'Word lists, lesson notes and textbook photos work best.')],
  quizStart: [L('shihtzu', 'Take your time. No rush.', '慢慢来', 'màn màn lái', 'Take it slow'), L('puppy', 'You can do it!', '加油！', 'jiāyóu!', 'Go go go!'), L('bear', 'Stuck? Tap the 💡 button and I’ll help.')],
  correct: [L('puppy', 'Yes!!', '对了！', 'duì le!', 'Correct!'), L('shihtzu', 'Very good!', '很好！', 'hěn hǎo!', 'Very good!'), L('baby', 'Yay!! 🎉'), L('bear', 'Nice one, {name} 🍌'), L('shihtzu', 'So smart!', '真聪明！', 'zhēn cōngming!', 'So smart!'), L('puppy', 'Amazing!', '太棒了！', 'tài bàng le!', 'Awesome!')],
  wrong: [L('bear', 'It’s okay. Mistakes are how monkeys learn 🐒'), L('shihtzu', 'It’s okay!', '没关系！', 'méi guānxi!', 'No worries!'), L('puppy', 'So close! The next one is yours.', '再试试！', 'zài shìshi!', 'Try again!'), L('baby', 'Aww… you’ll get the next one! 💛')],
  streak: [L('puppy', '{streak} in a row!! 🔥', '太厉害了！', 'tài lìhai le!', 'So impressive!'), L('bear', 'Streak: {streak}. You’re on fire 🔥')],
  hint: [L('bear', 'Psst… I’m pretty sure it’s not “{x}” 🤫')],
  hintNone: [L('bear', 'I’m out of hints for this one 😅 You’ve got this!')],
  finishHigh: [L('puppy', '{pct}%!!! ⭐', '你真棒！', 'nǐ zhēn bàng!', 'You’re amazing!'), L('shihtzu', 'I’m so proud of you, {name}.'), L('baby', 'WOW! 🥹')],
  finishMid: [L('bear', 'Solid work, {name}! A little more and you’ll shine.'), L('shihtzu', 'Keep it up!', '继续努力！', 'jìxù nǔlì!', 'Keep working hard!')],
  finishLow: [L('baby', 'That was brave! 💛 Let’s practice the tricky ones.'), L('shihtzu', 'It’s okay, take it slowly.', '没关系，慢慢来。', 'méi guānxi, màn màn lái.', 'It’s okay, take it slowly.'), L('bear', 'Try “Practice what I missed” and we’ll do it together.')],
  idle: [
    L('puppy', 'Psst, want to play? Drag me around! 🐾'), L('puppy', 'Throw me! I like to bounce! 🎾'),
    L('baby', 'Did you know?', '猴子', 'hóuzi', 'monkey 🐵'), L('baby', 'Hehe, I can walk all by myself 👣'),
    L('shihtzu', 'Water break?', '水', 'shuǐ', 'water 💧'), L('shihtzu', 'Drop a PDF, a photo of your notes… anything!'),
    L('bear', 'Tip: say new words out loud. Tap 🔊!'), L('bear', 'You can drop Word, Excel and PowerPoint files too.')
  ],
  tap: [
    L('puppy', 'Woof! 🐶'), L('puppy', 'Boop! That’s my nose!'), L('puppy', 'Again again again! 🐾'), L('puppy', 'Hello!', '你好！', 'nǐ hǎo!', 'Hello!'),
    L('shihtzu', 'Hehe, you’re so sweet, {name}.'), L('shihtzu', 'Fluffy hugs! 🤍'), L('shihtzu', 'Thank you!', '谢谢！', 'xièxie!', 'Thank you!'),
    L('bear', 'Hug? 🐻'), L('bear', 'I’m brown and brave 💪'), L('bear', 'Friend', '朋友', 'péngyou', 'friend 💛'),
    L('baby', 'Hi! 👋'), L('baby', 'Goo-goo!', '你好！', 'nǐ hǎo!', 'Hello!'), L('baby', 'Love you!', '我爱你', 'wǒ ài nǐ', 'I love you 💛')
  ],
  leave: [L('bear', 'Back already, {name}? Come play again soon 🐻'), L('puppy', 'Okay {name}! Woof, see you soon! 🐶'), L('baby', 'Bye bye, {name}! 👋')],
  tickle: [L(null, 'Hehe stop, that tickles! 😆')],
  thrown: [L(null, 'Wheeeee! 🚀'), L(null, 'Again! Again! 🎢')],
  dizzy: [L(null, 'I’m dizzy… 😵‍💫')],
  voiceOn: [L('baby', 'Now I can speak Mandarin too! 🔊')]
};

/* ---------- state ---------- */
let layer, srEl, list = [], raf = 0, last = 0, W = innerWidth, H = innerHeight, safeBottom = 0;
let speaking = null, hideTimer = 0, voice = false, lastTouch = Date.now();
const G = 2400;

function fill(str, ctx) {
  return String(str || '').replace(/\{(\w+)\}/g, (m, k) => (ctx && ctx[k] != null ? ctx[k] : k === 'name' ? HER.name : k === 'from' ? HER.from : ''));
}
function measureSafe() {
  const p = document.createElement('div'); p.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:env(safe-area-inset-bottom,0px);visibility:hidden';
  document.body.append(p); safeBottom = p.getBoundingClientRect().height || 0; p.remove();
}
const floorY = s => H - s.h - 6 - safeBottom;

/* ---------- speech bubbles ---------- */
function render(s, m, ctx) {
  const b = s.bubble; b.textContent = '';
  const who = document.createElement('span'); who.className = 'who'; who.textContent = s.name; b.append(who);
  const t = document.createElement('p'); t.className = 't'; t.textContent = fill(m.t, ctx); b.append(t);
  if (m.zh) {
    const z = document.createElement('p'); z.className = 'zh';
    const h = document.createElement('span'); h.lang = 'zh-CN'; h.textContent = m.zh; z.append(h);
    if (m.py) { const i = document.createElement('i'); i.textContent = m.py; z.append(i); }
    if (m.en) { const e = document.createElement('em'); e.textContent = m.en; z.append(e); }
    const ear = document.createElement('span'); ear.className = 'ear'; ear.textContent = '🔊'; ear.setAttribute('aria-hidden', 'true'); z.append(ear);
    b.append(z);
  }
}
function placeBubble(s) {
  const b = s.bubble, bw = b.offsetWidth, bh = b.offsetHeight, cx = s.x + s.w / 2;
  const left = cx - bw / 2, clamped = Math.max(8, Math.min(W - bw - 8, left)), shift = clamped - left;
  b.style.setProperty('--shift', shift + 'px'); b.style.setProperty('--tail', (bw / 2 - shift) + 'px');
  b.classList.toggle('below', s.y - bh - 16 < 4);
}
function hideBubble(s) { if (s) s.bubble.classList.remove('show'); if (speaking === s) speaking = null; }
function show(s, m, ctx, opts) {
  opts = opts || {};
  clearTimeout(hideTimer);
  if (speaking && speaking !== s) hideBubble(speaking);
  render(s, m, ctx); speaking = s;
  s.bubble.classList.add('show'); placeBubble(s);
  const txt = fill(m.t, ctx) + (m.zh || '') + (m.en || '');
  hideTimer = setTimeout(() => hideBubble(s), 3600 + txt.length * 55);
  if (srEl && !opts.quiet) srEl.textContent = s.name + ' says: ' + fill(m.t, ctx) + (m.zh ? ' ' + m.zh + ' (' + (m.py || '') + ') ' + (m.en || '') : '');
  if (voice && m.zh) M.speak(m.zh);
}

/* ---------- little reaction animations ---------- */
function react(s, cls) {
  if (reduce) return;
  const b = s.body; b.classList.remove('hop', 'spin', 'shake', 'wiggle');
  void b.offsetWidth; b.classList.add(cls);
  b.addEventListener('animationend', function f() { b.classList.remove(cls); b.removeEventListener('animationend', f); });
}
function party(except) { list.forEach((s, i) => setTimeout(() => react(s, i % 2 ? 'hop' : 'spin'), i * 140)); }

/* ---------- public say() ---------- */
function say(event, ctx) {
  ctx = ctx || {};
  const pool = (LINES[event] || []).filter(l => !ctx.who || !l.who || l.who === ctx.who);
  if (!pool.length) return false;
  const line = pick(pool);
  const s = list.find(x => x.id === (ctx.who || line.who)) || pick(list);
  if (!s) return false;
  lastTouch = Date.now();
  show(s, line, ctx, { quiet: event === 'idle' || event === 'tap' || event === 'tickle' });
  return s;
}

/* ---------- movement ---------- */
function setPos(s) { s.el.style.transform = 'translate3d(' + s.x.toFixed(1) + 'px,' + (s.y + s.off).toFixed(1) + 'px,0)'; }
function setLook(s) {
  const t = Math.max(-28, Math.min(28, s.tilt)).toFixed(1), k = s.flip + '|' + t;
  if (k !== s.look) { s.look = k; s.img.style.transform = 'rotate(' + t + 'deg) scaleX(' + s.flip + ')'; }
}
function newPlan(s) {
  const r = Math.random();
  if (reduce) { s.act = 'wait'; s.timer = 4; return; }
  if (r < 0.55) { s.act = 'walk'; s.target = rnd(8, Math.max(9, W - s.w - 8)); s.speed = rnd(34, W < 700 ? 48 : 62); }
  else if (r < 0.8) { s.act = 'hop'; s.hopT = 0; }
  else { s.act = 'wait'; s.timer = rnd(1.2, 2.5); react(s, 'wiggle'); }
}
function land(s) { s.mode = 'ground'; s.vx = s.vy = 0; s.y = floorY(s); s.act = 'wait'; s.timer = rnd(0.8, 2.5); s.tilt = 0; }

function update(s, dt, ts) {
  const floor = floorY(s);
  if (s.mode === 'drag') { setLook(s); setPos(s); return; }
  if (s.mode === 'fly') {
    s.vy += G * dt; s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.x < 0) { s.x = 0; s.vx = Math.abs(s.vx) * 0.6; } else if (s.x > W - s.w) { s.x = W - s.w; s.vx = -Math.abs(s.vx) * 0.6; }
    if (s.y < 0) { s.y = 0; s.vy = Math.abs(s.vy) * 0.5; }
    if (s.y >= floor) {
      s.y = floor;
      if (Math.abs(s.vy) > 280) { s.vy = -s.vy * 0.5; s.vx *= 0.85; } else { s.vy = 0; s.vx *= 1 - Math.min(1, 7 * dt); if (Math.abs(s.vx) < 14) land(s); }
    }
    s.tilt += ((s.vx * 0.02) - s.tilt) * Math.min(1, 10 * dt);
    s.off = 0; setLook(s); setPos(s); return;
  }
  // on the ground
  s.y = floor; s.off = 0;
  if (s.tilt) s.tilt *= 0.8;
  if (s.act === 'wait') { s.timer -= dt; if (s.timer <= 0) newPlan(s); }
  else if (s.act === 'walk') {
    const dx = s.target - s.x, step = s.speed * dt;
    s.flip = dx < 0 ? -1 : 1;
    if (Math.abs(dx) <= step) { s.x = s.target; s.act = 'wait'; s.timer = rnd(1.5, 5); s.off = 0; }
    else { s.x += Math.sign(dx) * step; s.off = -Math.abs(Math.sin(ts * 0.011)) * 7; }
  } else if (s.act === 'hop') {
    s.hopT += dt / 0.55; const h = Math.min(1, s.hopT);
    s.off = -4 * 34 * h * (1 - h);
    if (s.hopT >= 1) { s.off = 0; s.act = 'wait'; s.timer = rnd(1.5, 4); }
  }
  s.x = Math.max(0, Math.min(W - s.w, s.x));
  setLook(s); setPos(s);
}
function tick(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
  list.forEach(s => update(s, dt, ts));
  if (speaking) placeBubble(speaking);
  raf = requestAnimationFrame(tick);
}

/* ---------- dragging, throwing, tapping ---------- */
function wire(s) {
  const el = s.el;
  el.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    el.setPointerCapture(e.pointerId); lastTouch = Date.now();
    s.drag = { ox: e.clientX - s.x, oy: e.clientY - s.y, sx: e.clientX, sy: e.clientY, t0: performance.now(), moved: false, pts: [] };
    s.mode = 'drag'; s.off = 0; el.classList.add('lifted'); el.style.zIndex = ++z;
    e.preventDefault();
  });
  el.addEventListener('pointermove', e => {
    const d = s.drag; if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 7) { d.moved = true; if (speaking === s) hideBubble(s); }
    s.x = Math.max(0, Math.min(W - s.w, e.clientX - d.ox)); s.y = Math.max(0, Math.min(H - s.h, e.clientY - d.oy));
    const now = performance.now(); d.pts.push({ x: e.clientX, y: e.clientY, t: now }); while (d.pts.length > 2 && now - d.pts[0].t > 110) d.pts.shift();
    if (d.pts.length > 1) { const a = d.pts[0], b = d.pts[d.pts.length - 1], dt = Math.max(16, b.t - a.t); s.tilt = Math.max(-25, Math.min(25, ((b.x - a.x) / dt) * 6)); }
  });
  const end = e => {
    const d = s.drag; if (!d) return; s.drag = null; el.classList.remove('lifted');
    try { el.releasePointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    const dur = performance.now() - d.t0;
    if (!d.moved && dur < 450 && e.type === 'pointerup') { s.mode = s.y < floorY(s) - 2 ? 'fly' : 'ground'; s.vx = s.vy = 0; tap(s); return; }
    let vx = 0, vy = 0;
    if (d.pts.length > 1) { const a = d.pts[0], b = d.pts[d.pts.length - 1], dt = Math.max(16, b.t - a.t) / 1000; vx = (b.x - a.x) / dt; vy = (b.y - a.y) / dt; }
    const sp = Math.hypot(vx, vy), cap = 2400; if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
    s.vx = vx; s.vy = vy; s.mode = 'fly';
    const now = Date.now(); s.throws = (s.throws || []).filter(t => now - t < 9000); s.throws.push(now);
    if (s.throws.length >= 4) { s.throws = []; react(s, 'spin'); say('dizzy', { who: s.id }); }
    else if (sp > 700 && Math.random() < 0.45) say('thrown', { who: s.id });
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(s); } });
}
let z = 30;
function tap(s) {
  const now = Date.now(); s.taps = (s.taps || []).filter(t => now - t < 4000); s.taps.push(now);
  react(s, 'hop');
  if (s.taps.length >= 5) { s.taps = []; react(s, 'spin'); say('tickle', { who: s.id }); }
  else say('tap', { who: s.id });
  // sit still while chatting
  if (s.mode === 'ground') { s.act = 'wait'; s.timer = 3; }
}

/* ---------- setup ---------- */
function build() {
  const narrow = W < 700;
  CAST.forEach((c, i) => {
    const el = document.createElement('div'); el.className = 'sticker'; el.tabIndex = 0; el.setAttribute('role', 'button'); el.setAttribute('aria-label', 'Chat with ' + c.name + ' (you can also drag me!)');
    const bubble = document.createElement('div'); bubble.className = 'bubble';
    bubble.addEventListener('click', e => { e.stopPropagation(); const zh = bubble.querySelector('.zh span[lang]'); if (zh) M.speak(zh.textContent); else bubble.classList.remove('show'); });
    bubble.addEventListener('pointerdown', e => e.stopPropagation());
    const body = document.createElement('div'); body.className = 'body';
    const img = document.createElement('img'); img.src = BASE + c.file; img.alt = ''; img.draggable = false;
    body.append(img); el.append(bubble, body); layer.append(el);
    const w = narrow ? c.w[0] : c.w[1];
    const s = { id: c.id, name: c.name, el, bubble, body, img, w, h: w, x: 0, y: 0, vx: 0, vy: 0, off: 0, tilt: 0, flip: i % 2 ? -1 : 1, look: '', mode: 'ground', act: 'wait', timer: rnd(0.5, 2.5) + i * 0.7 };
    img.style.width = w + 'px';
    const setH = () => { if (img.naturalWidth) { s.h = w * img.naturalHeight / img.naturalWidth; if (s.mode === 'ground') s.y = floorY(s); } };
    img.addEventListener('load', setH); if (img.complete) setH();
    s.x = (W - w) * (0.08 + 0.28 * i) + rnd(-10, 10); s.x = Math.max(4, Math.min(W - w - 4, s.x)); s.y = floorY(s);
    wire(s); list.push(s);
  });
}
function onResize() {
  W = innerWidth; H = innerHeight; measureSafe();
  list.forEach(s => { s.x = Math.max(0, Math.min(W - s.w, s.x)); if (s.mode === 'ground') s.y = floorY(s); else s.y = Math.min(s.y, floorY(s)); });
}
function idleLoop() {
  setTimeout(() => {
    if (!document.hidden && !speaking && Date.now() - lastTouch > 12000 && !document.querySelector('#quiz:not([hidden])')) say('idle');
    idleLoop();
  }, rnd(22000, 38000));
}

M.stickers = {
  init(opts) {
    opts = opts || {};
    layer = document.getElementById('stickerLayer'); srEl = document.getElementById('srSay');
    if (!layer) return;
    voice = !!opts.voice; W = innerWidth; H = innerHeight; measureSafe();
    build(); addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) last = performance.now(); });
    list.forEach(setPos); raf = requestAnimationFrame(tick); idleLoop();
  },
  say, react: (who, kind) => { const s = list.find(x => x.id === who) || pick(list); if (s) react(s, kind || 'hop'); }, party,
  setVoice(v) { voice = !!v; if (v) say('voiceOn'); },
  hush() { hideBubble(speaking); },
  names: () => CAST.map(c => c.name)
};
})();
