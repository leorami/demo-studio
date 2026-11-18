import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, chmodSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
const run = promisify(execFile);
const script = new URL('./capture-local-browser.mjs', import.meta.url).pathname;
const originalPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y5M2S0AAAAASUVORK5CYII=', 'base64');

async function fixture({ servedCommit = null, synthetic = 'true', racingWriter = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'demo-capture-test-'));
  const repo = join(root, 'source'); const out = join(root, 'out');
  mkdirSync(repo); mkdirSync(out);
  await run('git', ['init', '-q', repo]);
  await run('git', ['-C', repo, 'config', 'user.name', 'Test Runner']);
  await run('git', ['-C', repo, 'config', 'user.email', 'nobody@example.invalid']);
  writeFileSync(join(repo, 'sample.txt'), 'synthetic test fixture');
  await run('git', ['-C', repo, 'add', 'sample.txt']);
  await run('git', ['-C', repo, 'commit', '-qm', 'fixture']);
  const { stdout } = await run('git', ['-C', repo, 'rev-parse', 'HEAD']);
  const sha = stdout.trim();
  const browser = join(root, 'mock-chromium.mjs');
  writeFileSync(browser, '// Fake browser path; Playwright provider owns capture\n');
  const driver = join(root, 'fake-playwright.mjs');
  const driverScript = [
    "import {writeFileSync} from 'node:fs';",
    'export const chromium={launch:async()=>({',
    'newContext:async()=>({route:async()=>{},newPage:async()=>({',
    "goto:async()=>({status:()=>200,headers:()=>({'x-demo-source-commit':"+JSON.stringify(sha)+",'x-demo-synthetic-only':'true'})}),",
    'screenshot:async({path})=>{'+(racingWriter?"writeFileSync(path,'KEEP_ME');":'')+'return Buffer.from('+JSON.stringify(originalPng.toString('base64'))+",'base64');}",
    '})}),close:async()=>{}})};',
  ].join('\n');
  writeFileSync(driver, driverScript);
  const server = createServer((_req, res) => {
    if (servedCommit !== 'missing') res.setHeader('X-Demo-Source-Commit', servedCommit || sha);
    if (synthetic !== null) res.setHeader('X-Demo-Synthetic-Only', synthetic);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>Public synthetic test</title><h1>Example</h1>');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { root, repo, out, browser, driver, sha, url:'http://127.0.0.1:'+server.address().port+'/',
    close:async()=>{await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});} };
}
async function attempt(f, extra=[]) {
  const args=[script,'--url',f.url,'--repo',f.repo,'--sha',f.sha,'--out',f.out,
    '--id','first-fold','--browser',f.browser,'--width','1','--height','1'];
  for(let i=0;i<extra.length;i+=2){const at=args.indexOf(extra[i]);assert.ok(at>0);args[at+1]=extra[i+1];}
  try { const r=await run(process.execPath,args,{timeout:10000,env:{...process.env,DEMO_STUDIO_PLAYWRIGHT_MODULE:f.driver}}); return {code:0,stdout:r.stdout,stderr:r.stderr}; }
  catch(e){ return {code:e.code,stdout:e.stdout,stderr:e.stderr}; }
}

test('RED: a real PNG from a declared local synthetic served-commit fixture produces a byte-hashed browser-only manifest',async()=>{
  const f=await fixture();try{const r=await attempt(f); assert.equal(r.code,0,r.stderr);
    const entries=readdirSync(f.out),png=entries.find(x=>x.endsWith('.png')),m=entries.find(x=>x.endsWith('.json'));
    assert.ok(png&&m);const data=readFileSync(join(f.out,png));const manifest=JSON.parse(readFileSync(join(f.out,m),'utf8'));
    assert.equal(manifest.captureKind,'BROWSER_HEADLESS');assert.equal(manifest.nativeUat,false);
    assert.equal(manifest.sourceSha,f.sha);assert.equal(manifest.servedSha,f.sha);
    assert.equal(manifest.pngSha256,createHash('sha256').update(data).digest('hex'));
    assert.deepEqual(manifest.pngPixels,{width:1,height:1});
  }finally{await f.close()}
});
test('RED: a served source mismatch refuses capture before calling browser',async()=>{
  const f=await fixture({servedCommit:'a'.repeat(40)});try{const r=await attempt(f);
    assert.notEqual(r.code,0);assert.match(r.stderr,/SOURCE_MISMATCH/);assert.equal(readdirSync(f.out).length,0);
  }finally{await f.close()}
});
test('RED: absent synthetic-only attestation refuses capture',async()=>{
  const f=await fixture({synthetic:null});try{const r=await attempt(f);
    assert.notEqual(r.code,0);assert.match(r.stderr,/PRIVACY_UNVERIFIED/);assert.equal(readdirSync(f.out).length,0);
  }finally{await f.close()}
});
test('RED: external URL and embedded credentials cannot trigger browser screenshot',async()=>{
  const f=await fixture();try{
    const external=await attempt(f,['--url','https://example.org/']);
    assert.notEqual(external.code,0);assert.match(external.stderr,/LOOPBACK_ONLY/);
    const embedded=await attempt(f,['--url',f.url.replace('127.0.0.1','user:pass@127.0.0.1')]);
    assert.notEqual(embedded.code,0);assert.match(embedded.stderr,/LOOPBACK_ONLY/);
    assert.equal(readdirSync(f.out).length,0);
  }finally{await f.close()}
});
test('RED: repository SHA mismatch refuses screenshot without altering artifacts',async()=>{
  const f=await fixture();try{const r=await attempt(f,['--sha','b'.repeat(40)]);
    assert.notEqual(r.code,0);assert.match(r.stderr,/SOURCE_MISMATCH/);assert.equal(readdirSync(f.out).length,0);
  }finally{await f.close()}
});

test('RED: screenshots use exclusive owner-readable permissions rather than provider default image permissions',async()=>{
  const f=await fixture();try{
    const r=await attempt(f);assert.equal(r.code,0,r.stderr);
    for(const file of readdirSync(f.out)){
      assert.equal(statSync(join(f.out,file)).mode & 0o777,0o600,file+' must be private');
    }
  }finally{await f.close()}
});
test('RED: a race-created screenshot is never overwritten or deleted during cleanup',async()=>{
  const f=await fixture({racingWriter:true});try{
    const r=await attempt(f);assert.notEqual(r.code,0);
    const entries=readdirSync(f.out);assert.equal(entries.length,1);
    assert.match(entries[0],/\.png$/);
    assert.equal(readFileSync(join(f.out,entries[0]),'utf8'),'KEEP_ME');
  }finally{await f.close()}
});
