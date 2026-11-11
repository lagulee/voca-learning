// 정답 판정·힌트·빈칸(속담) 처리. 순수 함수.

export function normalize(s) {
  return String(s).normalize('NFC').toLowerCase().replace(/[’‘]/g, "'")
    .trim().replace(/[.!?,;]+$/, '').replace(/\s+/g, ' ').trim();
}

// "eastward(s)" → eastward, eastwards 둘 다 허용
export function variants(front) {
  const m = front.match(/^(.*)\(s\)(.*)$/);
  return m ? [m[1] + m[2], m[1] + 's' + m[2]] : [front];
}

// 같은 뜻을 가진 다른 단어(예: 기쁜 = delighted/joyful)도 정답으로 인정한다.
export function acceptable(card, pool = []) {
  const set = new Set(variants(card.front).map(normalize));
  for (const c of pool) {
    if (c.type !== 'proverb' && c.type === card.type && c.back === card.back) {
      variants(c.front).forEach((v) => set.add(normalize(v)));
    }
  }
  return set;
}

export function checkTyped(card, input, pool = []) {
  return { ok: acceptable(card, pool).has(normalize(input)), expected: card.front };
}

export const MAX_HINT = 2;

// 힌트 단계: 1 = 구조 단서, 2 = 더 많은 글자
export function hintFor(card, level) {
  if (level <= 0) return '';
  if (card.type === 'root') {
    return level === 1 ? card.morphGloss
      : card.morphs.map((m) => m[0] + '_'.repeat(m.length - 1)).join('/');
  }
  if (card.type === 'suffix') {
    return level === 1 ? `${card.base} ${card.suffix}`
      : card.front[0] + '_'.repeat(card.front.length - 1);
  }
  const keep = level === 1 ? 1 : 2;
  return card.front.split(' ').map((w) => w.slice(0, keep) + '_'.repeat(Math.max(0, w.length - keep))).join(' ');
}

// 힌트 없이 맞히면 2(알았다), 힌트를 쓰고 맞히면 1(헷갈렸다), 틀리면 0
export function gradeTyped(ok, hints) { return !ok ? 0 : hints > 0 ? 1 : 2; }

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// 속담 빈칸: 긴 단어 위주로 최대 3개를 가린다(카드 id로 고정되어 매번 같은 빈칸).
export function makeCloze(card) {
  const words = card.front.split(' ');
  const core = (w) => w.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '');
  let idx = words.map((w, i) => i).filter((i) => core(words[i]).length >= 4);
  if (idx.length === 0) idx = words.map((w, i) => i).filter((i) => core(words[i]).length >= 3);
  const k = Math.min(3, Math.max(1, Math.round(idx.length / 3)));
  const chosen = new Set(
    idx.map((i) => [hash(card.id + ':' + i), i]).sort((a, b) => a[0] - b[0]).slice(0, k).map((x) => x[1]),
  );
  const tokens = words.map((w, i) => {
    const c = core(w);
    const at = w.indexOf(c);
    return { pre: w.slice(0, at), text: c, post: w.slice(at + c.length), blank: chosen.has(i) };
  });
  return { tokens, blanks: tokens.filter((t) => t.blank).length };
}

export function checkCloze(cloze, inputs) {
  const answers = cloze.tokens.filter((t) => t.blank).map((t) => normalize(t.text));
  const each = answers.map((a, i) => normalize(inputs[i] ?? '') === a);
  return { ok: each.every(Boolean), each };
}
