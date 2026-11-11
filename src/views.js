// 새 화면(4지선다·통계)의 HTML 조각. DOM에 접근하지 않는다.
import { esc, cardRow } from './render.js';

export function mcqHtml(q) {
  const ask = q.kind === 'infer'
    ? `<p class="meta">어원으로 뜻을 추론하세요</p><div class="big">${esc(q.word)}</div><div class="hint">${esc(q.gloss)}</div><div class="ko">뜻은?</div>`
    : `<p class="meta">어원 조각의 뜻</p><div class="big">${esc(q.word)}</div><div class="ko">"${esc(q.piece)}" 조각의 뜻은?</div>`;
  const opts = q.options.map((o, i) => `<button class="opt" data-i="${i}">${i + 1}. ${esc(o)}</button>`).join('');
  return `${ask}<div id="opts">${opts}</div>`;
}

export function ruleHtml(c) {
  return `<p class="meta">접미사 규칙 · ${esc(c.suffix)}</p>
    <div class="big">${esc(c.base)} <small>(${esc(c.baseBack)})</small></div>
    <div class="ko">+ ${esc(c.suffix)} → ? <small>(${esc(c.back)})</small></div><div class="hint" id="hint"></div>
    <input class="ans" id="ans" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="파생어 입력">`;
}

const fmtDate = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()}`; };

export function statsHtml(s, weak) {
  const bar = (n, max) => `<span class="bar2" style="width:${Math.round((n / Math.max(1, max)) * 100)}%"></span>`;
  const maxMin = Math.max(10, ...s.week.map((w) => w.minutes));
  return `<h1>통계</h1><div class="stage">
    <table class="sum">
      <tr><td>연속 학습일</td><td>${s.streak}일</td></tr>
      <tr><td>학습한 카드</td><td>${s.learned} / ${s.total}장</td></tr>
      <tr><td>숙련(간격 7일 이상)</td><td>${s.mature}장</td></tr>
      <tr><td>취약</td><td>${s.weak}장</td></tr></table>
    <h2>최근 7일 학습 시간(분)</h2>
    ${s.week.map((w) => `<div class="wk"><span>${fmtDate(w.date)}</span><div class="track">${bar(w.minutes, maxMin)}</div><span>${w.minutes}</span></div>`).join('')}
    <h2>DAY별</h2>
    <table class="sum">${s.days.map((d) => `<tr><td>DAY ${d.day}</td><td>${d.learned}/${d.cards} 학습 · 숙련 ${d.mature} · 취약 ${d.weak}</td></tr>`).join('')}</table>
    <h2>자주 틀리는 묶음</h2>
    ${s.groups.length ? `<table class="sum">${s.groups.map((g) => `<tr><td>${esc(g.group)}</td><td>카드당 ${g.rate.toFixed(1)}회 (${g.n}장)</td></tr>`).join('')}</table>` : '<p class="meta">아직 없습니다.</p>'}
    <h2>최근 세션</h2>
    ${s.recent.length ? `<table class="sum">${s.recent.map((l) => `<tr><td>${fmtDate(l.at)} ${l.day == null ? '복습·연습' : 'DAY ' + l.day}</td><td>${Math.max(1, Math.round(l.ms / 60000))}분${l.exam ? ` · 시험 ${Math.round((l.exam.ok / l.exam.n) * 100)}%` : ''}</td></tr>`).join('')}</table>` : '<p class="meta">아직 없습니다.</p>'}
    <h2>오답 노트 (${weak.length}장)</h2>
    ${weak.length ? `<ul>${weak.map(cardRow).join('')}</ul>` : '<p class="meta">틀린 카드가 없습니다.</p>'}
    <div class="btns"><button id="hm" class="g2">처음으로</button></div></div>`;
}
