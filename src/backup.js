// 기록 백업: 만들기·검증(순수 함수) + 파일 내려받기(브라우저 전용).
const CARD_TYPES = new Set(['connective', 'mood', 'proverb', 'root', 'suffix']);

export function makeBackup({ cards, states, logs, examDay = null }, now) {
  return { app: 'vocab-app', version: 1, exportedAt: now, cards, states, logs, settings: { examDay } };
}

export function validateBackup(d) {
  const bad = (error) => ({ ok: false, error });
  if (!d || d.app !== 'vocab-app') return bad('이 앱의 백업 파일이 아닙니다.');
  if (d.version !== 1) return bad('지원하지 않는 백업 버전입니다.');
  if (!Array.isArray(d.cards) || !Array.isArray(d.states) || !Array.isArray(d.logs)) return bad('백업 형식이 올바르지 않습니다.');
  for (const c of d.cards) {
    if (typeof c?.id !== 'string' || !Number.isInteger(c.day) || !CARD_TYPES.has(c.type)
      || typeof c.front !== 'string' || typeof c.back !== 'string') return bad(`카드 형식 오류: ${c?.id ?? '?'}`);
  }
  const ids = new Set(d.cards.map((c) => c.id));
  for (const s of d.states) {
    if (typeof s?.id !== 'string' || !Number.isFinite(s.due) || !Number.isFinite(s.interval)) return bad(`학습 상태 형식 오류: ${s?.id ?? '?'}`);
    if (!ids.has(s.id)) return bad(`카드가 없는 학습 상태: ${s.id}`);
  }
  for (const l of d.logs) if (!Number.isFinite(l?.at) || !Number.isFinite(l?.ms)) return bad('학습 기록 형식 오류');
  return { ok: true, counts: { cards: d.cards.length, states: d.states.length, logs: d.logs.length } };
}

// 앱(Capacitor) 안에서는 <a download>가 동작하지 않아 파일로 쓴 뒤 공유 시트를 연다.
export async function downloadJson(obj, filename) {
  const cap = typeof window !== 'undefined' ? window.Capacitor : null;
  if (cap?.isNativePlatform?.()) {
    const { Filesystem, Share } = cap.Plugins;
    const w = await Filesystem.writeFile({ path: filename, data: JSON.stringify(obj), directory: 'CACHE', encoding: 'utf8' });
    await Share.share({ title: filename, url: w.uri });
    return;
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
