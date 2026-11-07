import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

test('emoji styling does no subtree style work for parent-class changes or unfocused Discord', {timeout:30000}, async()=>{
    const require=createRequire(import.meta.url);
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    const {stdout}=await promisify(execFile)(require('electron'),['tests/performance-profile.cjs'],{env,windowsHide:true,timeout:25000,maxBuffer:1024*1024});
    const result=JSON.parse(stdout.trim());
    assert.equal(result.classChangeStyleReads,0);
    assert.equal(result.backgroundStyleReads,0);
    assert.equal(result.resumeStyleReads,100);
    assert.ok(result.cssBytes<1000);
});
