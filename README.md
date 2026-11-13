# Overclaude

![Electron](https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white)
![License](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)

> claude.ai 사용량을 macOS 메뉴바에 게이지로 띄워주는 앱

⚠️ 비공식 프로젝트입니다. Anthropic과 관계없고, claude.ai 웹이 내부적으로 쓰는 문서화되지 않은 API를 호출합니다. 언제든 갑자기 안 될 수 있습니다.

## 배경

Claude를 쓰다 보면 사용량 한도에 걸릴 때가 있는데, 얼마나 남았는지 보려면 매번 설정 페이지에 들어가야 했습니다. 작업하다가 메뉴바만 보면 알 수 있게 만들었습니다.

## 주요 기능

- 메뉴바 아이콘이 5시간 사용률만큼 채워지는 원형 게이지 (50% 미만 초록, 80% 이상 빨강)
- 아이콘을 클릭하면 5시간 / 주간 사용률과 리셋까지 남은 시간을 보여주는 패널
- 우클릭 메뉴: 새로고침, 재로그인, 패널 위치 변경, 종료
- 60초마다 자동 갱신, 라이트/다크 모드 대응

로그인 쿠키는 macOS 키체인으로 암호화해서 내 컴퓨터에만 저장하고, claude.ai 말고는 어디에도 보내지 않습니다.

## 설치

```bash
git clone https://github.com/JMandoo1014/Overclaude.git
cd Overclaude
npm install
```

## 사용법

```bash
npm start        # 처음 실행하면 claude.ai 로그인 창이 뜨고, 로그인하면 자동으로 닫힘
npm run build    # .dmg 만들기
```

claude.ai 쪽 응답 형식이 바뀌어서 사용량이 `--%`로 나올 때 확인하는 방법은 [docs/schema-change.md](docs/schema-change.md)에 적어뒀습니다.

## 라이선스

[GPL-3.0](LICENSE)
