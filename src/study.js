// 학습 화면: 복습(오늘 도래분) → 예습 → 떠올리기 → 스펠링 → 모의시험.
import { createStore } from './store.js';
import { parseDay } from './parser.js';
import { DAYS } from './days.js';
import { newState, review, dueCards, startOfDay, addDays } from './scheduler.js';
import { checkTyped, gradeTyped, hintFor, makeCloze, checkCloze, MAX_HINT } from './answer.js';
import { createRun, shuffle } from './session.js';
import { TYPE_LABEL, esc, cardRow, frontHtml, answerHtml, clozeHtml } from './render.js';
import { makeRootQuestions, makeRuleItems } from './quiz.js';
import { computeStats, weakList } from './stats.js';
import { mcqHtml, ruleHtml, statsHtml } from './views.js';
import { makeBackup, validateBackup, downloadJson } from './backup.js';
import { serializeSession, restoreSession, describeSaved } from './persist.js';
import { canSpeak, speak } from './speech.js';

const store = createStore();
const root = document.getElementById('app');
const GOAL_MS = 20 * 60 * 1000;
const PHASE_NAME = { review: '복습', preview: '예습', recall: '떠올리기', spell: '스펠링', roots: '어원 문제', rules: '접미사 규칙', exam: '모의시험', weak: '오답 노트', cram: '시험 대비' };
const N_ROOT = 6, N_RULE = 8;   // 하루 세션의 어원·접미사 문제 수(시간 절약)

let cards = [];            // 전체 카드
let byId = new Map();
let states = new Map();    // id → 간격 반복 상태
let sess = null;           // 진행 중인 세션
let timer = null;
let saved = null;          // 저장된(이어서 할 수 있는) 세션 요약

const examDay = () => {
  try {
    const v = localStorage.getItem('examDay');
    if (!v) return null;
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  } catch { return null; }
};

async function load() {
  cards = await store.listCards();
  byId = new Map(cards.map((c) => [c.id, c]));
  states = new Map((await store.getStates()).map((s) => [s.id, s]));
}

/* ---------- 홈 ---------- */
async function home() {
  clearInterval(timer);
  await load();
  const mode = await store.whenReady();
  const now = Date.now();
  const raw = await store.getSession().catch(() => null);
  saved = raw && restoreSession(raw, byId, now) ? describeSaved(raw) : null;
  if (raw && !saved) await store.clearSession().catch(() => {});     // 복원할 수 없는 저장본은 버린다
  const ago = saved ? Math.max(1, Math.round((now - saved.savedAt) / 60000)) : 0;
  const due = dueCards([...states.values()], now).filter((s) => byId.has(s.id));
  const days = [...new Set(cards.map((c) => c.day))].sort((a, b) => a - b);
  const weak = weakList(cards, [...states.values()]);
  const streak = computeStats(cards, [...states.values()], await store.listLogs(), now).streak;
  const ex = (() => { try { return localStorage.getItem('examDay') || ''; } catch { return ''; } })();
  const rows = days.map((d) => {
    const all = cards.filter((c) => c.day === d);
    const fresh = all.filter((c) => !states.has(c.id)).length;
    return `<button data-day="${d}">DAY ${d} 학습 · ${all.length}장 <small>(새 단어 ${fresh}장)</small></button>`;
  }).join('');
  root.innerHTML = `
    ${mode === 'memory' ? '<p class="ng"><b>이 방식으로 열면 기록이 저장되지 않습니다.</b> 파일을 크롬이나 삼성 인터넷에서 직접 열어 주세요.</p>' : ''}
    <h1>오늘의 학습 <small>${streak ? `🔥 ${streak}일 연속` : ''}</small></h1>
    ${saved ? `<div class="stage" style="min-height:0;margin-bottom:12px"><p><b>하던 학습이 있습니다</b><br>${saved.day == null ? '복습·연습' : `DAY ${saved.day}`} · ${PHASE_NAME[saved.phase]} ${saved.finished}/${saved.total} <small>(${ago}분 전)</small></p>
      <div class="btns"><button id="resume" class="g2">이어서 하기</button><button id="discard" class="g0">버리기</button></div></div>` : ''}
    <div class="stage">
      <p><b>복습할 카드 ${due.length}장</b> <small>(취약 ${due.filter((s) => s.weak).length}장 · 하루 상한 30장)</small></p>
      <div class="btns"><button id="rv" class="${due.length ? 'g2' : ''}" ${due.length ? '' : 'disabled'}>복습만 하기</button></div>
      <h2>새 DAY 학습</h2>
      <div class="days">${rows || `<p class="empty">저장된 DAY가 없습니다.</p>${Object.keys(DAYS).length ? '<button id="seed">내장 DAY 9~15 불러오기</button>' : ''}<p class="meta">위의 "DAY 입력" 탭에서 단어를 붙여넣거나, 아래 "기록 가져오기"로 백업 파일을 불러오세요.</p>`}</div>
      <p class="meta">DAY 학습을 시작하면 복습 카드가 먼저 나옵니다.</p>
      <h2>따로 연습</h2>
      <div class="btns"><button id="wk" ${weak.length ? '' : 'disabled'}>오답 노트 (${weak.length}장)</button><button id="pr" ${cards.some((c) => c.type === 'root') ? '' : 'disabled'}>어원·접미사 연습</button><button id="st">통계</button></div>
      <h2>시험 대비 (선택한 DAY 전체를 힌트 없이 한 번에)</h2>
      <div>${days.map((d) => `<label class="chk"><input type="checkbox" data-cram value="${d}"> DAY ${d}</label>`).join(' ')}</div>
      <div class="btns"><button id="cram" disabled>시험 대비 시작</button></div>
      <label>시험 날짜(선택) <input type="date" id="exam" value="${ex}"></label>
      <p class="meta">시험 날짜를 정하면 복습이 시험 전날까지 몰리도록 당겨집니다.</p>
      <h2>기록 관리</h2>
      <div class="btns"><button id="exp">기록 내보내기</button><button id="imp">기록 가져오기</button><input type="file" id="impf" accept="application/json,.json" hidden></div>
      ${canSpeak() ? `<label class="chk"><input type="checkbox" id="tts" ${ttsOn() ? 'checked' : ''}> 정답 확인할 때 발음 자동 재생</label>` : ''}
      <p class="meta" id="note"></p>
    </div>`;
  root.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => start(Number(b.dataset.day))));
  document.getElementById('seed')?.addEventListener('click', async () => {
    for (const t of Object.values(DAYS)) await store.putCards(parseDay(t).cards);
    home();
  });
  document.getElementById('resume')?.addEventListener('click', resume);
  document.getElementById('discard')?.addEventListener('click', async () => { if (confirm('하던 학습을 버릴까요? (이미 저장된 복습 기록은 유지됩니다)')) { await store.clearSession(); home(); } });
  document.getElementById('rv').addEventListener('click', () => start(null));
  const boxes = [...root.querySelectorAll('[data-cram]')];
  boxes.forEach((b) => b.addEventListener('change', () => { document.getElementById('cram').disabled = !boxes.some((x) => x.checked); }));
  document.getElementById('cram').addEventListener('click', () => startCram(boxes.filter((x) => x.checked).map((x) => Number(x.value))));
  document.getElementById('exp').addEventListener('click', exportBackup);
  document.getElementById('imp').addEventListener('click', () => document.getElementById('impf').click());
  document.getElementById('impf').addEventListener('change', (e) => importBackup(e.target.files[0]));
  document.getElementById('tts')?.addEventListener('change', (e) => { try { localStorage.setItem('tts', e.target.checked ? '1' : '0'); } catch { /* 무시 */ } });
  document.getElementById('wk').addEventListener('click', startWeak);
  document.getElementById('pr').addEventListener('click', startPractice);
  document.getElementById('st').addEventListener('click', showStats);
  document.getElementById('exam').addEventListener('change', (e) => {
    try { e.target.value ? localStorage.setItem('examDay', e.target.value) : localStorage.removeItem('examDay'); } catch { /* 무시 */ }
  });
}

/* ---------- 세션 ---------- */
function start(day) {
  const now = Date.now();
  const due = dueCards([...states.values()], now).map((s) => byId.get(s.id)).filter(Boolean);
  const todays = day == null ? [] : cards.filter((c) => c.day === day);
  const phases = [];
  if (due.length) phases.push({ id: 'review', items: due, mode: 'typed', hints: true, updates: true });
  if (todays.length) {
    phases.push({ id: 'preview', items: todays });
    phases.push({ id: 'recall', items: shuffle(todays, now), mode: 'flip' });
    phases.push({ id: 'spell', items: shuffle(todays, now + 1), mode: 'typed', hints: true, updates: false });
    const rq = makeRootQuestions(todays, cards, N_ROOT, now + 3);
    if (rq.length) phases.push({ id: 'roots', items: rq, mode: 'mcq' });
    const ri = makeRuleItems(todays, N_RULE, now + 4);
    if (ri.length) phases.push({ id: 'rules', items: ri, mode: 'rule' });
    phases.push({ id: 'exam', items: shuffle(todays, now + 2), mode: 'typed', hints: false, updates: true });
  }
  launch(day, phases, now);
}

const persist = () => { if (sess?.cur) store.putSession(serializeSession(sess, Date.now())).catch(() => {}); };
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
window.addEventListener('pagehide', persist);

async function resume() {
  const raw = await store.getSession();
  const s = raw && restoreSession(raw, byId, Date.now());
  if (!s) return home();
  sess = s;
  clearInterval(timer);
  timer = setInterval(tick, 1000);
  if (sess.cur.id === 'preview') renderPreview(sess.cur); else step();
}

function launch(day, phases, now) {
  if (saved && !confirm('하던 학습이 있습니다. 새로 시작하면 그 진행은 사라집니다. 계속할까요?')) return;
  sess = { day, phases, pi: -1, t0: now, seen: new Set(), done: [] };
  clearInterval(timer);
  timer = setInterval(tick, 1000);
  nextPhase();
}

const ttsOn = () => { try { return localStorage.getItem('tts') === '1'; } catch { return false; } };
const speakBtn = (card) => (canSpeak() ? '<button class="sp" aria-label="발음 듣기">🔊</button>' : '');
const bindSpeak = (card) => root.querySelector('.sp')?.addEventListener('click', () => speak(card));
const autoSpeak = (card) => { if (ttsOn() && card.type !== 'proverb') speak(card); };

async function exportBackup() {
  await load();
  const data = makeBackup({ ...(await store.exportAll()), examDay: (() => { try { return localStorage.getItem('examDay'); } catch { return null; } })() }, Date.now());
  const d = new Date();
  const fname = `vocab-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
  try { await downloadJson(data, fname); } catch {
    // 파일 저장·공유가 막힌 환경: 글자를 복사해 두었다가 나중에 .json 파일로 저장해 가져올 수 있게 한다.
    document.getElementById('note').innerHTML = '파일 저장이 안 되어 글자로 보여 드립니다. 전체를 복사해 메모 앱 등에 보관하세요.<textarea readonly rows="6" style="width:100%"></textarea>';
    document.querySelector('#note textarea').value = JSON.stringify(data);
    return;
  }
  document.getElementById('note').textContent = `내보냈습니다: 카드 ${data.cards.length}장, 학습 상태 ${data.states.length}개, 세션 기록 ${data.logs.length}개`;
}

async function importBackup(file) {
  if (!file) return;
  const note = document.getElementById('note');
  let data;
  try { data = JSON.parse(await file.text()); } catch { note.textContent = '파일을 읽지 못했습니다(JSON 형식이 아님).'; return; }
  const v = validateBackup(data);
  if (!v.ok) { note.textContent = v.error; return; }
  if (!confirm(`지금 기록을 지우고 백업으로 바꿉니다. (카드 ${v.counts.cards}장, 상태 ${v.counts.states}개, 기록 ${v.counts.logs}개)`)) return;
  await store.importAll(data);
  try { data.settings?.examDay ? localStorage.setItem('examDay', data.settings.examDay) : localStorage.removeItem('examDay'); } catch { /* 무시 */ }
  await home();
  document.getElementById('note').textContent = '가져왔습니다.';
}

function startCram(daysSel) {
  const st = states;
  const pool = cards.filter((c) => daysSel.includes(c.day));
  const weakFirst = shuffle(pool, Date.now()).sort((a, b) => Number(st.get(b.id)?.weak ?? 0) - Number(st.get(a.id)?.weak ?? 0));
  if (weakFirst.length) launch(null, [{ id: 'cram', items: weakFirst, mode: 'typed', hints: false, updates: true }], Date.now());
}

function startWeak() {
  const items = weakList(cards, [...states.values()]);
  if (items.length) launch(null, [{ id: 'weak', items, mode: 'typed', hints: true, updates: true }], Date.now());
}

function startPractice() {
  const now = Date.now();
  const phases = [];
  const rq = makeRootQuestions(cards, cards, 12, now);
  if (rq.length) phases.push({ id: 'roots', items: rq, mode: 'mcq' });
  const ri = makeRuleItems(cards, 10, now + 1);
  if (ri.length) phases.push({ id: 'rules', items: ri, mode: 'rule' });
  if (phases.length) launch(null, phases, now);
}

async function showStats() {
  await load();
  const s = computeStats(cards, [...states.values()], await store.listLogs(), Date.now());
  root.innerHTML = statsHtml(s, weakList(cards, [...states.values()], 30));
  document.getElementById('hm').addEventListener('click', home);
}

function tick() {
  const el = document.getElementById('timer');
  if (!el || !sess) return;
  const ms = Date.now() - sess.t0;
  const f = (v) => `${Math.floor(v / 60000)}:${String(Math.floor(v / 1000) % 60).padStart(2, '0')}`;
  el.textContent = `${f(ms)} / ${f(GOAL_MS)}`;
  el.className = ms > GOAL_MS ? 'ng' : '';
}

function nextPhase() {
  if (sess.cur?.run) sess.done.push(sess.cur);
  sess.pi += 1;
  const p = sess.phases[sess.pi];
  if (!p) return finish();
  sess.cur = p;
  if (p.id === 'preview') { persist(); return renderPreview(p); }
  p.run = createRun(p.items);
  persist();
  step();
}

function bar() {
  const p = sess.cur;
  const pr = p.run ? p.run.progress() : { total: 1, finished: 0 };
  return `<div class="bar"><b>${PHASE_NAME[p.id]}</b><span>${pr.finished}/${pr.total}</span><span id="timer"></span></div>
    <progress max="${pr.total}" value="${pr.finished}"></progress>`;
}

function step() {
  const p = sess.cur;
  const card = p.run.current();
  if (!card) return nextPhase();
  if (p.mode === 'flip') return renderFlip(card);
  if (p.mode === 'mcq') return renderMcq(card);
  if (p.mode === 'rule') return renderRule(card);
  return renderTyped(card);
}

function setStage(html) {
  root.innerHTML = bar() + `<div class="stage">${html}</div>`;
  tick();
}

/* ---------- 예습 ---------- */
function renderPreview(p) {
  root.innerHTML = `<div class="bar"><b>예습</b><span id="timer"></span></div>
    <div class="stage"><p class="meta">한 번 훑어보세요(약 2분). 이 다음부터는 보지 않고 떠올립니다.</p>
    <ul>${p.items.map(cardRow).join('')}</ul>
    <div class="btns"><button id="go" class="g2">다 봤어요 ▶</button></div></div>`;
  tick();
  document.getElementById('go').addEventListener('click', nextPhase);
}

/* ---------- 떠올리기(뒤집기 + 자기 평가) ---------- */
function renderFlip(card) {
  setStage(`<p class="meta">${TYPE_LABEL[card.type]} · 뜻을 먼저 떠올린 뒤 뒤집으세요</p>
    <div class="big">${frontHtml(card)}</div>
    <div class="btns"><button id="flip" class="g2">뒤집기 (Space)</button>${speakBtn(card)}</div>`);
  bindSpeak(card);
  const reveal = () => {
    document.removeEventListener('keydown', onKey);
    setStage(`${answerHtml(card)}
      <div class="btns"><button data-g="0" class="g0">몰랐다 (1)</button><button data-g="1">헷갈렸다 (2)</button><button data-g="2" class="g2">알았다 (3)</button>${speakBtn(card)}</div>`);
    bindSpeak(card); autoSpeak(card);
    const grade = (g) => { document.removeEventListener('keydown', onGrade); sess.cur.run.submit(g); persist(); step(); };
    const onGrade = (e) => { if ('123'.includes(e.key) && e.key) grade(Number(e.key) - 1); };
    root.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => grade(Number(b.dataset.g))));
    document.addEventListener('keydown', onGrade);
  };
  const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(); } };
  document.getElementById('flip').addEventListener('click', reveal);
  document.addEventListener('keydown', onKey);
}

/* ---------- 입력 문제(단어: 한→영 타이핑, 속담: 빈칸) ---------- */
function promptHtml(card, cloze) {
  const label = TYPE_LABEL[card.type] + (card.type === 'suffix' ? ` · ${card.suffix}` : card.type === 'root' ? ` · ${card.pos}` : '');
  const body = cloze ? `<div class="cloze" id="cz">${clozeHtml(cloze)}</div>` : '<input class="ans" id="ans" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="영어로 입력">';
  return `<p class="meta">${esc(label)}</p><div class="ko">${esc(card.back)}</div><div class="hint" id="hint"></div>${body}`;
}

function renderTyped(card) {
  const p = sess.cur;
  const cloze = card.type === 'proverb' ? makeCloze(card) : null;
  let hints = 0;
  setStage(`${promptHtml(card, cloze)}
    <div class="btns">${p.hints ? '<button id="hb">힌트</button>' : ''}<button id="idk" class="g0">모르겠어요</button><button id="sb" class="g2">확인 (Enter)</button></div>`);
  const inputs = () => [...root.querySelectorAll(cloze ? 'input.blank' : 'input.ans')];
  inputs()[0].focus();

  const submit = (giveUp = false) => {
    document.removeEventListener('keydown', onEnter);
    const vals = inputs().map((i) => (giveUp ? '' : i.value));
    const res = cloze ? checkCloze(cloze, vals) : checkTyped(card, vals[0], cards);
    const grade = gradeTyped(res.ok, hints);
    record(card, grade);
    p.run.submit(grade);
    persist();
    const shown = cloze
      ? `<div class="cloze">${clozeHtml(cloze, vals, res.each)}</div>`
      : answerHtml(card);
    setStage(`<p class="${res.ok ? 'ok' : 'ng'}">${res.ok ? '정답' : '오답'}</p>${res.ok && !cloze ? '' : ''}${shown}
      ${cloze ? `<p class="meta">${esc(card.back)}</p>` : ''}
      <div class="btns"><button id="nx" class="g2">다음 (Enter)</button>${speakBtn(card)}</div>`);
    bindSpeak(card); autoSpeak(card);
    const nx = () => { document.removeEventListener('keydown', onNext); step(); };
    const onNext = (e) => { if (e.key === 'Enter') { e.preventDefault(); nx(); } };
    document.getElementById('nx').addEventListener('click', nx);
    setTimeout(() => document.addEventListener('keydown', onNext), 0);
  };
  const onEnter = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const list = inputs();
    const i = list.indexOf(document.activeElement);
    if (i >= 0 && i < list.length - 1) list[i + 1].focus(); else submit();
  };
  document.addEventListener('keydown', onEnter);
  document.getElementById('sb').addEventListener('click', () => submit());
  document.getElementById('idk').addEventListener('click', () => submit(true));
  document.getElementById('hb')?.addEventListener('click', () => {
    if (cloze) return; // 빈칸 문제는 한국어 뜻이 힌트
    hints = Math.min(MAX_HINT, hints + 1);
    document.getElementById('hint').textContent = hintFor(card, hints);
    inputs()[0].focus();
  });
}

/* ---------- 어원 4지선다 ---------- */
function renderMcq(q) {
  setStage(mcqHtml(q));
  const pick = (i) => {
    document.removeEventListener('keydown', onKey);
    const ok = i === q.answer;
    sess.cur.run.submit(ok ? 2 : 0);
    persist();
    root.querySelectorAll('.opt').forEach((b) => {
      b.disabled = true;
      if (Number(b.dataset.i) === q.answer) b.classList.add('right');
      else if (Number(b.dataset.i) === i) b.classList.add('wrong');
    });
    root.querySelector('#opts').insertAdjacentHTML('afterend', `<p class="${ok ? 'ok' : 'ng'}">${ok ? '정답' : '오답'}</p><div class="btns"><button id="nx" class="g2">다음 (Enter)</button></div>`);
    const nx = () => { document.removeEventListener('keydown', onNext); step(); };
    const onNext = (e) => { if (e.key === 'Enter') { e.preventDefault(); nx(); } };
    document.getElementById('nx').addEventListener('click', nx);
    setTimeout(() => document.addEventListener('keydown', onNext), 0);
  };
  const onKey = (e) => { if ('1234'.includes(e.key) && e.key) pick(Number(e.key) - 1); };
  root.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => pick(Number(b.dataset.i))));
  document.addEventListener('keydown', onKey);
}

/* ---------- 접미사 규칙(기본어 + 접미사 → 파생어) ---------- */
function renderRule(card) {
  let hint = 0;
  setStage(`${ruleHtml(card)}<div class="btns"><button id="hb">힌트</button><button id="idk" class="g0">모르겠어요</button><button id="sb" class="g2">확인 (Enter)</button></div>`);
  const input = document.getElementById('ans');
  input.focus();
  const submit = (giveUp) => {
    document.removeEventListener('keydown', onEnter);
    const res = checkTyped(card, giveUp ? '' : input.value, cards);
    sess.cur.run.submit(gradeTyped(res.ok, hint));
    persist();
    setStage(`<p class="${res.ok ? 'ok' : 'ng'}">${res.ok ? '정답' : '오답'}</p>${answerHtml(card)}
      <div class="btns"><button id="nx" class="g2">다음 (Enter)</button></div>`);
    const nx = () => { document.removeEventListener('keydown', onNext); step(); };
    const onNext = (e) => { if (e.key === 'Enter') { e.preventDefault(); nx(); } };
    document.getElementById('nx').addEventListener('click', nx);
    setTimeout(() => document.addEventListener('keydown', onNext), 0);
  };
  const onEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(false); } };
  document.addEventListener('keydown', onEnter);
  document.getElementById('sb').addEventListener('click', () => submit(false));
  document.getElementById('idk').addEventListener('click', () => submit(true));
  document.getElementById('hb').addEventListener('click', () => {
    hint = 2;
    document.getElementById('hint').textContent = hintFor(card, 2);
    input.focus();
  });
}

/* ---------- 상태 갱신(첫 시도만, 복습·시험 단계) ---------- */
async function record(card, grade) {
  const p = sess.cur;
  if (!p.updates || sess.seen.has(p.id + card.id)) return;
  sess.seen.add(p.id + card.id);
  const next = review(states.get(card.id) ?? newState(card.id, Date.now()), grade, Date.now(), { examDay: examDay() });
  states.set(card.id, next);
  await store.putState(next);
}

/* ---------- 마무리 ---------- */
async function finish() {
  clearInterval(timer);
  saved = null;
  await store.clearSession().catch(() => {});
  const ms = Date.now() - sess.t0;
  const get = (id) => sess.done.find((p) => p.id === id);
  const stat = (id) => {
    const r = get(id)?.run?.results();
    if (!r) return null;
    const v = [...r.values()];
    return { n: v.length, ok: v.filter((g) => g === 2).length, ids: [...r.entries()].filter(([, g]) => g === 0).map(([k]) => k) };
  };
  const rv = stat('review'), ex = stat('exam'), rt = stat('roots'), ru = stat('rules'), wk = stat('weak'), cr = stat('cram');
  const weak = [...(rv?.ids ?? []), ...(ex?.ids ?? []), ...(wk?.ids ?? []), ...(cr?.ids ?? [])].map((id) => byId.get(id)).filter(Boolean);
  const eod = addDays(startOfDay(Date.now()), 2);
  const tomorrow = [...states.values()].filter((s) => s.due < eod && s.lastReview != null).length;
  const brief = (x) => x && { n: x.n, ok: x.ok };
  await store.putLog({ at: Date.now(), day: sess.day, ms, review: brief(rv), exam: brief(ex), roots: brief(rt), rules: brief(ru), weak: brief(wk), cram: brief(cr) });
  const pct = (s) => (s ? `${s.ok}/${s.n} (${Math.round((s.ok / s.n) * 100)}%)` : '-');
  const mm = `${Math.floor(ms / 60000)}분 ${Math.floor(ms / 1000) % 60}초`;
  root.innerHTML = `<h1>완료</h1><div class="stage"><table class="sum">
    <tr><td>걸린 시간</td><td>${mm}</td></tr>
    ${rv ? `<tr><td>복습 첫 시도 정답</td><td>${pct(rv)}</td></tr>` : ''}
    ${rt ? `<tr><td>어원 문제 첫 시도 정답</td><td>${pct(rt)}</td></tr>` : ''}
    ${ru ? `<tr><td>접미사 규칙 첫 시도 정답</td><td>${pct(ru)}</td></tr>` : ''}
    ${wk ? `<tr><td>오답 노트 첫 시도 정답</td><td>${pct(wk)}</td></tr>` : ''}
    ${cr ? `<tr><td>시험 대비 첫 시도 정답</td><td>${pct(cr)}</td></tr>` : ''}
    ${ex ? `<tr><td>모의시험 첫 시도 정답</td><td>${pct(ex)}</td></tr>` : ''}
    <tr><td>내일까지 복습할 카드</td><td>${tomorrow}장</td></tr></table>
    ${weak.length ? `<h2>취약 단어</h2><ul>${weak.map(cardRow).join('')}</ul>` : '<p class="ok">취약 단어 없음</p>'}
    <div class="btns"><button id="hm" class="g2">처음으로</button></div></div>`;
  document.getElementById('hm').addEventListener('click', home);
  sess = null;
}

window.__studyHome = () => home().catch((e) => { root.innerHTML = `<p class="ng">화면을 그리지 못했습니다: ${esc(e.message)}</p>`; });
window.__study = { get sess() { return sess; }, current: () => sess?.cur?.run?.current() }; // 점검용
void 0; // 점검용
window.__studyHome();
