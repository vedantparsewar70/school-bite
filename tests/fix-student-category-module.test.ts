import './helpers/isolate-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { getStudentCategory, STUDENT_CATEGORIES } from '../lib/student-category';
import { STUDENT_CATEGORIES as FROM_MONTHLY } from '../lib/monthly-menu';

/** Cleanup: getStudentCategory lives in lib/student-category.ts; the October 2026 timetable file is gone. */

test('same results as before for grades and explicit categories', () => {
  const cases: Array<[string | null, string | null, string]> = [
    ['UKG', null, 'Pre-primary'], ['Nursery', null, 'Pre-primary'], ['0', null, 'Pre-primary'],
    ['1', null, 'Primary'], ['Std 5', null, 'Primary'], ['6', null, 'Secondary'], ['10', null, 'Secondary'],
    [null, null, 'Primary'], ['', null, 'Primary'], ['Unknown', null, 'Primary'],
    ['3', 'Secondary', 'Secondary'], ['8', 'pre-primary', 'Pre-primary'], ['8', 'Primary', 'Primary'], ['8', 'other', 'Secondary'],
  ];
  for (const [grade, cat, expected] of cases) assert.equal(getStudentCategory(grade, cat), expected, `${grade}/${cat}`);
  assert.deepEqual([...STUDENT_CATEGORIES], ['Pre-primary', 'Primary', 'Secondary']);
  assert.equal(FROM_MONTHLY, STUDENT_CATEGORIES, 'one list shared by both modules');
});

test('the old timetable file is deleted and the client menu page imports the client-safe module', () => {
  assert.ok(!existsSync('lib/october-2026-timetable.ts'));
  assert.match(readFileSync('app/parent/menu/page.tsx', 'utf-8'), /from '@\/lib\/student-category'/);
  assert.ok(!/^import .*firebase/m.test(readFileSync('lib/student-category.ts', 'utf-8')));
});
