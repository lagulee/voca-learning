// 학습 세션 저장·복원(순수 함수). 앱을 나가도 같은 자리에서 이어서 할 수 있게 한다.
import { createRun } from './session.js';

const VERSION = 1;

export function serializeSession(sess, now) {
  return {
    v: VERSION, savedAt: now, day: sess.day, pi: sess.pi,
    elapsed: Math.max(0, now - sess.t0), seen: [...sess.seen],
    phases: sess.phases.map((p) => ({
      id: p.id, mode: p.mode ?? null, hints: !!p.hints, updates: !!p.updates,
      items: p.mode === 'mcq' ? p.items : p.items.map((c) => c.id),   // 4지선다는 문제 자체를 저장
      run: p.run ? p.run.snapshot() : null,
    })),
  };
}

// 저장본을 되살린다. 카드가 지워졌거나 형식이 맞지 않으면 null(이어서 하기를 포기).
export function restoreSession(d, cardsById, now) {
  if (!d || d.v !== VERSION || !Array.isArray(d.phases) || !(d.pi >= 0 && d.pi < d.phases.length)) return null;
  const phases = [];
  try {
    for (const sp of d.phases) {
      const items = sp.mode === 'mcq' ? sp.items : sp.items.map((id) => {
        const c = cardsById.get(id);
        if (!c) throw new Error('missing card');
        return c;
      });
      const p = { id: sp.id, mode: sp.mode ?? undefined, hints: sp.hints, updates: sp.updates, items };
      if (sp.run) p.run = createRun(items, {}, sp.run);
      phases.push(p);
    }
  } catch { return null; }
  return {
    day: d.day, phases, pi: d.pi, t0: now - Math.max(0, d.elapsed || 0),
    seen: new Set(d.seen ?? []), done: phases.slice(0, d.pi).filter((p) => p.run), cur: phases[d.pi],
  };
}

// 홈 화면에 보여 줄 요약
export function describeSaved(d) {
  const p = d?.phases?.[d.pi];
  if (!p) return null;
  const total = p.items.length;
  const left = p.run ? new Set(p.run.queue).size : total;
  return { day: d.day, phase: p.id, finished: total - left, total, savedAt: d.savedAt };
}
