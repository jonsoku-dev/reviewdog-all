import * as core from '@actions/core';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';

interface LintResult {
  filePath: string;
  messages: Array<{
    ruleId: string;
    severity: number;
    message: string;
    line: number;
    column: number;
  }>;
}

interface StylelintResult {
  source: string;
  warnings: Array<{
    rule: string;
    severity: string;
    text: string;
    line: number;
    column: number;
  }>;
}

interface AIReviewResult {
  files_reviewed: number;
  total_issues: number;
  reviews: Array<{
    file: string;
    suggestions_count: number;
    suggestions: string[];
  }>;
}

interface CollectedResults {
  eslint: LintResult[];
  stylelint: StylelintResult[];
  aiReview?: AIReviewResult;
}

async function collectResults(): Promise<void> {
  try {
    const results: CollectedResults = {
      eslint: [],
      stylelint: []
    };

    // ESLint 결과 수집
    if (fsSync.existsSync('eslint-results.json')) {
      const eslintResults = JSON.parse(await fs.readFile('eslint-results.json', 'utf8'));
      results.eslint = eslintResults;
      core.debug('ESLint 결과 수집 완료');
    } else {
      core.debug('ESLint 결과 파일이 없습니다.');
    }

    // Stylelint 결과 수집
    if (fsSync.existsSync('stylelint-results.json')) {
      const stylelintResults = JSON.parse(await fs.readFile('stylelint-results.json', 'utf8'));
      results.stylelint = stylelintResults;
      core.debug('Stylelint 결과 수집 완료');
    } else {
      core.debug('Stylelint 결과 파일이 없습니다.');
    }

    // AI 리뷰 결과 수집
    if (fsSync.existsSync('ai-review-result.json')) {
      const aiReviewResults = JSON.parse(await fs.readFile('ai-review-result.json', 'utf8'));
      results.aiReview = aiReviewResults;
      core.debug('AI 리뷰 결과 수집 완료');
    } else {
      core.debug('AI 리뷰 결과 파일이 없습니다.');
    }

    // 결과 요약 생성
    let summary = '# 코드 품질 검사 결과 요약\n\n';

    // ESLint 결과 요약
    const eslintIssues = results.eslint.reduce((total, file) => total + file.messages.length, 0);
    summary += `## ESLint 검사 결과\n- 발견된 문제: ${eslintIssues}개\n\n`;

    // Stylelint 결과 요약
    const stylelintIssues = results.stylelint.reduce((total, file) => total + file.warnings.length, 0);
    summary += `## Stylelint 검사 결과\n- 발견된 문제: ${stylelintIssues}개\n\n`;

    // AI 리뷰 결과 요약
    if (results.aiReview) {
      summary += `## AI 코드 리뷰 결과\n` +
        `- 검토된 파일: ${results.aiReview.files_reviewed}개\n` +
        `- 발견된 이슈: ${results.aiReview.total_issues}개\n\n`;
    }

    // 상세 결과 추가
    summary += '# 상세 결과\n\n';

    // ESLint 상세 결과
    if (results.eslint.length > 0) {
      summary += '## ESLint 상세 결과\n\n';
      results.eslint.forEach(file => {
        if (file.messages.length > 0) {
          summary += `### ${file.filePath}\n\n`;
          file.messages.forEach(msg => {
            summary += `- ${msg.message} (${msg.ruleId}) at line ${msg.line}, column ${msg.column}\n`;
          });
          summary += '\n';
        }
      });
    }

    // Stylelint 상세 결과
    if (results.stylelint.length > 0) {
      summary += '## Stylelint 상세 결과\n\n';
      results.stylelint.forEach(file => {
        if (file.warnings.length > 0) {
          summary += `### ${file.source}\n\n`;
          file.warnings.forEach(warning => {
            summary += `- ${warning.text} (${warning.rule}) at line ${warning.line}, column ${warning.column}\n`;
          });
          summary += '\n';
        }
      });
    }

    // AI 리뷰 상세 결과
    if (results.aiReview) {
      summary += '## AI 리뷰 상세 결과\n\n';
      results.aiReview.reviews.forEach(review => {
        summary += `### ${review.file}\n\n`;
        review.suggestions.forEach((suggestion, index) => {
          summary += `${index + 1}. ${suggestion}\n`;
        });
        summary += '\n';
      });
    }

    // 결과를 파일로 저장
    await fs.writeFile('lint-results.md', summary);
    await fs.writeFile('lint-results.json', JSON.stringify(results, null, 2));

    // GitHub Actions outputs 설정
    core.setOutput('eslint_issues', eslintIssues);
    core.setOutput('stylelint_issues', stylelintIssues);
    core.setOutput('ai_review_issues', results.aiReview?.total_issues || 0);
    core.setOutput('total_issues', eslintIssues + stylelintIssues + (results.aiReview?.total_issues || 0));

  } catch (error) {
    const err = error as Error;
    core.error('결과 수집 중 오류 발생:');
    core.error(err.stack || err.message);
    core.setFailed(`결과 수집 실패: ${err.message}`);
  }
}

collectResults(); 