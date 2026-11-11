// 하루치(DAY) 텍스트를 카드 배열로 바꾸는 순수 함수. DOM·저장소와 무관.
//
// 입력 형식 (한 줄이 카드 한 장, 구분자 '|'):
//   # DAY 9
//   [연결사]
//   on account of | ~때문에
//   [속담]
//   Look before you leap. | 돌다리도 두드려 보고 건너라
//   [어원 super-(sur-) 위에, 넘어서]
//   sur/round | 위에/둥글게 돌다 | 동 | 둘러싸다, 에워싸다
//   [접미사 +al]
//   accident > accidental | 사고, 우연 > 우연한

const POS = { 동: '동사', 명: '명사', 형: '형용사', 부: '부사', 전: '전치사', 접: '접속사' };
const TYPES = [
  ['connective', /^연결사/],
  ['mood', /^심경/],
  ['proverb', /^속담/],
  ['root', /^어원/],
  ['suffix', /^접미사/],
];

export function normPos(s) {
  return s.split(/[,，]/).map((p) => p.trim()).filter(Boolean)
    .map((p) => POS[p] ?? p).join(', ');
}

export function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function parseDay(text) {
  const cards = [];
  const errors = [];
  const warnings = [];
  let day = null;
  let type = null;
  let group = '';
  const seen = new Set();

  const push = (card, ln) => {
    let id = `d${day}-${card.type}-${slug(card.front)}`;
    if (seen.has(id)) { warnings.push({ line: ln, msg: `중복 카드: ${card.front}` }); return; }
    seen.add(id);
    cards.push({ id, day, order: cards.length, ...card });
  };

  text.split(/\r?\n/).forEach((raw, i) => {
    const ln = i + 1;
    const line = raw.trim();
    if (!line) return;

    const dm = line.match(/^#\s*DAY\s*(\d+)/i);
    if (dm) { day = Number(dm[1]); return; }

    const sm = line.match(/^\[(.+)\]$/);
    if (sm) {
      const head = sm[1].trim();
      const t = TYPES.find(([, re]) => re.test(head));
      if (!t) { errors.push({ line: ln, msg: `알 수 없는 구역: ${head}` }); type = null; return; }
      type = t[0];
      group = head.replace(t[1], '').trim();
      return;
    }

    if (day === null) { errors.push({ line: ln, msg: '# DAY n 줄이 먼저 필요합니다' }); return; }
    if (!type) { errors.push({ line: ln, msg: '[구역] 줄이 먼저 필요합니다' }); return; }

    const parts = line.split('|').map((p) => p.trim());

    if (type === 'connective' || type === 'proverb' || type === 'mood') {
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        errors.push({ line: ln, msg: '형식: 영어 | 뜻' }); return;
      }
      push({ type, front: parts[0], back: parts[1], group }, ln);
      return;
    }

    if (type === 'root') {
      if (parts.length !== 4 || parts.some((p) => !p)) {
        errors.push({ line: ln, msg: '형식: 어원/분해 | 분해 뜻 | 품사 | 뜻' }); return;
      }
      const morphs = parts[0].split('/').map((m) => m.trim());
      const gloss = parts[1].split('/').map((m) => m.trim());
      const front = morphs.join('');
      if (morphs.length !== gloss.length) {
        warnings.push({ line: ln, msg: `조각 수(${morphs.length})와 조각 뜻 수(${gloss.length})가 다름: ${parts[0]}` });
      }
      push({ type, front, morphs, morphGloss: parts[1], pos: normPos(parts[2]), back: parts[3], group }, ln);
      return;
    }

    if (type === 'suffix') {
      const w = (parts[0] ?? '').split('>').map((p) => p.trim());
      const m = (parts[1] ?? '').split('>').map((p) => p.trim());
      if (parts.length !== 2 || w.length !== 2 || m.length !== 2 || [...w, ...m].some((p) => !p)) {
        errors.push({ line: ln, msg: '형식: 기본어 > 파생어 | 기본 뜻 > 파생 뜻' }); return;
      }
      push({ type, front: w[1], base: w[0], baseBack: m[0], back: m[1], suffix: group, group }, ln);
    }
  });

  if (day === null && !errors.length) errors.push({ line: 0, msg: '# DAY n 줄이 없습니다' });
  return { day, cards, errors, warnings };
}
