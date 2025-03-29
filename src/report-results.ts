import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { ReviewResult } from './types/reviewer';
import { ReviewerManager } from './reviewers/reviewer-manager';

interface ReportOptions {
  commentMode: 'pr_comment' | 'inline' | 'both';
  failOnError: boolean;
}

class GithubReporter {
  private octokit;
  private context;
  private manager: ReviewerManager;

  constructor(token: string, manager: ReviewerManager) {
    this.octokit = getOctokit(token);
    this.context = context;
    this.manager = manager;
  }

  private async cleanupPreviousComments(): Promise<void> {
    if (!this.context.payload.pull_request?.number) return;

    const comments = await this.octokit.rest.issues.listComments({
      ...this.context.repo,
      issue_number: this.context.payload.pull_request.number
    });

    const botComments = comments.data.filter(comment =>
      comment.user?.login === 'github-actions[bot]' &&
      comment.body?.includes('코드 리뷰 결과 요약')
    );

    for (const comment of botComments) {
      await this.octokit.rest.issues.deleteComment({
        ...this.context.repo,
        comment_id: comment.id
      });
    }
  }

  private async createSummaryComment(results: ReviewResult[]): Promise<void> {
    if (!this.context.payload.pull_request?.number) return;

    const summary = this.generateSummary(results);
    await this.octokit.rest.issues.createComment({
      ...this.context.repo,
      issue_number: this.context.payload.pull_request.number,
      body: summary
    });
  }

  private async createInlineComments(results: ReviewResult[]): Promise<void> {
    if (!this.context.payload.pull_request?.number) return;

    const reviews = results.map(result => ({
      path: result.file,
      line: result.line,
      body: `**${result.reviewer}**: ${result.message}`
    }));

    if (reviews.length > 0) {
      await this.octokit.rest.pulls.createReview({
        ...this.context.repo,
        pull_number: this.context.payload.pull_request.number,
        event: 'COMMENT',
        comments: reviews
      });
    }
  }

  private generateSummary(results: ReviewResult[]): string {
    let summary = '# 코드 리뷰 결과 요약\n\n';

    // 전체 통계
    summary += `총 ${results.length}개의 문제가 발견되었습니다.\n\n`;

    // 리뷰어별 요약
    const reviewerGroups = results.reduce((groups, result) => {
      const reviewer = result.reviewer;
      if (!groups[reviewer]) {
        groups[reviewer] = [];
      }
      groups[reviewer].push(result);
      return groups;
    }, {} as Record<string, ReviewResult[]>);

    for (const [reviewer, reviewerResults] of Object.entries(reviewerGroups)) {
      summary += `## ${reviewer} 검사 결과\n`;
      summary += `- 발견된 문제: ${reviewerResults.length}개\n\n`;

      // 파일별 그룹화
      const fileGroups = reviewerResults.reduce((groups, result) => {
        if (!groups[result.file]) {
          groups[result.file] = [];
        }
        groups[result.file].push(result);
        return groups;
      }, {} as Record<string, ReviewResult[]>);

      for (const [file, fileResults] of Object.entries(fileGroups)) {
        summary += `### ${file}\n\n`;
        for (const result of fileResults) {
          summary += `- ${result.message} (라인 ${result.line})\n`;
        }
        summary += '\n';
      }
    }

    return summary;
  }

  async report(options: ReportOptions): Promise<void> {
    try {
      if (!this.context.payload.pull_request?.number) {
        core.info('PR 컨텍스트가 없습니다. 결과 보고를 건너뜁니다.');
        return;
      }

      // 매니저에서 결과 가져오기
      const results = await this.manager.getResults();
      if (results.length === 0) {
        core.info('리뷰 결과가 없습니다.');
        return;
      }

      await this.cleanupPreviousComments();

      if (options.commentMode === 'pr_comment' || options.commentMode === 'both') {
        await this.createSummaryComment(results);
      }

      if (options.commentMode === 'inline' || options.commentMode === 'both') {
        await this.createInlineComments(results);
      }

      // 에러 레벨 결과가 있는지 확인
      const hasErrors = results.some(result => result.severity === 'error');
      if (hasErrors && options.failOnError) {
        core.setFailed('에러 수준의 문제가 발견되었습니다.');
      }

    } catch (error) {
      core.error(`결과 보고 중 오류 발생: ${error}`);
      throw error;
    }
  }

  private convertSeverity(severity: string | number | undefined): 'info' | 'warning' | 'error' {
    if (typeof severity === 'string') {
      switch (severity.toLowerCase()) {
        case 'error':
          return 'error';
        case 'warning':
          return 'warning';
        default:
          return 'info';
      }
    }

    if (typeof severity === 'number') {
      switch (severity) {
        case 2:
          return 'error';
        case 1:
          return 'warning';
        default:
          return 'info';
      }
    }

    return 'info';
  }
}

export async function reportResults() {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN이 설정되지 않았습니다.');
    }

    const options: ReportOptions = {
      commentMode: (process.env.COMMENT_MODE || 'both') as 'pr_comment' | 'inline' | 'both',
      failOnError: process.env.FAIL_ON_ERROR === 'true'
    };

    const manager = new ReviewerManager();
    const reporter = new GithubReporter(token, manager);
    await reporter.report(options);
  } catch (error) {
    core.error(`결과 보고 중 오류 발생: ${error}`);
    core.setFailed(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
  }
}

// 스크립트가 직접 실행될 때만 실행
if (require.main === module) {
  reportResults();
} 