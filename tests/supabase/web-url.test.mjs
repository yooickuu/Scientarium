import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const js=ts.transpileModule(readFileSync(new URL('../../src/lib/web-url.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {normalizeWebUrl}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('Organizer link survives plain, bare, copied Markdown and uppercase URL formats',()=>{
 const expected='https://clck.ru/3WRdNT';
 for(const input of [expected,'clck.ru/3WRdNT','//clck.ru/3WRdNT','HTTPS://CLCK.RU/3WRdNT',` \n${expected}\u00a0`,`[${expected}](${expected})`,`[Регистрация](${expected})`,`<${expected}>`]) {
  assert.deepEqual(normalizeWebUrl(input),{ok:true,value:expected},input);
 }
 assert.deepEqual(normalizeWebUrl(''),{ok:true,value:''});
 assert.deepEqual(normalizeWebUrl('  '),{ok:true,value:''});
});

test('URL normalization preserves query, fragment and HTTP while encoding paths and international domains',()=>{
 const url='https://docs.google.com/forms/d/e/abc/viewform?usp=sharing&entry.1=a%2Bb#section';
 assert.deepEqual(normalizeWebUrl(url),{ok:true,value:url});
 assert.deepEqual(normalizeWebUrl('http://example.org:8080/register'),{ok:true,value:'http://example.org:8080/register'});
 assert.deepEqual(normalizeWebUrl('example.org:8080/register'),{ok:true,value:'https://example.org:8080/register'});
 const international='https://пример.рф/регистрация на событие';
 assert.deepEqual(normalizeWebUrl(international),{ok:true,value:new URL(international).href});
});

test('Invalid and unsafe URLs receive actionable errors instead of being submitted',()=>{
 for(const input of ['https://','not a link','/register','javascript:alert(1)','data:text/html,test','mailto:person@example.org','ftp://example.org','https://user:password@example.org','https://example.org\\@evil.test','https://example.org/a\nb','[Click](javascript:alert(1))']) {
  assert.deepEqual(normalizeWebUrl(input),{ok:false,error:'invalidUrl'},input);
 }
 assert.deepEqual(normalizeWebUrl('https://example.org/'+ 'a'.repeat(2000)),{ok:false,error:'urlTooLong'});
 assert.deepEqual(normalizeWebUrl('https://example.org/'+ 'я'.repeat(400)),{ok:false,error:'urlTooLong'});
});
