import { Reviewer, ReviewResult, ReviewerOptions } from '../types/reviewer';
import * as core from '@actions/core';
import { promises as fs } from 'fs';
import path from 'path';

export class ReviewerManager {
  private reviewers: Map<string, Reviewer> = new Map();
  private options: ReviewerOptions;
  private resultsDir: string;

  constructor(options: ReviewerOptions = {}) {
    this.options = options;
    this.resultsDir = path.join(this.options.workdir || '.', '.github', 'review-results');
  }

  registerReviewer(reviewer: Reviewer): void {
    this.reviewers.set(reviewer.constructor.name, reviewer);
    if (this.options.debug) {
      core.debug(`리뷰어 등록됨: ${reviewer.constructor.name}`);
    }
  }

  getReviewer(type: string): Reviewer | undefined {
    return this.reviewers.get(type);
  }

  async runReviews(): Promise<void> {
    if (this.options.debug) {
      core.debug(`리뷰 실행 시작 (등록된 리뷰어: ${Array.from(this.reviewers.keys()).join(', ')})`);
      core.debug(`전체 옵션: ${JSON.stringify({ ...this.options, apiKey: '***' }, null, 2)}`);
    }

    const results: ReviewResult[] = [];

    for (const [name, reviewer] of this.reviewers.entries()) {
      try {
        // 리뷰어별 옵션 설정
        const reviewerType = name.replace('Reviewer', '').toLowerCase();
        const reviewerOptions = {
          ...this.options,
          enabled: process.env[`${reviewerType.toUpperCase()}_REVIEWER_ENABLED`] === 'true',
          apiKey: process.env[`${reviewerType.toUpperCase()}_REVIEWER_API_KEY`],
          model: process.env[`${reviewerType.toUpperCase()}_REVIEWER_MODEL`],
          maxTokens: parseInt(process.env[`${reviewerType.toUpperCase()}_REVIEWER_MAX_TOKENS`] || '1000'),
          temperature: parseFloat(process.env[`${reviewerType.toUpperCase()}_REVIEWER_TEMPERATURE`] || '0.7'),
          filePatterns: process.env[`${reviewerType.toUpperCase()}_REVIEWER_FILE_PATTERNS`]?.split(','),
          excludePatterns: process.env[`${reviewerType.toUpperCase()}_REVIEWER_EXCLUDE_PATTERNS`]?.split(',')
        };

        if (this.options.debug) {
          const debugOptions = { ...reviewerOptions, apiKey: reviewerOptions.apiKey ? '***' : undefined };
          core.debug(`${name} 리뷰어 옵션: ${JSON.stringify(debugOptions, null, 2)}`);
        }

        // 리뷰어 옵션 업데이트
        Object.assign(reviewer, { options: reviewerOptions });

        if (await reviewer.isEnabled()) {
          if (this.options.debug) {
            core.debug(`${name} 리뷰어 실행 중...`);
          }

          // 파일 패턴에 따라 검사할 파일 목록 생성
          const files = await this.getTargetFiles(name);
          if (this.options.debug) {
            core.debug(`${name} 리뷰어가 검사할 파일 수: ${files.length}`);
          }

          const reviewResults = await reviewer.review(files);
          results.push(...reviewResults);

          if (this.options.debug) {
            core.debug(`${name} 리뷰어 완료 (발견된 문제: ${reviewResults.length}개)`);
          }
        } else {
          if (this.options.debug) {
            core.debug(`${name} 리뷰어가 비활성화되어 있어 건너뜁니다.`);
          }
        }
      } catch (error) {
        core.error(`${name} 리뷰어 실행 중 오류 발생: ${error}`);
        if (this.options.debug && error instanceof Error) {
          core.debug(`스택 트레이스: ${error.stack}`);
        }
      }
    }

    // 결과를 파일에 저장
    await this.saveResults(results);

    if (this.options.debug) {
      core.debug(`모든 리뷰 완료. 총 ${results.length}개의 문제가 발견되었습니다.`);
    }
  }

  private async getTargetFiles(reviewerName: string): Promise<string[]> {
    const workdir = this.options.workdir || '.';
    const reviewer = this.reviewers.get(reviewerName);
    
    if (!reviewer) {
      return [];
    }

    try {
      const allFiles = await fs.readdir(workdir);
      return allFiles.filter(file => {
        // 기본 파일 타입 필터링
        const isSourceFile = file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx');
        
        // 파일 패턴 매칭
        const matchesPattern = !this.options.filePatterns?.length ||
          this.options.filePatterns.some(pattern => file.match(pattern));
        
        // 제외 패턴 확인
        const isExcluded = this.options.excludePatterns?.some(pattern => file.match(pattern));

        return isSourceFile && matchesPattern && !isExcluded;
      });
    } catch (error) {
      core.error(`파일 목록 생성 중 오류 발생: ${error}`);
      return [];
    }
  }

  async getResults(): Promise<ReviewResult[]> {
    try {
      const resultsFile = path.join(this.resultsDir, 'review-results.json');
      const content = await fs.readFile(resultsFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      core.error(`결과 읽기 중 오류 발생: ${error}`);
      return [];
    }
  }

  private async saveResults(results: ReviewResult[]): Promise<void> {
    try {
      // 결과 디렉토리 생성
      await fs.mkdir(this.resultsDir, { recursive: true });
      
      // 결과 파일 저장
      const resultsFile = path.join(this.resultsDir, 'review-results.json');
      await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
      
      if (this.options.debug) {
        core.debug(`리뷰 결과가 ${resultsFile}에 저장되었습니다.`);
      }

      // 마크다운 요약 생성 및 저장
      const summary = await this.generateSummary(results);
      const summaryFile = path.join(this.resultsDir, 'review-summary.md');
      await fs.writeFile(summaryFile, summary);

      if (this.options.debug) {
        core.debug(`리뷰 요약이 ${summaryFile}에 저장되었습니다.`);
      }
    } catch (error) {
      core.error(`결과 저장 중 오류 발생: ${error}`);
    }
  }

  async generateSummary(results: ReviewResult[]): Promise<string> {
    let summary = '# 코드 품질 검사 결과 요약\n\n';
    
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

      // 심각도별 통계
      const severityCounts = reviewerResults.reduce((counts, result) => {
        counts[result.severity] = (counts[result.severity] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      summary += '### 심각도별 통계\n';
      for (const [severity, count] of Object.entries(severityCounts)) {
        summary += `- ${severity}: ${count}개\n`;
      }
      summary += '\n';

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
          const severityIcon = {
            error: '🔴',
            warning: '⚠️',
            info: 'ℹ️'
          }[result.severity] || '';
          
          summary += `${severityIcon} **${result.severity.toUpperCase()}** - ${result.message} (라인 ${result.line})\n`;
        }
        summary += '\n';
      }
    }

    return summary;
  }
} 