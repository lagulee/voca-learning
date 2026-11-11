// 통계 계산(순수 함수): 카드·학습 상태·로그 → 화면용 숫자.
import { startOfDay, addDays } from './scheduler.js';

export function computeStats(cards, states, logs, now) {
  const st = new Map(states.map((s) => [s.id, s]));
  const learned = cards.filter((c) => st.has(c.id));
  const mature = learned.filter((c) => st.get(c.id).interval >= 7);
  const weak = learned.filter((c) => st.get(c.id).weak);

  const days = [...new Set(cards.map((c) => c.day))].sort((a, b) => a - b).map((day) => {
    const all = cards.filter((c) => c.day === day);
    const l = all.filter((c) => st.has(c.id));
    return { day, cards: all.length, learned: l.length, mature: l.filter((c) => st.get(c.id).interval >= 7).length, weak: l.filter((c) => st.get(c.id).weak).length };
  });

  // 틀린 횟수가 많은 어원·접미사 묶음
  const byGroup = new Map();
  for (const c of learned) {
    const key = c.group || TYPE_FALLBACK[c.type];
    const g = byGroup.get(key) ?? { group: key, n: 0, lapses: 0 };
    g.n += 1; g.lapses += st.get(c.id).lapses;
    byGroup.set(key, g);
  }
  const groups = [...byGroup.values()].filter((g) => g.n >= 2 && g.lapses > 0)
    .map((g) => ({ ...g, rate: g.lapses / g.n })).sort((a, b) => b.rate - a.rate).slice(0, 5);

  // 연속 학습일: 오늘(없으면 어제)부터 거꾸로
  const dayKeys = new Set(logs.map((l) => startOfDay(l.at)));
  let cursor = startOfDay(now);
  if (!dayKeys.has(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (dayKeys.has(cursor)) { streak += 1; cursor = addDays(cursor, -1); }

  // 최근 7일 학습 분
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(startOfDay(now), -i);
    const ms = logs.filter((l) => startOfDay(l.at) === d).reduce((a, l) => a + l.ms, 0);
    week.push({ date: d, minutes: Math.round(ms / 60000) });
  }

  const recent = [...logs].sort((a, b) => b.at - a.at).slice(0, 8);
  return { total: cards.length, learned: learned.length, mature: mature.length, weak: weak.length, days, groups, streak, week, recent };
}

const TYPE_FALLBACK = { connective: '연결사', mood: '심경 어휘', proverb: '속담', root: '어원', suffix: '접미사' };

// 오답 노트: 취약 표시 또는 틀린 적 있는 카드, 많이 틀린 순
export function weakList(cards, states, cap = 20) {
  const st = new Map(states.map((s) => [s.id, s]));
  return cards.filter((c) => st.has(c.id) && (st.get(c.id).weak || st.get(c.id).lapses > 0))
    .sort((a, b) => Number(st.get(b.id).weak) - Number(st.get(a.id).weak) || st.get(b.id).lapses - st.get(a.id).lapses)
    .slice(0, cap);
}
