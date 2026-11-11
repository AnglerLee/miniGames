#!/usr/bin/env node
// AnglerBox 게시용 빌드. 의존성 없이 Node 22 만으로 돈다.
//
//   npm run build   →   dist/
//
// 하는 일
// 1. 화면에 필요한 파일만 dist/ 로 모은다 (테스트, 개발 문서, 개발용 lab 화면, package.json, serve.py 는 뺀다).
// 2. assets/ 아래 파일을 부르는 주소마다 내용 해시를 붙인다 (예: assets/js/arcade.js?v=1a2b3c4d).
//    AnglerBox nginx 는 앱의 assets/ 경로를 1년 동안 바뀌지 않는 파일(immutable)로 캐시한다.
//    해시가 없으면 고친 arcade.js 가 폰에 영영 닿지 않는다. 해시는 내용이 바뀔 때만 바뀐다.
//    assets/ 파일끼리 부르는 주소도 붙이므로, 해시는 안쪽 파일부터 차례로 정한다.
// 3. 끊어진 링크를 찾는다. 없는 파일을 부르거나 / 로 시작하는 주소(하위 주소 /minigames/ 에서 깨진다)가 있으면 실패한다.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');

/** 게시할 것 (사이트 맨 위 기준) */
const INCLUDE = ['index.html', 'admin.html', 'assets', 'games', 'treasure-hunt3', 'operation-vault', 'home-detective', 'home-submarine'];
const SKIP_DIRS = new Set(['tests', 'docs', 'node_modules', '.git']);
const SKIP_FILE = /(^|\/)(package(-lock)?\.json|serve\.py|lab(-ending)?\.(html|js)|[^/]*\.md|\.DS_Store)$/;
const TEXT = /\.(html|js|mjs|css)$/;
/** 해시를 붙이는 곳 (nginx 가 영구 캐시하는 경로) */
const VERSIONED_DIR = 'assets/';

const errors = [];
const toPosix = (p) => p.split(path.sep).join('/');

async function walk(rel, out) {
  const abs = path.join(ROOT, rel);
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat) throw new Error(`게시할 경로가 없습니다: ${rel}`);
  if (stat.isDirectory()) {
    for (const name of (await fs.readdir(abs)).sort()) {
      if (SKIP_DIRS.has(name)) continue;
      await walk(rel ? `${rel}/${name}` : name, out);
    }
  } else if (!SKIP_FILE.test(rel)) out.push(rel);
}

const files = [];
for (const rel of INCLUDE) await walk(rel, files);
const fileSet = new Set(files);

// ---------------------------------------------------------------- 주소 찾기

/** 같은 사이트 안의 상대 주소인가 (외부 주소, data:, #, 템플릿 조각은 아니다) */
function isLocal(ref) {
  return ref && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\$\{|\{)/i.test(ref) && !ref.includes('${');
}

/** 파일 안에서 고칠 수 있는 주소 자리: [시작, 끝, 주소, 종류] */
function findRefs(rel, text) {
  const refs = [];
  // d 깃발: 묶음(주소)이 글 안 어디에 있는지 정확한 위치를 받는다. offset 은 조각(segment)의 시작 위치
  const scan = (re, group, kind, part = text, offset = 0) => {
    for (const m of part.matchAll(new RegExp(re.source, re.flags + 'd'))) {
      const [start, end] = m.indices[group];
      refs.push({ start: offset + start, end: offset + end, ref: m[group], kind });
    }
  };
  /** HTML 안의 <script>·<style> 본문, style="" 값 */
  const blocks = (re) => [...text.matchAll(new RegExp(re.source, re.flags + 'd'))].map((m) => [m[1], m.indices[1][0]]);
  const scanJs = (part, offset) => {
    // 모듈 import (정적, 동적, 부작용만)
    scan(/\b(?:import|export)\s[^'"`;]*?\bfrom\s*["']([^"']+)["']/g, 1, 'import', part, offset);
    scan(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, 1, 'import', part, offset);
    scan(/\bimport\s*["']([^"']+)["']/g, 1, 'import', part, offset);
    // 스크립트 안의 assets/ 주소 (이미지 등을 문자열로 부르는 곳)
    scan(/["'`]((?:\.\.?\/)*assets\/[^"'`?#\s]+)["'`]/g, 1, 'asset-string', part, offset);
  };
  const scanCss = (part, offset) => {
    scan(/url\(\s*["']?([^"')]+?)["']?\s*\)/g, 1, 'css-url', part, offset);
    scan(/@import\s+["']([^"']+)["']/g, 1, 'css-import', part, offset);
  };
  if (rel.endsWith('.html')) {
    // 태그 안의 src·href 만 (스크립트의 a.href = '...' 같은 대입은 주소 조각일 수 있다)
    scan(/<[a-zA-Z][^>]*?\s(?:src|href)\s*=\s*["']([^"']+)["']/g, 1, 'attr');
    for (const [part, offset] of blocks(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) scanJs(part, offset);
    for (const [part, offset] of blocks(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) scanCss(part, offset);
    for (const [part, offset] of blocks(/\sstyle\s*=\s*"([^"]*)"/gi)) scanCss(part, offset);
  } else if (/\.(js|mjs)$/.test(rel)) scanJs(text, 0);
  else if (rel.endsWith('.css')) scanCss(text, 0);
  // 같은 자리를 두 규칙이 잡을 수 있다 (import 와 asset-string) — 하나만 남긴다
  const seen = new Set();
  return refs
    .filter((r) => {
      const k = r.start + ':' + r.end;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.start - b.start);
}

/** 주소가 가리키는 사이트 안 파일 (없으면 null). 디렉터리면 그 안의 index.html */
function resolveRef(fromRel, ref) {
  const clean = decodeURI(ref.split(/[?#]/)[0]);
  if (!clean) return { target: fromRel };
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), clean));
  if (target.startsWith('..')) return { target: null, outside: true };
  if (fileSet.has(target)) return { target };
  const dirIndex = path.posix.join(target, 'index.html');
  if (clean.endsWith('/') || clean === '.' || clean === '..') return { target: fileSet.has(dirIndex) ? dirIndex : null, dir: true };
  return { target: null };
}

// ---------------------------------------------------------------- 내용과 해시 (안쪽 파일부터)

const finalCache = new Map();
const inProgress = new Set();

async function rawContent(rel) {
  return fs.readFile(path.join(ROOT, rel));
}

function hashOf(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
}

async function versionOf(rel) {
  if (inProgress.has(rel)) return hashOf(await rawContent(rel)); // 서로 부르는 파일: 원래 내용으로
  return hashOf(await finalContent(rel));
}

async function finalContent(rel) {
  if (finalCache.has(rel)) return finalCache.get(rel);
  const raw = await rawContent(rel);
  if (!TEXT.test(rel)) {
    finalCache.set(rel, raw);
    return raw;
  }
  inProgress.add(rel);
  const text = raw.toString('utf8');
  let out = '';
  let pos = 0;
  for (const r of findRefs(rel, text)) {
    if (r.start < pos) continue;
    if (r.ref.startsWith('/') && !r.ref.startsWith('//')) {
      errors.push(`${rel}: / 로 시작하는 주소는 하위 주소에서 깨집니다 → ${r.ref}`);
      continue;
    }
    if (!isLocal(r.ref)) continue;
    const { target, outside } = resolveRef(rel, r.ref);
    if (!target) {
      // a 링크의 없는 페이지, 사라진 이미지, 모듈 import 모두 실패로 본다
      errors.push(`${rel}: 없는 파일을 부릅니다 → ${r.ref}${outside ? ' (사이트 밖)' : ''}`);
      continue;
    }
    if (target.startsWith(VERSIONED_DIR) && !r.ref.includes('?') && target !== rel) {
      out += text.slice(pos, r.end) + '?v=' + (await versionOf(target));
      pos = r.end;
    }
  }
  out += text.slice(pos);
  inProgress.delete(rel);
  const buf = Buffer.from(out, 'utf8');
  finalCache.set(rel, buf);
  return buf;
}

// ---------------------------------------------------------------- 쓰기

await fs.rm(OUT, { recursive: true, force: true });
let bytes = 0;
let versioned = 0;
for (const rel of files) {
  const buf = await finalContent(rel);
  if (TEXT.test(rel)) versioned += (buf.toString('utf8').match(/\?v=[0-9a-f]{10}/g) || []).length;
  const dest = path.join(OUT, rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buf);
  bytes += buf.length;
}

// AnglerBox 는 index.html 의 에셋 주소로 게시 주소(base)를 정한다. 모두 상대 주소여야 한다.
const indexHtml = (await finalContent('index.html')).toString('utf8');
if (/\b(?:src|href)\s*=\s*["']\/(?!\/)/i.test(indexHtml)) errors.push('index.html 에 / 로 시작하는 주소가 있습니다');

if (errors.length) {
  console.error(`빌드 실패: 문제 ${errors.length}개`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`dist/ 에 파일 ${files.length}개 (${(bytes / 1024 / 1024).toFixed(1)}MB), assets 버전 주소 ${versioned}곳`);
