# Overclaude

claude.ai Pro/Max 개인 구독자의 사용량(5시간 세션 / 7일 주간)을 macOS 메뉴바에서
실시간으로 보여주는 Electron 앱입니다.

## 실행법

```bash
npm install
npm start
```

최초 실행 시 로그인 창이 뜹니다. `claude.ai`에 로그인하면 창이 자동으로 닫히고,
메뉴바에 사용률 아이콘이 나타납니다.

## 동작 방식

- `main.js` — Electron 메인 프로세스. Tray/Menu 생성, 60초 폴링, 에러 상태 반영을 담당합니다.
- `src/login.js` — 별도 세션 파티션(`persist:overclaude`)의 `BrowserWindow`로 로그인 페이지를
  띄우고, 로그인 완료(비로그인/가입/oauth 경로가 아닌 `claude.ai` URL로 이동)를 감지해
  세션 쿠키를 수집합니다.
- `src/store.js` — Electron `safeStorage`(macOS 키체인 기반)로 쿠키를 암호화해
  `app.getPath('userData')` 아래에만 저장합니다. 조직 uuid 캐시도 이 모듈에서 관리합니다.
- `src/api.js` — 조직 목록과 사용량을 조회합니다. 401/403 응답은 `ApiError('AUTH_EXPIRED')`로
  구분해서 던지고, 그 외 응답 필드는 전부 optional chaining으로 방어적으로 읽습니다.
- `assets/trayTemplate.png`, `assets/trayTemplate@2x.png` — macOS 템플릿 이미지 규칙을
  따르는 단색(검정+알파) 트레이 아이콘입니다.

## ⚠️ 중요: 비공식 API 사용에 대한 주의사항

이 앱은 claude.ai의 **공식적으로 문서화되지 않은 내부 API**를 사용합니다:

- `GET https://claude.ai/api/organizations`
- `GET https://claude.ai/api/organizations/{uuid}/usage`

Anthropic이 언제든 이 엔드포인트의 경로, 인증 방식, 응답 스키마를 예고 없이 바꾸거나
제거할 수 있습니다. 이 앱은 그런 상황에서도 크래시하지 않도록 방어적으로 파싱하지만,
**응답 필드가 실제로 달라지면 사용률 값이 `--%`(알 수 없음)로 표시될 수 있습니다.**
이 경우 아래 "응답 스키마가 바뀌었을 때" 항목을 참고해 직접 확인하고 고쳐주세요.

## 🔒 보안 주의사항

- claude.ai 로그인 세션 쿠키는 **비밀번호와 동급으로 민감한 정보**입니다. 이 쿠키가
  유출되면 계정에 로그인된 것과 동일한 권한으로 접근이 가능합니다.
- 이 앱은 쿠키를 절대 평문으로 저장하거나 외부로 전송하지 않습니다. Electron의
  `safeStorage`(macOS Keychain 기반 암호화)로 암호화한 뒤, 로컬 사용자 데이터
  디렉터리(`app.getPath('userData')`, 예: `~/Library/Application Support/overclaude/`)에만
  저장합니다.
- 소스코드를 직접 검토해서, 쿠키가 `claude.ai` 및 자체 저장 로직 외의 어떤 곳으로도
  전송되지 않는다는 것을 확인하는 것을 권장합니다 (`src/api.js`의 요청 대상은
  `https://claude.ai/...`뿐입니다).
- "재로그인" 메뉴를 누르면 기존 쿠키를 지우고 새 로그인 창을 띄웁니다. 컴퓨터를
  공유하는 환경이라면 사용 후 `~/Library/Application Support/overclaude/` 안의
  암호화된 세션 파일을 삭제해 로그아웃 상태로 되돌릴 수 있습니다.

## 트레이 표시 규칙

- 타이틀: `🟢/🟠/🔴 + 5시간 사용률%`
  - 50% 미만: 🟢
  - 50~80%: 🟠
  - 80% 이상: 🔴
  - 오류 상태: ⚠️
- 드롭다운 메뉴: 5시간/주간 사용률, 각 리셋 시각, 지금 새로고침, 재로그인, 종료

## 응답 스키마가 바뀌었을 때 확인/수정 방법

`/api/organizations/{uuid}/usage`는 비공식 API라 필드명이 바뀔 수 있습니다. 실제 응답
구조를 확인하려면:

1. `main.js`의 `refreshUsage()`에서 `fetchUsage` 호출 부분에 임시로
   `console.log(JSON.stringify(usage.raw, null, 2))`를 추가합니다
   (`src/api.js`의 `fetchUsage`는 이미 파싱 전 원본 응답을 `raw` 필드로 반환합니다).
2. `npm start`로 실행하면 터미널(개발자 콘솔)에 실제 응답 JSON이 출력됩니다.
3. 실제 필드명(예: `five_hour` 대신 다른 이름, `utilization` 대신 다른 이름 등)을 확인한 뒤,
   `src/api.js`의 `fetchUsage` 함수 안에서 `data?.five_hour?.utilization`,
   `data?.five_hour?.resets_at`, `data?.seven_day?.utilization`,
   `data?.seven_day?.resets_at` 경로를 새 필드명에 맞게 수정합니다.
4. `utilization` 값이 `0~1` 사이 소수인지 `0~100` 사이 정수인지도 확인하세요.
   `main.js`의 `formatPercent()`가 `utilization <= 1`이면 `*100`을 하는 방식으로
   두 형태를 모두 방어적으로 처리하지만, 실제 값 범위가 다르면 이 로직도 함께 조정이
   필요할 수 있습니다.
5. 디버그용 `console.log`는 확인 후 다시 제거하세요.

## 폴링 주기

기본 60초(`main.js`의 `POLL_INTERVAL_MS`)입니다. 값을 줄이면 그만큼 비공식 API를
더 자주 호출하게 되므로, 60초보다 짧게 설정하는 것은 권장하지 않습니다.
