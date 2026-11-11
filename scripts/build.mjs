// 소스를 파일 하나(dist/vocab.html)로 묶는다. 내려받아 더블클릭/열기만 하면 동작(서버·인터넷 불필요).
// 사용: node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const strip = (src) => src
  .replace(/^import .*?;\s*$/gm, '')
  .replace(/^export (async function|function|const|let|class)/gm, '$1');

const lib = ['days', 'parser', 'store', 'scheduler', 'answer', 'session', 'render', 'quiz', 'stats', 'views', 'backup', 'speech'].map((n) => strip(read(`src/${n}.js`))).join('\n');
// 한 범위로 합치므로 최상위 이름이 겹치면 브라우저에서 깨진다. 빌드할 때 미리 막는다.
{
  const seen = new Map();
  for (const n of ['days', 'parser', 'store', 'scheduler', 'answer', 'session', 'render', 'quiz', 'stats', 'views', 'backup', 'speech']) {
    for (const m of strip(read(`src/${n}.js`)).matchAll(/^(?:async function|function|const|let|class) ([A-Za-z_$][\w$]*)/gm)) {
      if (seen.has(m[1])) throw new Error(`이름 충돌: ${m[1]} (${seen.get(m[1])}, ${n})`);
      seen.set(m[1], n);
    }
  }
}
const main = strip(read('src/main.js'));
const study = strip(read('src/study.js'));

const body = (html) => html.match(/<body>([\s\S]*?)<script/)[1].replace(/<a class="nav"[^>]*>.*?<\/a>/g, '').trim();
const inputView = body(read('index.html'));
const studyView = body(read('study.html'));

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>단어 암기</title>
<style>
${read('style.css')}
.tabs{display:flex;gap:8px;margin-bottom:12px}.tabs button{flex:1}.tabs button.on{background:var(--acc);border-color:var(--acc);color:#fff}
[hidden]{display:none!important}
</style>
</head>
<body>
<div id="err" style="display:none;position:fixed;left:0;right:0;top:0;z-index:9;background:#b3261e;color:#fff;padding:8px 12px;font-size:13px"></div>
<nav class="tabs"><button id="tab-study" class="on">학습</button><button id="tab-input">DAY 입력</button></nav>
<section id="view-study"><noscript><p style="color:#b3261e"><b>이 화면에서는 자바스크립트가 꺼져 있습니다.</b> Chrome이나 삼성 인터넷으로 열어 주세요.</p></noscript>${studyView.replace('<div id="app"></div>', '<div id="app"><p class="meta" id="loading">불러오는 중… 10초 넘게 이 화면이면 이 뷰어가 앱을 지원하지 않는 것입니다. Chrome이나 삼성 인터넷에서 열어 주세요.</p></div>')}</section>
<section id="view-input" hidden>${inputView}</section>
<script>
(function () {
'use strict';
const showErr = (m) => { const e = document.getElementById('err'); e.style.display = 'block'; e.textContent = '오류: ' + m; };
window.addEventListener('error', (ev) => showErr(ev.message));
window.addEventListener('unhandledrejection', (ev) => showErr(String(ev.reason && ev.reason.message || ev.reason)));
${lib}
{
${main}
}
{
${study}
}
const vs = document.getElementById('view-study'), vi = document.getElementById('view-input');
const ts = document.getElementById('tab-study'), ti = document.getElementById('tab-input');
ts.addEventListener('click', () => { vs.hidden = false; vi.hidden = true; ts.classList.add('on'); ti.classList.remove('on'); window.__studyHome(); });
ti.addEventListener('click', () => { vs.hidden = true; vi.hidden = false; ti.classList.add('on'); ts.classList.remove('on'); });
})();
</script>
</body>
</html>
`;
// 출력 경로: 인자로 주면 그 경로(현재 폴더 기준), 없으면 ../dist/vocab.html
const out = process.argv[2] ? resolve(process.argv[2]) : join(root, '..', 'dist', 'vocab.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(out, Math.round(html.length / 1024) + 'KB');
