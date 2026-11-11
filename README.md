# 단어 암기 앱

영단어를 최소 시간으로 오래 기억하기 위한 학습 앱입니다.
간격 반복(SM-2 변형), 떠올리기·스펠링·모의시험, 어원 조각·접미사 규칙 문제, 오답 노트, 통계, 기록 백업을 지원합니다.

## 안드로이드 APK 받기
1. 이 저장소의 **Actions** 탭 → 가장 최근 `Android APK` 실행 → 맨 아래 **Artifacts**의 `vocab-apk`를 내려받습니다(zip).
2. zip을 풀면 `app-debug.apk`가 나옵니다. 휴대폰에서 열어 설치합니다("알 수 없는 앱 설치" 허용 필요).

## 단어 넣는 법
단어 데이터는 저장소에 들어 있지 않습니다. 앱의 **DAY 입력** 탭에 아래 형식으로 붙여넣거나, **기록 가져오기**로 백업 파일을 불러옵니다.

```
# DAY 9
[연결사]
on account of | ~때문에
[속담]
Look before you leap. | 돌다리도 두드려 보고 건너라
[어원 ex-(e-, ef-, es-) 밖으로]
ex/haust/ed | 밖으로/(물을) 푸다/~된 | 형 | 기진맥진한
[접미사 +al]
accident > accidental | 사고, 우연 > 우연한
```

## 개발
- `npm run build` → `www/index.html` (앱 전체가 파일 하나)
- APK는 Capacitor로 감싸 GitHub Actions에서 빌드합니다(`.github/workflows/android.yml`).
