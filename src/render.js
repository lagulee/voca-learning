// 카드 표시용 HTML 조각. DOM에 직접 접근하지 않는다.
export const TYPE_LABEL = { connective: '연결사', mood: '심경', proverb: '속담', root: '어원', suffix: '접미사' };

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function morphHtml(c) {
  return c.morphs.map((m, i) => `<span class="m m${i % 3}">${esc(m)}</span>`).join('<i>/</i>');
}

export function frontHtml(c) { return c.type === 'root' ? morphHtml(c) : esc(c.front); }

export function cardRow(c) {
  const sub = c.type === 'root' ? `<small>${esc(c.morphGloss)} · ${esc(c.pos)}</small>`
    : c.type === 'suffix' ? `<small>${esc(c.base)} (${esc(c.baseBack)}) ${esc(c.suffix)}</small>` : '';
  return `<li><b class="tag">${TYPE_LABEL[c.type]}</b><div class="f">${frontHtml(c)}${sub}</div><div class="b">${esc(c.back)}</div></li>`;
}

// 정답 공개: 영어 + (어원이면) 분해와 뜻
export function answerHtml(c) {
  const extra = c.type === 'root' ? `<small>${esc(c.morphGloss)} · ${esc(c.pos)}</small>`
    : c.type === 'suffix' ? `<small>${esc(c.base)} (${esc(c.baseBack)}) ${esc(c.suffix)}</small>` : '';
  return `<div class="big">${frontHtml(c)}</div>${extra}<div class="ko">${esc(c.back)}</div>`;
}

export function clozeHtml(cloze, values = [], marks = null) {
  let bi = 0;
  return cloze.tokens.map((t) => {
    if (!t.blank) return esc(t.pre + t.text + t.post);
    const i = bi++;
    const cls = marks ? (marks[i] ? 'ok' : 'ng') : '';
    const val = marks ? esc(values[i] ?? '') : '';
    const body = marks
      ? `<span class="${cls}">${esc(t.text)}</span>`
      : `<input class="blank" data-i="${i}" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" size="${t.text.length + 1}">`;
    return `${esc(t.pre)}${body}${esc(t.post)}${marks && !marks[i] && val ? `<small class="ng"> (${val})</small>` : ''}`;
  }).join(' ');
}
