import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync(new URL('../../src/lib/dates.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {parseDate,formatDate}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('Dates from PostgreSQL offsets and old SQLite do not crash profile or users list',()=>{
 const expected=Date.parse('2026-11-21T12:00:00Z');
 for(const input of ['2026-11-21T12:00:00+00:00','2026-11-21T17:00:00+05:00','2026-11-21T12:00:00Z','2026-11-21 12:00:00']){
  assert.equal(parseDate(input).getTime(),expected);assert.notEqual(formatDate(input,'ru-RU'),'—');
 }
 for(const bad of [null,undefined,'','invalid','2026-11-21T12:00:00+00:00Z'])assert.equal(formatDate(bad,'ru-RU'),'—');
});
