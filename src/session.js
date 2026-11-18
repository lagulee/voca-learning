// 한 단계(떠올리기·스펠링·시험·복습)를 돌리는 큐 엔진. 순수 함수·상태 객체.
// grade: 0 몰랐다 → 3장 뒤 다시(맞힐 때까지) / 1 헷갈렸다 → 6장 뒤 한 번 더 / 2 알았다 → 끝.
// 첫 시도의 평가만 results()에 남아 스케줄러에 쓰인다.
// rounds 모드(떠올리기): 몰랐다·헷갈렸다는 뒤로 미뤄 두었다가 한 바퀴가 끝나면 그 카드들만 모아 다시 돌린다(클래스카드 방식).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, seed) {
  const rnd = mulberry32(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createRun(items, { gap0 = 3, gap1 = 6, rounds = false } = {}, snap = null) {
  rounds = snap ? !!snap.rounds : rounds;
  const retry = snap?.retry ? snap.retry.map((id) => { const x = new Map(items.map((i) => [i.id, i])).get(id); if (!x) throw new Error('unknown item'); return x; }) : [];
  const byId = new Map(items.map((x) => [x.id, x]));
  const queue = snap ? snap.queue.map((id) => { const x = byId.get(id); if (!x) throw new Error('unknown item'); return x; }) : [...items];
  const first = new Map(snap?.first ?? []);
  const tries = new Map(snap?.tries ?? []);
  return {
    current: () => queue[0] ?? null,
    done: () => queue.length === 0 && retry.length === 0,
    submit(grade) {
      const it = queue.shift();
      const n = tries.get(it.id) ?? 0;
      tries.set(it.id, n + 1);
      if (!first.has(it.id)) first.set(it.id, grade);
      if (rounds) {
        if (grade !== 2) retry.push(it);
        if (queue.length === 0 && retry.length) queue.push(...retry.splice(0));
      } else if (grade === 0 || (grade === 1 && n === 0)) {
        queue.splice(Math.min(grade === 0 ? gap0 : gap1, queue.length), 0, it);
      }
      return it;
    },
    progress() {
      const left = new Set([...queue, ...retry].map((x) => x.id)).size;
      return { total: items.length, left, finished: items.length - left };
    },
    results: () => new Map(first),
    snapshot: () => ({ rounds, retry: retry.map((x) => x.id), queue: queue.map((x) => x.id), first: [...first], tries: [...tries] }),
    attempts: (id) => tries.get(id) ?? 0,
  };
}
