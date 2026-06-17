#!/usr/bin/env node
/* ============================================================================
   check_concepts.js — Concept-coverage checker (enforces the project rule).

   RULE: every quiz question's concept/term should resolve to a pre-generated
   in-site scholarly page (concepts.js + concept.html). Whenever questions are
   added or new concepts/terms are introduced, run this to see what still needs
   a concept page authored.

   Usage:  node check_concepts.js            (summary + top uncovered answers)
           node check_concepts.js --all      (list every uncovered answer)
           node check_concepts.js --json      (machine-readable)

   Uses the SAME normalized-Arabic alias matching as app.js, so its verdict
   matches what the live site links.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const dir = __dirname;

// --- load concepts.js (sets window.CONCEPTS) ---
global.window = {};
eval(fs.readFileSync(path.join(dir, 'concepts.js'), 'utf8'));
const CONCEPTS = global.window.CONCEPTS || {};

// --- load questions.js (top-level consts → vars so eval exposes them) ---
let qcode = fs.readFileSync(path.join(dir, 'questions.js'), 'utf8');
eval(qcode.replace(/^const /gm, 'var '));

// --- matcher: identical logic to app.js ---
function normAr(s) {
  return (s || '')
    .replace(/[ً-ْٰـ]/g, '') // tashkeel + tatweel
    .replace(/[إأآا]/g, 'ا') // alef variants → ا
    .replace(/ى/g, 'ي') // ى → ي
    .replace(/ؤ/g, 'و') // ؤ → و
    .replace(/ئ/g, 'ي') // ئ → ي
    .replace(/ة/g, 'ه') // ة → ه
    .replace(/\s+/g, ' ')
    .trim();
}
function conceptSlugFor(question, answer) {
  const hay = normAr(answer) + ' | ' + normAr(question);
  for (const slug in CONCEPTS) {
    const aliases = CONCEPTS[slug].aliases || [CONCEPTS[slug].title_ar];
    for (const al of aliases) {
      if (al && hay.includes(normAr(al))) return slug;
    }
  }
  return null;
}

// --- scan ---
let total = 0, covered = 0;
const uncovered = {};
for (const cat of CATEGORIES) {
  for (const q of (QUESTIONS[cat.id] || [])) {
    total++;
    const ans = q.o[q.a];
    if (conceptSlugFor(q.q, ans)) covered++;
    else uncovered[ans] = (uncovered[ans] || 0) + 1;
  }
}
const sorted = Object.entries(uncovered).sort((a, b) => b[1] - a[1]);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({
    concepts: Object.keys(CONCEPTS).length,
    total, covered,
    coveragePct: +(covered / total * 100).toFixed(1),
    uncovered: sorted.map(([answer, n]) => ({ answer, count: n })),
  }, null, 2));
  process.exit(0);
}

console.log('═══ Concept coverage ═══');
console.log(`Concept pages authored : ${Object.keys(CONCEPTS).length}`);
console.log(`Questions linked        : ${covered}/${total} (${(covered / total * 100).toFixed(1)}%)`);
console.log(`Distinct uncovered answers: ${sorted.length}`);
console.log('');
console.log('Top uncovered correct-answers — author these next (count × answer):');
const limit = process.argv.includes('--all') ? sorted.length : 35;
for (const [ans, n] of sorted.slice(0, limit)) {
  console.log(`  ${String(n).padStart(3)} ×  ${ans}`);
}
if (!process.argv.includes('--all') && sorted.length > limit) {
  console.log(`  … and ${sorted.length - limit} more (run with --all)`);
}
