const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.resolve(__dirname, '..', 'src/body/model.ts');
const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(require, mod, mod.exports);
const { sanitizeEstimate, composition, compareScans, bodyFatCategory, sortScans } = mod.exports;
const scan = (extra = {}) => ({ id: 'a', date: '2026-09-01', createdAt: 1, weightKg: 90, bodyFatPct: 20, bodyFatLow: 17, bodyFatHigh: 23, muscularity: 3, confidence: 'medium', summary: '', regions: [], comparison: '', frontUri: '', sideUri: '', ...extra });

test('model estimates are clamped and the range always contains the estimate', () => {
  assert.deepEqual(sanitizeEstimate({ bodyFatPct: 18.26, bodyFatLow: 21, bodyFatHigh: 15, muscularity: 7.2 }), { bodyFatPct: 18.3, bodyFatLow: 18.3, bodyFatHigh: 18.3, muscularity: 5 });
  assert.deepEqual(sanitizeEstimate({ bodyFatPct: 1, bodyFatLow: null, bodyFatHigh: null, muscularity: 0 }), { bodyFatPct: 3, bodyFatLow: 2, bodyFatHigh: 6, muscularity: 1 });
});
test('fat, lean and muscle mass follow from weight and body fat', () => {
  assert.deepEqual(composition(scan()), { fatKg: 18, leanKg: 72, muscleKg: 38.2 });
  assert.equal(composition(scan({ weightKg: null })), null);
});
test('comparing scans reports days and mass changes', () => {
  const d = compareScans(scan(), scan({ id: 'b', date: '2026-10-01', weightKg: 88, bodyFatPct: 17 }));
  assert.equal(d.days, 30);
  assert.equal(d.bodyFatPct, -3);
  assert.equal(d.weightKg, -2);
  assert.equal(d.fatKg, -3);
  assert.equal(d.leanKg, 1);
  assert.equal(compareScans(scan(), scan({ weightKg: null })).fatKg, null);
});
test('categories depend on sex and scans sort newest first', () => {
  assert.equal(bodyFatCategory(12, 'male'), 'אתלטי');
  assert.equal(bodyFatCategory(12, 'female'), 'שומן חיוני');
  assert.equal(bodyFatCategory(30, 'male'), 'גבוה');
  assert.deepEqual(sortScans([scan({ id: 'old' }), scan({ id: 'new', date: '2026-10-01' }), scan({ id: 'later', createdAt: 5 })]).map(s => s.id), ['new', 'later', 'old']);
});
