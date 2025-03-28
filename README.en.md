# Unified Lint Action

[![Release](https://github.com/jonsoku-dev/unified-lint-action/workflows/Release/badge.svg)](https://github.com/jonsoku-dev/unified-lint-action/releases)
[![Reviewdog](https://github.com/jonsoku-dev/unified-lint-action/workflows/Reviewdog/badge.svg)](https://github.com/jonsoku-dev/unified-lint-action/actions?query=workflow%3AReviewdog)

> Unified Lint GitHub Action (ESLint, Stylelint, Markdownlint, Misspell)

English | [日本語](./README.ja.md) | [한국어](./README.md)

## Overview

This action runs multiple linting tools and reports results through reviewdog:

- ESLint (with Prettier)
- Stylelint
- Markdownlint
- Misspell

## Usage

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

## Input Parameters

### Basic Configuration

| Parameter | Description | Required | Default |
|-----------|-------------|----------|---------|
| `github_token` | GitHub Token | ✅ | `${{ github.token }}` |
| `workdir` | Working Directory | ❌ | `.` |
| `reporter` | Reviewdog Reporter | ❌ | `github-pr-review` |
| `filter_mode` | Reviewdog Filter Mode | ❌ | `file` |
| `level` | Report Level | ❌ | `info` |
| `fail_level` | Failure Level | ❌ | `warning` |

### Lint Tools Enable/Disable

| Parameter | Description | Default |
|-----------|-------------|---------|
| `skip_eslint` | Skip ESLint | `false` |
| `skip_stylelint` | Skip Stylelint | `false` |
| `skip_markdownlint` | Skip Markdownlint | `false` |
| `skip_misspell` | Skip Misspell | `false` |

### ESLint Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `eslint_flags` | ESLint Check Pattern | `**/*.{js,jsx,ts,tsx}` |
| `eslint_config_path` | ESLint Config File Path | - |

### Stylelint Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `stylelint_input` | Stylelint Check Pattern | `**/*.css` |
| `stylelint_config_path` | Stylelint Config File Path | - |

### Markdownlint Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `markdownlint_flags` | Markdownlint Check Pattern | `**/*.md` |
| `markdownlint_config_path` | Markdownlint Config File Path | - |

### Misspell Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `misspell_locale` | Misspell Locale | `US` |
| `misspell_ignore` | Words to Ignore in Misspell | - |

## License

MIT License - see [LICENSE](./LICENSE) for details. 