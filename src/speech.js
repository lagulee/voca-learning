// 발음 재생(브라우저 내장 음성 합성, 무료·오프라인 가능 여부는 기기에 따름).
export const canSpeak = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';

export function speakText(card) { return card.front.replace(/\(s\)/g, 's'); }

export function speak(card) {
  if (!canSpeak()) return false;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(speakText(card));
    u.lang = 'en-US'; u.rate = 0.9;
    speechSynthesis.speak(u);
    return true;
  } catch { return false; }   // 음성 엔진 오류가 학습 흐름을 막지 않게 한다
}
