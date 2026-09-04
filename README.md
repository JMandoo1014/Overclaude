# Overclaude

claude.ai Pro/Max 개인 구독자의 사용량(5시간 세션 / 7일 주간)을 macOS 메뉴바에서
실시간으로 보여주는 Electron 앱입니다.

## 실행법

```bash
npm install
npm start
```

최초 실행 시 로그인 창이 뜹니다. `claude.ai`에 로그인하면 창이 자동으로 닫히고,
메뉴바에 게이지 모양 아이콘이 나타납니다.

## 사용법 (좌클릭 / 우클릭)

- **아이콘 자체** — 텍스트 없이, 5시간 사용률만큼 채워지는 원형 게이지입니다.
  - 50% 미만: 초록 / 50~79%: 주황 / 80% 이상: 빨강
  - 로딩 중(최초 1회): 회색 점선 링
  - 로그인 필요 / 오류: 깨진 링 + 느낌표 모양
  - 아이콘에 마우스를 올리면(hover) 툴팁으로 요약 수치가 뜹니다.
- **좌클릭** — 화면 모서리의 사용량 오버레이 패널을 열고/닫습니다 (토글).
- **우클릭** — 새로고침 / 재로그인 / 패널 위치 변경 / 종료 메뉴를 띄웁니다.

## 동작 방식

- `main.js` — Electron 메인 프로세스. Tray 아이콘 갱신, 60초 폴링, 좌/우클릭 핸들러,
  오버레이 연동을 담당합니다. (더 이상 `tray.setTitle()`로 텍스트를 붙이지 않습니다.)
- `src/icon.js` — `@napi-rs/canvas`로 매 폴링마다 원형 게이지 PNG를 런타임에 그려
  `nativeImage.createFromBuffer()`로 트레이 아이콘을 교체합니다. 정적 이미지를 미리
  만들어두지 않습니다.
- `src/overlay.js` + `renderer/overlay.html` — 화면 모서리에 뜨는 작은 사용량 HUD
  패널입니다. `frame:false / transparent:true / alwaysOnTop:true / focusable:false`
  로 구성해 클릭해도 다른 앱의 포커스를 뺏지 않습니다. macOS
  `vibrancy: 'popover'`로 반투명 블러 배경을 쓰며, 라이트/다크 모드에 따라 자동으로
  전환됩니다 (`vibrancy: 'hud'`는 시스템 설정과 무관하게 항상 어두운 패널이라 이
  용도에는 맞지 않아 `'popover'`를 사용했습니다).
- `src/login.js` — 별도 세션 파티션(`persist:overclaude`)의 `BrowserWindow`로 로그인 페이지를
  띄우고, 로그인 완료(비로그인/가입/oauth 경로가 아닌 `claude.ai` URL로 이동)를 감지해
  세션 쿠키를 수집합니다.
- `src/store.js` — Electron `safeStorage`(macOS 키체인 기반)로 쿠키를 암호화해
  `app.getPath('userData')` 아래에만 저장합니다. 조직 uuid, 오버레이 패널 위치/표시
  여부도 이 모듈에서 관리합니다.
- `src/api.js` — 조직 목록과 사용량을 조회합니다. 401/403 응답은 `ApiError('AUTH_EXPIRED')`로
  구분해서 던지고, 그 외 응답 필드는 전부 optional chaining으로 방어적으로 읽습니다.

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

## 트레이 아이콘 & 오버레이 패널

- 아이콘은 5시간 사용률에 따라 12시 방향에서 시계방향으로 채워지는 원형 게이지입니다.
  - 50% 미만: 초록 (`src/icon.js`의 `COLOR_LOW`)
  - 50~79%: 주황 (`COLOR_MID`)
  - 80% 이상: 빨강 (`COLOR_HIGH`)
  - 로딩(최초 1회): 회색 점선 링 (`renderLoadingIcon`)
  - 로그인 필요 / 오류: 깨진 링 + 느낌표 (`renderErrorIcon`)
  - 색 임계치를 바꾸려면 `src/icon.js`의 `colorForPercent()`를 수정하세요.
- 좌클릭으로 여는 오버레이 패널에 5시간/주간 사용률 바(bar)와 리셋까지 남은 시간이
  표시됩니다. 우클릭 메뉴의 "패널 위치"에서 왼쪽 상단/오른쪽 상단을 전환할 수 있고,
  선택한 위치와 패널 표시 여부는 `overclaude-settings.json`에 저장되어 재실행 후에도
  유지됩니다 (`~/Library/Application Support/overclaude/overclaude-settings.json`,
  `src/store.js`의 `savePanelPosition`/`savePanelVisible`).
- 우클릭 메뉴는 지금 새로고침 / 재로그인 / 패널 위치 / 종료, 즉 순수 액션만 담고
  있습니다 — 사용량 숫자는 오버레이 패널이 보여줍니다.

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
