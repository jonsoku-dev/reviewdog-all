# Unified Lint Action

[![Release](https://github.com/jonsoku-dev/unified-lint-action/workflows/Release/badge.svg)](https://github.com/jonsoku-dev/unified-lint-action/releases)
[![Reviewdog](https://github.com/jonsoku-dev/unified-lint-action/workflows/Reviewdog/badge.svg)](https://github.com/jonsoku-dev/unified-lint-action/actions?query=workflow%3AReviewdog)

> 統合リントGitHubアクション（ESLint、Stylelint、Markdownlint、Misspell）

[English](./README.en.md) | 日本語 | [한국어](./README.md)

## 概要

このアクションは、以下のリントツールを統合して実行し、reviewdogを通じて結果を報告します：

- ESLint（Prettier付き）
- Stylelint
- Markdownlint
- Misspell

## 使用方法

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

## 入力パラメータ

### 基本設定

| パラメータ | 説明 | 必須 | デフォルト値 |
|------------|------|------|--------------|
| `github_token` | GitHubトークン | ✅ | `${{ github.token }}` |
| `workdir` | 作業ディレクトリ | ❌ | `.` |
| `reporter` | reviewdogレポーター | ❌ | `github-pr-review` |
| `filter_mode` | reviewdogフィルターモード | ❌ | `file` |
| `level` | レポートレベル | ❌ | `info` |
| `fail_level` | 失敗レベル | ❌ | `warning` |

### リントツールの有効化/無効化

| パラメータ | 説明 | デフォルト値 |
|------------|------|--------------|
| `skip_eslint` | ESLintをスキップ | `false` |
| `skip_stylelint` | Stylelintをスキップ | `false` |
| `skip_markdownlint` | Markdownlintをスキップ | `false` |
| `skip_misspell` | Misspellをスキップ | `false` |

### ESLint設定

| パラメータ | 説明 | デフォルト値 |
|------------|------|--------------|
| `eslint_flags` | ESLintチェックパターン | `**/*.{js,jsx,ts,tsx}` |
| `eslint_config_path` | ESLint設定ファイルパス | - |

### Stylelint設定

| パラメータ | 説明 | デフォルト値 |
|------------|------|--------------|
| `stylelint_input` | Stylelintチェックパターン | `**/*.css` |
| `stylelint_config_path` | Stylelint設定ファイルパス | - |

### Markdownlint設定

| パラメータ | 説明 | デフォルト値 |
|------------|------|--------------|
| `markdownlint_flags` | Markdownlintチェックパターン | `**/*.md` |
| `markdownlint_config_path` | Markdownlint設定ファイルパス | - |

### Misspell設定

| パラメータ | 説明 | デフォルト値 |
|------------|------|--------------|
| `misspell_locale` | Misspellロケール | `US` |
| `misspell_ignore` | Misspellで無視する単語リスト | - |

## ライセンス

MIT License - 詳細は[LICENSE](./LICENSE)ファイルをご覧ください。 