#!/usr/bin/env node
// 로컬 실행 서버. 의존성 없이 Node 만으로 돈다.
//
//   npm run dev                      레포 맨 위를 그대로 연다. 파일을 고치고 새로고침하면 바로 보인다
//   npm run preview                  게시용 빌드(dist/)를 NAS 와 같은 하위 주소 /minigames/ 로 연다
//   npm run dev -- --port 9000       포트 바꾸기 (기본 8000, 쓰는 중이면 다음 번호)
//
// - 같은 Wi-Fi 의 폰에서 열 주소를 알려 준다.
// - ES 모듈이 돌도록 .js 를 자바스크립트 형식으로 내보낸다(파일을 더블클릭해 열면 모듈이 막힌다).
// - 캐시를 끈다. 고친 파일이 폰에 바로 닿는다.
// - .git 처럼 점으로 시작하는 경로는 내보내지 않는다.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const preview = args.includes('--preview');
const portArg = args.indexOf('--port');
const firstPort = Number(portArg >= 0 ? args[portArg + 1] : process.env.PORT) || 8000;

// preview: NAS(AnglerBox)처럼 dist/ 를 /minigames/ 아래에 둔다
const ROOT = preview ? path.join(REPO, 'dist') : REPO;
const BASE = preview ? '/minigames/' : '/';

if (preview && !fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error('dist/ 가 없습니다. npm run preview 로 열면 먼저 빌드합니다.');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, '읽기만 됩니다');
  const url = new URL(req.url, 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch (e) {
    return send(res, 400, '주소를 읽지 못했습니다');
  }

  // 하위 주소 밖: preview 에서는 /minigames/ 로 보낸다 (NAS 의 /minigames → /minigames/ 와 같다)
  if (!pathname.startsWith(BASE)) {
    if (pathname === BASE.slice(0, -1) || pathname === '/') return send(res, 301, '', { Location: BASE + url.search });
    return send(res, 404, '없는 주소입니다: ' + pathname);
  }
  const rel = pathname.slice(BASE.length);
  if (rel.split('/').some((seg) => seg.startsWith('.'))) return send(res, 404, '없는 주소입니다');

  let file = path.join(ROOT, rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 404, '없는 주소입니다');

  let stat = fs.statSync(file, { throwIfNoEntry: false });
  if (stat && stat.isDirectory()) {
    // 끝 슬래시가 없으면 붙여서 다시 부른다 (안의 상대 주소가 맞게 풀리도록)
    if (!pathname.endsWith('/')) return send(res, 301, '', { Location: pathname + '/' + url.search });
    file = path.join(file, 'index.html');
    stat = fs.statSync(file, { throwIfNoEntry: false });
  }
  if (!stat || !stat.isFile()) {
    console.log('  404', pathname);
    return send(res, 404, '없는 파일입니다: ' + pathname);
  }

  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-store',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
});

/** 같은 Wi-Fi 의 폰에서 열 수 있는 이 컴퓨터의 주소들 */
function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

function announce(port) {
  const local = `http://localhost:${port}${BASE}`;
  console.log(preview ? '게시용 빌드(dist/)를 NAS 와 같은 주소 모양으로 열었습니다.' : '미니게임 개발 서버가 켜졌습니다. 파일을 고치고 새로고침하면 바로 보여요.');
  console.log('');
  console.log('  이 컴퓨터에서     ' + local);
  for (const ip of lanAddresses()) console.log(`  같은 Wi-Fi 폰에서  http://${ip}:${port}${BASE}`);
  console.log('  부모 대시보드는 주소 끝에 admin.html');
  console.log('');
  console.log('  폰에서 http:// 주소는 카메라와 일부 센서가 막혀 대신 번호 입력·버튼으로 바뀝니다.');
  console.log('끝내려면 Ctrl+C 를 누르세요.');
}

/** 포트를 쓰는 중이면 다음 번호로. 실패한 시도의 안내가 남지 않게 듣는 함수를 시도마다 따로 붙였다 뗀다 */
function listen(port, triesLeft) {
  const onError = (e) => {
    server.off('listening', onListening);
    if (e.code === 'EADDRINUSE' && triesLeft > 0) return listen(port + 1, triesLeft - 1);
    console.error('서버를 켜지 못했습니다:', e.message);
    process.exit(1);
  };
  const onListening = () => {
    server.off('error', onError);
    announce(port);
  };
  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port, '0.0.0.0');
}

process.on('SIGINT', () => {
  console.log('\n서버를 껐습니다.');
  process.exit(0);
});

listen(firstPort, 20);
