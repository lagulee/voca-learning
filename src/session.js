// 한 단계(떠올리기·스펠링·시험·복습)를 돌리는 큐 엔진. 순수 함수·상태 객체.
// grade: 0 몰랐다 → 3장 뒤 다시(맞힐 때까지) / 1 헷갈렸다 → 6장 뒤 한 번 더 / 2 알았다 → 끝.
// 첫 시도의 평가만 results()에 남아 스케줄러에 쓰인다.

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

export function createRun(items, { gap0 = 3, gap1 = 6 } = {}) {
  const queue = [...items];
  const first = new Map();
  const tries = new Map();
  return {
    current: () => queue[0] ?? null,
    done: () => queue.length === 0,
    submit(grade) {
      const it = queue.shift();
      const n = tries.get(it.id) ?? 0;
      tries.set(it.id, n + 1);
      if (!first.has(it.id)) first.set(it.id, grade);
      if (grade === 0 || (grade === 1 && n === 0)) {
        queue.splice(Math.min(grade === 0 ? gap0 : gap1, queue.length), 0, it);
      }
      return it;
    },
    progress() {
      const left = new Set(queue.map((x) => x.id)).size;
      return { total: items.length, left, finished: items.length - left };
    },
    results: () => new Map(first),
    attempts: (id) => tries.get(id) ?? 0,
  };
}
