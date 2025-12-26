# 법률 업데이트 모니터링 시스템 - 설정 가이드

매일 아침 한국의 주요 법률 개정사항을 자동 모니터링하고 이메일로 브리핑을 발송하는 시스템입니다.

## 📋 사전 준비사항

### 1. API 키 발급

#### 국가법령정보센터 (law.go.kr)
1. [법제처 공동활용 신청](https://www.law.go.kr/DRF/openApiServlet) 접속
2. 회원가입 후 Open API 활용 신청
3. 승인까지 1-2일 소요
4. **OC 코드**: 회원가입 시 사용한 이메일의 @ 앞부분 (예: `myemail@gmail.com` → `myemail`)

#### 열린국회정보 (open.assembly.go.kr)
1. [열린국회정보](https://open.assembly.go.kr) 접속
2. 회원가입 → 마이페이지 → 인증키 발급
3. 발급된 API 키 저장

#### SendGrid (이메일 발송)
1. [SendGrid](https://sendgrid.com) 가입 (무료 플랜: 월 100건)
2. Settings → API Keys → Create API Key
3. Full Access 권한으로 생성

#### Google Sheets (선택사항)
1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 프로젝트 생성 → API 및 서비스 → Google Sheets API 활성화
3. 서비스 계정 생성 → 키(JSON) 다운로드
4. 스프레드시트 생성 후 서비스 계정 이메일에 편집 권한 부여

---

## 🚀 설치 및 실행

### 로컬 테스트

```bash
# 프로젝트 폴더로 이동
cd legal-update-monitor

# 의존성 설치
npm install

# 환경변수 설정
copy .env.example .env
# .env 파일을 열어서 API 키 입력

# 테스트 실행
npm run test:collectors
```

### Netlify 배포

```bash
# Netlify CLI 설치
npm install -g netlify-cli

# Netlify 로그인
netlify login

# 새 사이트 생성 및 배포
netlify init
netlify deploy --prod
```

### Netlify 환경변수 설정

Netlify 대시보드 → Site settings → Environment variables:

| 변수명 | 값 |
|--------|-----|
| `LAW_GO_KR_OC` | 법제처 API OC 코드 |
| `ASSEMBLY_API_KEY` | 열린국회정보 API 키 |
| `SENDGRID_API_KEY` | SendGrid API 키 |
| `EMAIL_FROM` | 발신 이메일 주소 |
| `EMAIL_RECIPIENTS` | 수신자 이메일 (쉼표로 구분) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | 서비스 계정 이메일 |
| `GOOGLE_PRIVATE_KEY` | 서비스 계정 개인 키 |
| `GOOGLE_SHEET_ID` | 구글 시트 ID |

---

## 📁 프로젝트 구조

```
legal-update-monitor/
├── netlify/
│   └── functions/
│       └── daily-brief.js    # 스케줄된 함수 (매일 09:00 KST)
├── src/
│   ├── collectors/           # 데이터 수집기
│   │   ├── index.js          # 수집기 통합
│   │   ├── law-go-kr.js      # 국가법령정보센터
│   │   ├── assembly.js       # 열린국회정보
│   │   ├── moel.js           # 고용노동부
│   │   ├── pipc.js           # 개인정보보호위
│   │   ├── msit.js           # 과기정통부
│   │   ├── fsc.js            # 금융위
│   │   └── ftc.js            # 공정위
│   ├── services/
│   │   ├── email.js          # 이메일 발송
│   │   ├── sheets.js         # Google Sheets
│   │   └── formatter.js      # 브리핑 포맷
│   ├── config/
│   │   └── laws.js           # 관리 대상 법률
│   └── test-collectors.js    # 로컬 테스트
├── public/
│   └── index.html            # 랜딩 페이지
├── netlify.toml
├── package.json
└── .env.example
```

---

## 🧪 테스트

### 로컬 테스트
```bash
npm run test:collectors
```
결과는 `test-output/` 폴더에 HTML, TXT, JSON 형식으로 저장됩니다.

### 수동 실행 (Netlify 배포 후)
브라우저에서 `https://your-site.netlify.app/api/daily-brief?test=true` 접속

---

## ⏰ 스케줄

- **실행 시간**: 매일 00:00 UTC = **09:00 KST**
- **설정 위치**: `netlify.toml` 및 `netlify/functions/daily-brief.js`

---

## 🔧 커스터마이징

### 관리 대상 법률 수정
`src/config/laws.js`의 `TARGET_LAWS` 배열 수정

### 이메일 템플릿 수정
`src/services/formatter.js`의 `generateHtmlBriefing()` 함수 수정

### 수집 주기 변경
`netlify.toml`의 `schedule` 값 수정 (Cron 표현식)
