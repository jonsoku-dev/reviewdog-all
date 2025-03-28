# Unified Lint Action

[![Release](https://github.com/jonsoku-dev/unified-lint-action/workflows/Release/badge.svg)](https://github.com/jonsoku-dev/unified-lint-action/releases)
[![Reviewdog](https://github.com/jonsoku-dev/unified-lint-action/workflows/Reviewdog/badge.svg)](https://github.com/jonsoku-dev/unified-lint-action/actions?query=workflow%3AReviewdog)

> 통합 린트 GitHub 액션 (ESLint, Stylelint, Markdownlint, Misspell)

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
| `filter_mode` | reviewdog 필터 모드 | ❌ | `file` |
| `level` | 리포트 레벨 | ❌ | `info` |
| `fail_level` | 실패 레벨 | ❌ | `warning` |

### 린트 도구 활성화/비활성화

| 매개변수 | 설명 | 기본값 |
|----------|------|---------|
| `skip_eslint` | ESLint 스킵 | `false` |
| `skip_stylelint` | Stylelint 스킵 | `false` |
| `skip_markdownlint` | Markdownlint 스킵 | `false` |
| `skip_misspell` | Misspell 스킵 | `false` |

### ESLint 설정

| 매개변수 | 설명 | 기본값 |
|----------|------|---------|
| `eslint_flags` | ESLint 검사 패턴 | `**/*.{js,jsx,ts,tsx}` |
| `eslint_config_path` | ESLint 설정 파일 경로 | - |

### Stylelint 설정

| 매개변수 | 설명 | 기본값 |
|----------|------|---------|
| `stylelint_input` | Stylelint 검사 패턴 | `**/*.css` |
| `stylelint_config_path` | Stylelint 설정 파일 경로 | - |

### Markdownlint 설정

| 매개변수 | 설명 | 기본값 |
|----------|------|---------|
| `markdownlint_flags` | Markdownlint 검사 패턴 | `**/*.md` |
| `markdownlint_config_path` | Markdownlint 설정 파일 경로 | - |

### Misspell 설정

| 매개변수 | 설명 | 기본값 |
|----------|------|---------|
| `misspell_locale` | Misspell 로케일 | `US` |
| `misspell_ignore` | Misspell 무시할 단어 목록 | - |

## 라이선스

MIT License - 자세한 내용은 [LICENSE](./LICENSE) 파일을 참조하세요. 