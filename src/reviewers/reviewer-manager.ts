import { Reviewer, ReviewResult } from '../types/reviewer';
import * as core from '@actions/core';
import { promises as fs } from 'fs';

export class ReviewerManager {
  private reviewers: Map<string, Reviewer> = new Map();

  registerReviewer(reviewer: Reviewer): void {
    this.reviewers.set(reviewer.constructor.name, reviewer);
  }

  getReviewer(type: string): Reviewer | undefined {
    return this.reviewers.get(type);
  }

  async runReviews(): Promise<void> {
    const results: ReviewResult[] = [];

    for (const [name, reviewer] of this.reviewers.entries()) {
      try {
        if (await reviewer.isEnabled()) {
          const reviewResults = await reviewer.review([]);  // TODO: 파일 목록 전달
          results.push(...reviewResults);
        }
      } catch (error) {
        console.error(`${name} 리뷰어 실행 중 오류 발생:`, error);
      }
    }

    // 결과를 파일에 저장
    await this.saveResults(results);
  }

  async getResults(): Promise<ReviewResult[]> {
    try {
      // TODO: 파일에서 결과 읽기
      return [];
    } catch (error) {
      console.error('결과 읽기 중 오류 발생:', error);
      return [];
    }
  }

  private async saveResults(results: ReviewResult[]): Promise<void> {
    try {
      // TODO: 결과를 파일에 저장
    } catch (error) {
      console.error('결과 저장 중 오류 발생:', error);
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
} 