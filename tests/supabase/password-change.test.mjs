import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync(new URL('../../src/lib/password-change.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {validatePasswordChange,changePassword,passwordError}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('Password change validates confirmation and never omits current password',async()=>{
 assert.equal(validatePasswordChange('old','short','short'),'passwordHint');
 assert.equal(validatePasswordChange('old','new-password123','different'),'passwordMismatch');
 assert.equal(validatePasswordChange('new-password123','new-password123','new-password123'),'passwordSame');
 assert.equal(validatePasswordChange('','new-password123','new-password123'),'currentPasswordRequired');
 assert.equal(validatePasswordChange('old','new-password123','new-password123'),null);
 const requests=[];const auth={updateUser:async body=>{requests.push(body);return {error:null};}};
 assert.equal(await changePassword(auth,'old','new-password123',''),null);
 await changePassword(auth,'old','new-password123',' 123456 ');
 assert.deepEqual(requests,[{current_password:'old',password:'new-password123'},{current_password:'old',password:'new-password123',nonce:'123456'}]);
});
test('Password failures remain failures and reauthentication can be completed',async()=>{
 for(const [code,key] of [['reauthentication_needed','passwordCodeNeeded'],['reauthentication_not_valid','passwordCodeInvalid'],['current_password_invalid','currentPasswordWrong'],['same_password','passwordSame'],['weak_password','passwordWeak']]){
  assert.equal(await changePassword({updateUser:async()=>({error:{code}})},'old','new-password123',''),key);
 }
 assert.equal(passwordError({status:429}),'rateLimit');
 await assert.rejects(()=>changePassword({updateUser:async()=>{throw new Error('offline');}},'old','new-password123',''));
});
