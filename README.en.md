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
    permissions: # Required permissions for PR comments
      contents: read
      pull-requests: write
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
| `filter_mode` | Reviewdog Filter Mode (`added`: only changed lines, `diff_context`: changed lines and context, `file`: whole modified files, `nofilter`: all files) | ❌ | `added` |
| `level` | Report Level | ❌ | `info` |
| `fail_level` | Failure Level | ❌ | `warning` |

### Permissions Configuration

The action requires the following permissions to comment on PRs:

```yaml
permissions:
  contents: read      # Permission to read code
  pull-requests: write # Permission to comment on PRs
```