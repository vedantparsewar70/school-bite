import './helpers/isolate-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { csvCell } from '../lib/not-served';

/** HIGH 6: the admin sales-report CSV is safe in Excel and is never cut short. */

test('every cell is quoted, quotes are escaped, and formulas never run', () => {
  assert.equal(csvCell('=HYPERLINK("http://x","click")'), `"'=HYPERLINK(""http://x"",""click"")"`);
  assert.equal(csvCell('+91 98765 43210'), `"'+91 98765 43210"`);
  assert.equal(csvCell('@SUM(A1)'), `"'@SUM(A1)"`);
  assert.equal(csvCell('Riya "Ri" Sharma'), `"Riya ""Ri"" Sharma"`);
  assert.equal(csvCell('Dal #2'), `"Dal #2"`, '# is kept, inside quotes');
  assert.equal(csvCell(12), `"12"`);
  assert.equal(csvCell(null), `""`);
});

test('the reports page builds every cell with csvCell and downloads a Blob (no encodeURI data URL)', () => {
  const src = readFileSync('app/admin/reports/page.tsx', 'utf-8');
  const exporter = src.slice(src.indexOf('const handleExportCSV'), src.indexOf("showToast('Report exported.'"));
  assert.match(exporter, /cells\.map\(csvCell\)/);
  assert.match(exporter, /new Blob\(/);
  assert.ok(!exporter.includes('encodeURI'), 'no data: URL that a # would cut short');
  assert.ok(!/`"\$\{r\./.test(exporter), 'no hand-quoted cells');
  for (const field of ['r.parentName', 'r.studentName', 'r.studentClass', 'r.division']) {
    assert.ok(exporter.includes(field), `${field} exported`);
  }
  // The internal student ID and the roll number are never exported.
  for (const field of ['r.studentId', 'r.rollNo', "'Student ID'", "'Roll No'"]) assert.ok(!exporter.includes(field), `${field} not exported`);
});
