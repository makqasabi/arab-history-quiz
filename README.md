# مسابقة تاريخ الأمة العربية — Arab History Quiz

لعبة أسئلة تفاعلية مبنية على «الكتاب المرجع في تاريخ الأمة العربية» (١٠ مجلدات).

An interactive quiz game based on the 10-volume reference work on the history of the Arab nation.

## المزايا — Features
- ٦٤٥ سؤالاً عبر ٧ تصنيفات، بمستويات صعوبة ١–٥.
- شرح للخيارات الخاطئة، وتأريخ الأحداث، ومصدر كل سؤال (المجلد والصفحة).
- بحث داخل الكتاب مع قارئ صفحات.
- وضع متعدد اللاعبين (٢–١٠ متسابقين) مع لوحة نتائج.

## التشغيل محلياً — Run locally
```
node server.js
```
ثم افتح / then open: http://localhost:5577

## النشر — Deployment
Static site served via GitHub Pages from the repository root.

## القاعدة: تغطية المفاهيم — Rule: concept coverage
**كل مفهوم/مصطلح في المسابقة يجب أن يقابله صفحةُ تحليلٍ أكاديميٍّ مُولَّدةٌ مسبقاً داخل الموقع** —
وهذه قاعدةٌ دائمة تسري على أي أسئلةٍ أو مفاهيمَ تُضاف مستقبلاً.

Every concept/term in the quiz must resolve to a pre-generated in-site scholarly
page. This is a standing rule that also applies to any questions/concepts added later.

- **Data:** add a slug-keyed entry to `concepts.js` — the 10-section bilingual
  Epistemologist template (EN + AR bullets), with **genuine** academic citations
  (no fabricated references), and `aliases` that match the quiz wording.
- **Auto-linking:** `app.js` matches a question to a concept by normalized-Arabic
  alias against its question + correct answer; the “🎓 تعمّق أكاديمي” link then
  appears automatically (and stays hidden where no page exists yet).
- **Render:** `concept.html?c=<slug>` displays the bilingual table.
- **Enforce / find gaps:** run `node check_concepts.js` — it reports coverage and
  the top uncovered answers to author next (matching app.js’s own logic).
- **Whenever you add or generate questions**, run the checker and author pages for
  any newly-introduced concepts before considering the work done.
