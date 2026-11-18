#!/usr/bin/env node
/**
 * Demo Studio opt-in LOCAL, headless Chromium screenshot probe.
 * Captures an existing loopback-served, explicitly synthetic HTML view only.
 * A host-header assertion is NOT proof of owner-native/source parity or privacy.
 * Never reuses browser profiles, captures a remote URL, uploads pixels, or
 * starts/stops the host app. Requires host-provided Playwright Core.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const SHA = /^[0-9a-f]{40}$/;
const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const PNG_SIG = Buffer.from([137,80,78,71,13,10,26,10]);
function fail(code) { throw new Error('DEMO_CAPTURE_'+code); }
function flags(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!/^--(?:url|repo|sha|out|id|browser|width|height)$/.test(key || '') ||
        !argv[i + 1] || Object.hasOwn(o, key.slice(2))) fail('INVALID_ARGUMENTS');
    o[key.slice(2)] = argv[i + 1];
  }
  if (Object.keys(o).length !== 8) fail('INVALID_ARGUMENTS');
  return o;
}
function n(v) {
  if (!/^[1-9][0-9]{0,4}$/.test(v || '')) fail('INVALID_VIEWPORT');
  const value = Number(v);
  if (!Number.isSafeInteger(value) || value > 10000) fail('INVALID_VIEWPORT');
  return value;
}
function urlOnlyLocal(raw) {
  let url;
  try { url = new URL(raw); } catch { fail('LOOPBACK_ONLY'); }
  if (url.protocol !== 'http:' || !['127.0.0.1','localhost'].includes(url.hostname)
      || url.username || url.password || !url.port || /(?:token|secret|password|key|auth|session)/i.test(url.search)) {
    fail('LOOPBACK_ONLY');
  }
  return url;
}
function pngDimensions(bytes) {
  if (bytes.length < 33 || bytes.length > 25_000_000 ||
      !bytes.subarray(0,8).equals(PNG_SIG) || bytes.readUInt32BE(8) !== 13 ||
      bytes.toString('ascii',12,16) !== 'IHDR') fail('INVALID_PNG');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (!width || !height || width > 10000 || height > 10000) fail('INVALID_PNG');
  return {width,height};
}
async function main() {
  const o = flags(process.argv.slice(2));
  const url = urlOnlyLocal(o.url); // reject external/credential URLs before browser spawn
  const width = n(o.width), height = n(o.height);
  if (!SHA.test(o.sha) || !ID.test(o.id)) fail('INVALID_ARGUMENTS');
  const repo = resolve(o.repo), out = resolve(o.out), browser = resolve(o.browser);
  const outStat = lstatSync(out), browserStat = lstatSync(browser);
  if (!outStat.isDirectory() || outStat.isSymbolicLink() ||
      !browserStat.isFile() || browserStat.isSymbolicLink()) fail('INVALID_PATH');
  const checkout = execFileSync('git', ['-C',repo,'rev-parse','HEAD'],
    {encoding:'utf8',timeout:3000,stdio:['ignore','pipe','ignore']}).trim();
  if (checkout !== o.sha) fail('SOURCE_MISMATCH');
  const response = await fetch(url,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(5000)});
  if (response.status !== 200 || !(response.headers.get('content-type')||'').includes('text/html')) fail('PAGE_NOT_READY');
  const servedSha = response.headers.get('x-demo-source-commit');
  if (servedSha !== checkout) fail('SOURCE_MISMATCH');
  if (response.headers.get('x-demo-synthetic-only') !== 'true') fail('PRIVACY_UNVERIFIED');
  // These headers are a host assertion, not independent content/owner attestation.
  const stem = o.id + '-' + checkout.slice(0,12);
  const pngPath = join(out, stem+'.png'), manifestPath=join(out, stem+'.json');
  if (existsSync(pngPath) || existsSync(manifestPath)) fail('ARTIFACT_EXISTS');
  let automation;
  try {
    const supplied=process.env.DEMO_STUDIO_PLAYWRIGHT_MODULE;
    automation=supplied
      ? await import(pathToFileURL(resolve(supplied)).href)
      : await import('playwright-core');
  } catch { fail('AUTOMATION_UNAVAILABLE'); }
  if (!automation.chromium || typeof automation.chromium.launch !== 'function') fail('AUTOMATION_UNAVAILABLE');
  let runningBrowser;
  let createdPng = false;
  try {
    runningBrowser=await automation.chromium.launch({executablePath:browser,headless:true,timeout:20000});
    const context=await runningBrowser.newContext({viewport:{width,height},deviceScaleFactor:1});
    await context.route('**/*',async(route)=>{
      let allowed=false;
      try {allowed=new URL(route.request().url()).origin===url.origin;} catch {allowed=false;}
      if(allowed) await route.continue(); else await route.abort();
    });
    const page=await context.newPage();
    const navigation=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:15000});
    const headers=navigation?.headers() || {};
    if (navigation?.status()!==200 || headers['x-demo-source-commit']!==checkout ||
        headers['x-demo-synthetic-only']!=='true') fail('SOURCE_MISMATCH');
    // Playwright returns the original screenshot bytes, not a provider-chosen
    // filesystem write. Exclusive creation prevents race clobber and 0600
    // keeps future private-host integrations from leaking pixels by default.
    const bytes = Buffer.from(await page.screenshot({type:'png',animations:'disabled',caret:'hide',timeout:15000}));
    const pngPixels=pngDimensions(bytes);
    try {
      writeFileSync(pngPath,bytes,{flag:'wx',mode:0o600});
      createdPng = true;
    } catch (error) {
      if (error?.code === 'EEXIST') fail('ARTIFACT_EXISTS');
      throw error;
    }
    if (pngPixels.width !== width || pngPixels.height !== height) fail('VIEWPORT_MISMATCH');
    const pngSha256=createHash('sha256').update(bytes).digest('hex');
    const manifest = {
      schema:'demo-studio.local-browser-capture.v1',captureId:o.id,
      captureKind:'BROWSER_HEADLESS',nativeUat:false,ownerUat:false,
      sourceSha:checkout,servedSha,
      provenance:'checkout_head_plus_host_asserted_response_header',
      privacy:'HOST_ASSERTED_SYNTHETIC_ONLY_REVIEW_REQUIRED',
      browser:basename(browser),requestedViewport:{width,height},pngPixels,
      pngFile:basename(pngPath),pngSha256,byteLength:bytes.length,
      capturedAt:new Date().toISOString(),
    };
    writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
    process.stdout.write(JSON.stringify({ok:true,manifest})+'\n');
  } catch(e) {
    // A concurrent writer may have created this path after the initial check.
    // NEVER remove or overwrite that other file on failure.
    if (createdPng && existsSync(pngPath)) rmSync(pngPath,{force:true});
    throw e;
  } finally { try { await runningBrowser?.close(); } catch { /* transient browser shutdown */ } }
}
main().catch(e=>{process.stderr.write((e.message||'DEMO_CAPTURE_FAILED')+'\n');process.exitCode=1;});
