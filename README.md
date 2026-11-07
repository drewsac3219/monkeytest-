# 🐵 Monkey Mandarin Test

A cute Mandarin quiz that builds itself from **any file** she drops in. Works on laptop, iPad, iPhone and Android. No build step, no server.

## Run it
- **VS Code:** open the folder → double-click `index.html` (or use *Live Server*).
- **GitHub Pages:** push to GitHub → Settings → Pages → deploy from `main` / root → send her the link.

## Make it hers (optional)
There is no name box: the site opens straight on the import box. If you want, edit **`data/her.js`** (her name, your `from` name, sticker names, daily notes).

## Difficulty, question count, AI photo scan
- Home → **Difficulty**: 🎯 All levels (easy → hard) · 🍌 Easy · 🐵 Medium · 🌴 Hard — each button shows its question count. The question count defaults to **all** questions; after Easy/Medium a **Next level** button appears on the results.
- **Photos of notes / modules → AI test**: up to 10 photos, read by Claude vision (paste an Anthropic API key under *AI settings*; it stays in that browser). Check the word list, then **Build test**. Needs internet; do not commit your key to GitHub.

## What's new
| | |
|---|---|
| **Any file → test** | Drop PDF, Word, PowerPoint, Excel, CSV/TSV, JSON, text, HTML, RTF, e-books, **photos / scans (OCR)** or a **.zip** of them. Or paste text. |
| **Straight to import** | The home screen opens with the drop zone. After an import she can start immediately. |
| **Bigger files** | Storage moved from `localStorage` (~5 MB) to **IndexedDB** (hundreds of MB+). Questions are stored separately from the list, so huge files stay fast. The original file is kept and can be downloaded again. |
| **Personal home** | Time-of-day theme and greeting (Mandarin + pinyin), daily note, streak, best score, word of the day, "Practice what I missed". |
| **Talking stickers** | Speech bubbles with Mandarin + pinyin + English (tap to hear). They react to answers, streaks, imports and results. Choco the bear gives hints (💡 button or press **H**). 🔈 button in the top bar lets them speak out loud. |
| **Moving stickers** | They wander and hop along the bottom of the screen. Drag them, **throw** them (they bounce off the walls), tap for a chat, tap 5× to tickle, throw 4× to make them dizzy. |

## What the file reader understands
1. **Ready-made question files** (JSON, or CSV with `prompt,option_a…,answer`). See *Question-file templates* in the app.
2. **Typed quiz papers**: `1. question  A) … B) … Answer: B` (answer keys at the end work too).
3. **Vocabulary** in lists, tables or spreadsheets: Chinese + pinyin + English in any order/separator (`你好 nǐ hǎo - hello`, `hello (你好)`, tab/CSV columns, header rows like `Hanzi | Pinyin | English | Topic | Level`). Makes Chinese→English, English→Chinese and pinyin questions.
4. **Chinese sentences** → fill-in-the-blank questions.

Headings such as `Lesson 3: Food`, `第三课`, sheet names or file names become the **topics** she can pick from. Levels come from word length (or a `Level` column; `HSK 1-6` also works).

## Notes
- Plain text, CSV and JSON work **offline**. PDF / Word / PowerPoint / Excel / zip / photos load a small reader library from a CDN the first time, so they need internet once (photos also download Mandarin text-recognition data, ~20 MB, then it's cached).
- Handwriting and blurry photos read poorly; clear printed text works best. Old `.doc` / `.ppt` should be saved as `.docx` / `.pptx` first. Audio/video can't be read.
- Everything stays **on her device** (nothing is uploaded anywhere).
- Very large PDFs are read page by page with a progress bar; scanned PDFs read up to 40 pages with OCR.

## Files
| File | What it is |
|---|---|
| `index.html`, `style.css` | The page and its look |
| `data/her.js` | **Her name, notes, sticker names** |
| `data/questions.js` | Built-in starter questions |
| `js/app.js` | Screens, quiz, results |
| `js/extract.js` | Reads every file type |
| `js/generate.js` | Turns what was read into questions |
| `js/db.js` | IndexedDB storage |
| `js/stickers.js` | Talking / moving stickers |
| `assets/stickers/` | Your sticker images |
