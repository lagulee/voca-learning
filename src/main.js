import { parseDay } from './parser.js';
import { createStore } from './store.js';
import { DAYS } from './days.js';
import { cardRow, esc } from './render.js';

const store = createStore();
const $ = (id) => document.getElementById(id);
let pending = null;

function preview() {
  const r = parseDay($('input').value);
  pending = r;
  const msgs = [
    ...r.errors.map((e) => `<li class="err">줄 ${e.line}: ${esc(e.msg)}</li>`),
    ...r.warnings.map((e) => `<li class="warn">줄 ${e.line}: ${esc(e.msg)}</li>`),
  ].join('');
  $('msgs').innerHTML = msgs;
  $('preview').innerHTML = r.cards.map(cardRow).join('');
  $('count').textContent = r.cards.length ? `DAY ${r.day} · ${r.cards.length}장` : '';
  $('save').disabled = r.errors.length > 0 || r.cards.length === 0;
}

async function save() {
  if (!pending || pending.errors.length) return;
  await store.putCards(pending.cards);
  $('input').value = '';
  preview();
  await refresh();
}

async function refresh() {
  const days = await store.listDays();
  const box = $('days');
  box.innerHTML = days.length ? '' : '<p class="empty">저장된 DAY가 없습니다.</p>';
  for (const d of days) {
    const cards = await store.listCards({ day: d });
    const det = document.createElement('details');
    det.innerHTML = `<summary>DAY ${d} · ${cards.length}장</summary><ul>${cards.map(cardRow).join('')}</ul><button data-del="${d}">이 DAY 삭제</button>`;
    box.appendChild(det);
  }
  box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (confirm(`DAY ${b.dataset.del} 카드를 모두 삭제할까요?`)) { await store.deleteDay(Number(b.dataset.del)); refresh(); }
  }));
}

$('input').addEventListener('input', preview);
$('save').addEventListener('click', save);
if (!Object.keys(DAYS).length) ['dayPick', 'load', 'saveAll'].forEach((id) => { $(id).hidden = true; });
const sel = $('dayPick');
Object.keys(DAYS).forEach((d) => sel.add(new Option(`DAY ${d}`, d)));
$('load').addEventListener('click', () => { $('input').value = DAYS[sel.value]; preview(); });
$('saveAll').addEventListener('click', async () => {
  for (const text of Object.values(DAYS)) {
    const r = parseDay(text);
    if (!r.errors.length) await store.putCards(r.cards);
  }
  await refresh();
});
preview();
refresh();
