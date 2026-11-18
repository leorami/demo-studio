import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const run = promisify(execFile);
const SCRIPT = new URL('./capture-local-browser.mjs', import.meta.url).pathname;
const PNG_SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);

function snapshotHtml() {
  return [
    '<!doctype html><html lang="en"><head>',
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>SYNTHETIC — Demo Studio screenshot verification</title>',
    '<style>',
    '*{box-sizing:border-box}body{margin:0;background:#101d29;color:#fff;font:600 20px system-ui}',
    'main{min-height:100vh;padding:32px;display:grid;grid-template-rows:auto 1fr auto;gap:24px}',
    'header{font-size:23px;letter-spacing:.03em}.notice{font:500 14px system-ui;color:#c8e5e2}',
    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:stretch}',
    '.tile{border-radius:20px;background:linear-gradient(145deg,#315e74,#74b5a3);min-height:260px}',
    '.tile:nth-child(2){background:linear-gradient(145deg,#8baeb8,#183e5d)}',
    'footer{padding:16px;border:1px solid #93beba;border-radius:16px;text-align:center}',
    '@media(max-width:600px){main{padding:18px;gap:12px}.grid{gap:10px}.tile{min-height:180px}}',
    '</style></head><body><main>',
    '<header>SYNTHETIC SCREENSHOT FIXTURE<div class="notice">Not Calliope. No private or signed-in content.</div></header>',
    '<div class="grid" data-synthetic="true"><div class="tile"></div><div class="tile"></div></div>',
    '<footer>Demo Studio headless Chromium pixels — not native or owner UAT</footer>',
    '</main></body></html>',
  ].join('\n');
}
async function syntheticServer(sha) {
  const body = snapshotHtml();
  const server=createServer((_req,res)=>{
    res.writeHead(200,{
      'Content-Type':'text/html; charset=utf-8',
      'Cache-Control':'no-store',
      'X-Demo-Source-Commit':sha,
      'X-Demo-Synthetic-Only':'true'
    });
    res.end(body);
  });
  await new Promise((done,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',done);
  });
  return {url:'http://127.0.0.1:'+server.address().port+'/synthetic-only',
    close:()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))};
}
function verifyOriginal(pngPath,manifestPath,sha,id,width,height) {
  const bytes=readFileSync(pngPath),m=JSON.parse(readFileSync(manifestPath,'utf8'));
  assert.ok(bytes.subarray(0,8).equals(PNG_SIGNATURE),'real Chromium returned PNG bytes');
  assert.ok(bytes.length>1000,'real browser rendered more than a 1px fake-driver image');
  assert.equal(bytes.readUInt32BE(16),width);
  assert.equal(bytes.readUInt32BE(20),height);
  assert.equal(m.pngSha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(m.schema,'demo-studio.local-browser-capture.v1');
  assert.equal(m.sourceSha,sha);
  assert.equal(m.servedSha,sha);
  assert.equal(m.captureId,id);
  assert.equal(m.captureKind,'BROWSER_HEADLESS');
  assert.equal(m.nativeUat,false);
  assert.equal(m.ownerUat,false);
  assert.equal(m.privacy,'HOST_ASSERTED_SYNTHETIC_ONLY_REVIEW_REQUIRED');
  assert.deepEqual(m.pngPixels,{width,height});
  assert.equal(statSync(pngPath).mode&0o777,0o600);
  assert.equal(statSync(manifestPath).mode&0o777,0o600);
}
test('real headless Chromium captures original source-claimed synthetic PNGs at phone and desktop widths', async()=>{
  const browser=process.env.DEMO_STUDIO_REAL_BROWSER;
  assert.ok(browser?.startsWith('/'),'real Chromium executable required; no fake fallback');
  assert.equal(process.env.DEMO_STUDIO_PLAYWRIGHT_MODULE,undefined,'test must use real playwright-core');

  const root=mkdtempSync(join(tmpdir(),'demo-studio-real-browser-test-'));
  const repo=join(root,'fixture-repo');
  const out=process.env.DEMO_STUDIO_SYNTHETIC_ARTIFACT_DIR
    ?resolve(process.env.DEMO_STUDIO_SYNTHETIC_ARTIFACT_DIR)
    :join(root,'out');
  let host;
  try {
    mkdirSync(repo);mkdirSync(out,{recursive:true});
    await run('git',['init','-q',repo]);
    await run('git',['-C',repo,'config','user.name','Synthetic Test']);
    await run('git',['-C',repo,'config','user.email','synthetic@example.invalid']);
    writeFileSync(join(repo,'fixture.html'),snapshotHtml());
    await run('git',['-C',repo,'add','fixture.html']);
    await run('git',['-C',repo,'commit','-qm','synthetic-source-only']);
    const {stdout}=await run('git',['-C',repo,'rev-parse','HEAD']);
    const sha=stdout.trim();
    assert.match(sha,/^[a-f0-9]{40}$/);
    host=await syntheticServer(sha);
    for (const {id,width,height} of [
      {id:'synthetic-phone',width:390,height:844},
      {id:'synthetic-desktop',width:1440,height:900},
    ]) {
      const args=[SCRIPT,'--url',host.url,'--repo',repo,'--sha',sha,'--out',out,
        '--id',id,'--browser',browser,'--width',String(width),'--height',String(height)];
      const result=await run(process.execPath,args,{timeout:90000,maxBuffer:100000});
      assert.equal(JSON.parse(result.stdout).ok,true);
      verifyOriginal(join(out,id+'-'+sha.slice(0,12)+'.png'),
        join(out,id+'-'+sha.slice(0,12)+'.json'),sha,id,width,height);
    }
  }finally{
    if(host)await host.close();
    rmSync(root,{recursive:true,force:true});
  }
});
