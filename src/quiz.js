// 어원 조각 문제(4지선다)와 접미사 규칙 문제를 만드는 순수 함수.
import { shuffle } from './session.js';
import { hash } from './answer.js';

const parts = (s) => s.split('/').map((x) => x.trim());

// 모든 어원 카드에서 "조각 → 뜻" 사전을 만든다. 조각 수와 뜻 수가 맞는 카드만 쓴다.
// consistent = 모든 카드에서 같은 뜻으로 쓰인 조각(문제로 내도 정답이 하나로 정해짐).
export function buildMorphDict(cards) {
  const tally = new Map();
  for (const c of cards) {
    if (c.type !== 'root') continue;
    const g = parts(c.morphGloss);
    if (g.length !== c.morphs.length) continue;
    c.morphs.forEach((m, i) => {
      const k = m.toLowerCase();
      const t = tally.get(k) ?? new Map();
      t.set(g[i], (t.get(g[i]) ?? 0) + 1);
      tally.set(k, t);
    });
  }
  const dict = new Map();
  for (const [m, t] of tally) {
    const [gloss] = [...t.entries()].sort((a, b) => b[1] - a[1])[0];
    dict.set(m, { gloss, count: [...t.values()].reduce((a, b) => a + b, 0), consistent: t.size === 1 });
  }
  return dict;
}

function pick(correct, pool, seed, n = 3) {
  const others = [...new Set(pool.filter((x) => x && x !== correct))];
  if (others.length < n) return null;
  const options = shuffle([correct, ...shuffle(others, seed).slice(0, n)], seed + 1);
  return { options, answer: options.indexOf(correct) };
}

function morphQuestion(card, dict, seed) {
  const g = parts(card.morphGloss);
  if (g.length !== card.morphs.length) return null;
  const idx = card.morphs.map((m, i) => i).filter((i) => { const e = dict.get(card.morphs[i].toLowerCase()); return e && e.count >= 2 && e.consistent; });
  if (!idx.length) return null;
  const i = idx[hash(card.id) % idx.length];
  const m = card.morphs[i];
  const correct = dict.get(m.toLowerCase()).gloss;
  const d = pick(correct, [...dict.values()].filter((v) => v.consistent).map((v) => v.gloss), seed);
  if (!d) return null;
  return { id: `q-morph-${card.id}`, kind: 'morph', cardId: card.id, word: card.morphs.join('/'), piece: m, ...d };
}

function inferQuestion(card, allRoots, seed) {
  const same = allRoots.filter((c) => c.pos === card.pos).map((c) => c.back);
  const d = pick(card.back, same.length >= 4 ? same : allRoots.map((c) => c.back), seed);
  if (!d) return null;
  return { id: `q-infer-${card.id}`, kind: 'infer', cardId: card.id, word: card.morphs.join('/'), gloss: card.morphGloss, ...d };
}

// 어원 문제 n개: 추론(뜻 맞히기)과 조각 뜻을 번갈아 낸다.
export function makeRootQuestions(dayCards, allCards, n, seed) {
  const roots = dayCards.filter((c) => c.type === 'root');
  const allRoots = allCards.filter((c) => c.type === 'root');
  const dict = buildMorphDict(allCards);
  const out = [];
  for (const c of shuffle(roots, seed)) {
    if (out.length >= n) break;
    const s = seed + out.length * 7;
    const order = out.length % 2 === 0 ? ['infer', 'morph'] : ['morph', 'infer'];
    for (const k of order) {
      const q = k === 'infer' ? inferQuestion(c, allRoots, s) : morphQuestion(c, dict, s);
      if (q) { out.push(q); break; }
    }
  }
  return out;
}

// 접미사 규칙 문제 n개: 접미사 종류(+al, +ive/ative …)마다 하나씩 먼저 고른다.
export function makeRuleItems(dayCards, n, seed) {
  const suff = shuffle(dayCards.filter((c) => c.type === 'suffix'), seed);
  const seen = new Set();
  const first = [], rest = [];
  for (const c of suff) (seen.has(c.suffix) ? rest : first).push(c) && seen.add(c.suffix);
  return [...first, ...rest].slice(0, n);
}
