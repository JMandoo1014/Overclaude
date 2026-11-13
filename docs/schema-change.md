# 응답 스키마가 바뀌었을 때 확인/수정 방법

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
