# Unified Lint Action

[![Release](https://github.com/jonsoku-dev/unified-lint-action/workflows/Release/badge.svg)](https://github.com/jonsoku-dev/unified-lint-action/releases)
[![Reviewdog](https://github.com/jonsoku-dev/unified-lint-action/workflows/Reviewdog/badge.svg)](https://github.com/jonsoku-dev/unified-lint-action/actions?query=workflow%3AReviewdog)

> 통합 린트 GitHub 액션 (ESLint with Prettier, Stylelint, Markdownlint, Misspell)

[English](./README.en.md) | [日本語](./README.ja.md) | 한국어

## 개요

이 액션은 다음 린트 도구들을 통합하여 실행하고 reviewdog를 통해 결과를 보고합니다:

- ESLint (with Prettier)
- Stylelint
- Markdownlint
- Misspell

## 사용법

```yaml
name: Lint

on: [pull_request]

jobs:
  lint:
    name: Lint Check
    runs-on: ubuntu-latest
    permissions: # PR에 코멘트를 달기 위한 권한
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: jonsoku-dev/unified-lint-action@v1
        with:
          github_token: ${{ secrets.github_token }}
          reporter: github-pr-review
```

## 입력 매개변수

### 기본 설정

| 매개변수 | 설명 | 필수 | 기본값 |
|----------|------|------|---------|
| `github_token` | GitHub 토큰 | ✅ | `${{ github.token }}` |
| `workdir` | 작업 디렉토리 | ❌ | `.` |
| `reporter` | reviewdog 리포터 | ❌ | `github-pr-review` |
| `filter_mode` | reviewdog 필터 모드 (`added`: 변경된 라인만, `diff_context`: 변경된 라인과 주변 컨텍스트, `file`: 수정된 파일 전체, `nofilter`: 모든 파일) | ❌ | `added` |
| `level` | 리포트 레벨 | ❌ | `info` |
| `fail_level` | 실패 레벨 | ❌ | `warning` |

### 린터 설정

| 매개변수 | 설명 | 필수 | 기본값 |
|----------|------|------|---------|
| `skip_eslint` | ESLint 검사 건너뛰기 | ❌ | `false` |
| `skip_stylelint` | Stylelint 검사 건너뛰기 | ❌ | `false` |
| `skip_markdownlint` | Markdownlint 검사 건너뛰기 | ❌ | `false` |
| `skip_misspell` | Misspell 검사 건너뛰기 | ❌ | `false` |
| `eslint_flags` | ESLint 검사 패턴 | ❌ | `**/*.{js,jsx,ts,tsx}` |
| `stylelint_input` | Stylelint 검사 패턴 | ❌ | `**/*.css` |
| `markdownlint_flags` | Markdownlint 검사 패턴 | ❌ | `**/*.md` |
| `misspell_locale` | Misspell 로케일 (US/UK) | ❌ | `US` |
| `misspell_ignore` | Misspell 무시할 단어 목록 (콤마로 구분) | ❌ | - |
| `eslint_config_path` | 사용자 정의 ESLint 설정 파일 경로 | ❌ | - |
| `stylelint_config_path` | 사용자 정의 Stylelint 설정 파일 경로 | ❌ | - |
| `markdownlint_config_path` | 사용자 정의 Markdownlint 설정 파일 경로 | ❌ | - |

### 권한 설정

액션이 PR에 코멘트를 달기 위해서는 다음 권한이 필요합니다:

```yaml
permissions:
  contents: read      # 코드를 읽기 위한 권한
  pull-requests: write # PR에 코멘트를 달기 위한 권한
```