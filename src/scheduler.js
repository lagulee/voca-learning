// 간격 반복 스케줄러(SM-2 변형). 순수 함수만 둔다: 시간(now)은 인자로 받는다.
// 평가(grade): 0 = 몰랐다, 1 = 헷갈렸다(힌트를 썼거나 애매), 2 = 알았다.

export const SCHED = {
  EF0: 2.5, EF_MIN: 1.3, EF_MAX: 2.8,
  STEPS: [1, 3, 7, 16], // 연속 성공 횟수별 간격(일). 그 뒤는 간격 × EF
  REVIEW_CAP: 30,        // 하루 복습 상한(시간 절약)
};

export function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function addDays(ts, n) { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); }

export function newState(id, now) {
  return { id, ef: SCHED.EF0, interval: 0, reps: 0, lapses: 0, due: startOfDay(now), lastReview: null, weak: false };
}

// examDay: 시험 날짜(자정 ms). 있으면 복습 예정일이 시험 전날을 넘지 않게 당긴다(벼락치기 모드).
export function review(state, grade, now, { examDay = null } = {}) {
  const s = { ...state };
  if (grade === 0) {
    s.lapses += 1; s.reps = 0; s.interval = 1;
    s.ef = Math.max(SCHED.EF_MIN, s.ef - 0.2); s.weak = true;
  } else if (grade === 1) {
    s.interval = Math.max(1, Math.round(s.interval * 1.2));
    s.ef = Math.max(SCHED.EF_MIN, s.ef - 0.15);
  } else {
    s.reps += 1;
    const prev = s.interval;
    s.interval = s.reps <= SCHED.STEPS.length
      ? Math.max(prev, SCHED.STEPS[s.reps - 1])
      : Math.max(prev + 1, Math.round(prev * s.ef));
    s.ef = Math.min(SCHED.EF_MAX, s.ef + 0.05);
    if (s.reps >= 2) s.weak = false;
  }
  const today = startOfDay(now);
  let due = addDays(today, s.interval);
  if (examDay != null) {
    const eve = addDays(examDay, -1);
    if (due > eve) due = Math.max(eve, today);
  }
  s.due = due;
  s.lastReview = now;
  return s;
}

// 오늘 안에 복습할 카드: 취약 → 오래 밀린 순
export function dueCards(states, now, cap = SCHED.REVIEW_CAP) {
  const end = addDays(startOfDay(now), 1);
  return states
    .filter((s) => s.due < end && s.lastReview != null)
    .sort((a, b) => Number(b.weak) - Number(a.weak) || a.due - b.due || b.lapses - a.lapses)
    .slice(0, cap);
}
