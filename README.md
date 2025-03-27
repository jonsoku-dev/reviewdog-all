# Unified Lint Action

이 GitHub 액션은 ESLint, Stylelint, MarkdownLint, Prettier, Misspell을 reviewdog와 함께 실행하여 코드 품질 검사 및 리뷰를 개선합니다.

## 주요 특징

- 5개의 주요 린트 도구를 한 번에 실행
- 각 린트 도구는 선택적으로 활성화/비활성화 가능
- reviewdog를 통한 GitHub 풀 리퀘스트 리뷰 자동화
- 셀프 호스팅 러너(self-hosted runner) 지원
- 모든 도구는 공식 액션 사용으로 추가 설치 필요 없음

## 사용 방법

`.github/workflows/lint.yml` 파일에 다음과 같이 작성하세요:

```yaml
name: Lint All with Unified Action

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  lint:
    name: Run Unified Lint
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: Check out
        uses: actions/checkout@v3
      - name: Unified Lint
        uses: ./.github/actions/unified-lint-action
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          reporter: github-pr-review
          fail_level: warning
          filter_mode: added
```

## 설치

1. 프로젝트 루트에 `.github/actions/unified-lint-action` 디렉토리를 생성합니다.
2. 이 디렉토리에 `action.yml` 파일을 저장합니다.
3. `.github/workflows` 디렉토리에 워크플로우 파일을 생성합니다.

## 입력 파라미터

### 기본 설정

| 이름 | 설명 | 기본값 |
|------|-------------|---------|
| `github_token` | GitHub 토큰 | `${{ github.token }}` |
| `level` | reviewdog 보고 레벨 [info,warning,error] | `warning` |
| `reporter` | reviewdog 리포터 [github-pr-check,github-check,github-pr-review] | `github-pr-review` |
| `filter_mode` | reviewdog 필터 모드 [added,diff_context,file,nofilter] | `added` |
| `fail_level` | reviewdog 오류 발생 시 실패 기준 [none,any,info,warning,error] | `none` |
| `fail_on_error` | (Deprecated) 오류 발생 시 종료 코드 설정 [true,false] | `false` |
| `reviewdog_flags` | 추가 reviewdog 플래그 | `` |

### 도구 활성화/비활성화

| 이름 | 설명 | 기본값 |
|------|-------------|---------|
| `skip_eslint` | ESLint 검사 생략 | `false` |
| `skip_stylelint` | Stylelint 검사 생략 | `false` |
| `skip_markdownlint` | Markdownlint 검사 생략 | `false` |
| `skip_prettier` | Prettier 검사 생략 | `false` |
| `skip_misspell` | Misspell 검사 생략 | `false` |

### ESLint 옵션

| 이름 | 설명 | 기본값 |
|------|-------------|---------|
| `eslint_flags` | ESLint 명령 플래그 및 인자 | `.` |
| `eslint_workdir` | ESLint 실행할 디렉토리 | `.` |
| `node_options` | NODE_OPTIONS 환경 변수 | `` |

### Stylelint 옵션

| 이름 | 설명 | 기본값 |
|------|-------------|---------|
| `stylelint_input` | Stylelint 입력 파일 또는 glob 패턴 | `**/*.css` |
| `stylelint_config` | Stylelint 설정 파일 경로 | `` |
| `stylelint_workdir` | Stylelint 실행할 디렉토리 | `.` |
| `stylelint_packages` | 추가 NPM 패키지 | `` |

### Markdownlint 옵션

| 이름 | 설명 | 기본값 |
|------|-------------|---------|
| `markdownlint_flags` | Markdownlint CLI 명령 옵션 | `.` |

### Prettier 옵션

| 이름 | 설명 | 기본값 |
|------|-------------|---------|
| `prettier_workdir` | Prettier 작업 디렉토리 | `.` |
| `prettier_flags` | Prettier 플래그 및 인자 | `.` |
| `tool_name` | reviewdog 리포터에 사용할 도구 이름 | `prettier` |

### Misspell 옵션

| 이름 | 설명 | 기본값 |
|------|-------------|---------|
| `misspell_locale` | Misspell 로케일 (US/UK) | `US` |
| `misspell_ignore` | Misspell에서 무시할 단어 목록 | `` |
| `misspell_path` | Misspell 실행할 기본 디렉토리 | `.` |
| `misspell_pattern` | Misspell 대상 파일 패턴 | `*` |
| `misspell_exclude` | Misspell 제외 패턴 | `` |

## 사용 예시

### 기본 사용법

```yaml
- name: Unified Lint
  uses: ./.github/actions/unified-lint-action
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

### 특정 도구만 활성화

```yaml
- name: Unified Lint
  uses: ./.github/actions/unified-lint-action
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    skip_eslint: true
    skip_stylelint: true
    skip_markdownlint: false
    skip_prettier: false
    skip_misspell: false
```

### 도구별 옵션 설정

```yaml
- name: Unified Lint
  uses: ./.github/actions/unified-lint-action
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    eslint_flags: "src/"
    stylelint_input: "**/*.scss"
    markdownlint_flags: "docs/"
    prettier_flags: "*.{js,jsx,css,md}"
    misspell_locale: "UK"
```

## 라이센스

MIT
