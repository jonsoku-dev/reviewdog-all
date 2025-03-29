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
      console.log(`리뷰어 등록됨: ${reviewer.constructor.name}`);
    }
  }

  getReviewer(type: string): Reviewer | undefined {
    return this.reviewers.get(type);
  }

  async runReviews(): Promise<void> {
    if (this.options.debug) {
      console.log(`리뷰 실행 시작 (등록된 리뷰어: ${Array.from(this.reviewers.keys()).join(', ')})`);
      console.log(`전체 옵션: ${JSON.stringify({ ...this.options, apiKey: '***' }, null, 2)}`);
    }

    const results: ReviewResult[] = [];

    for (const [name, reviewer] of this.reviewers.entries()) {
      try {
        const reviewerType = name.replace('Reviewer', '').toLowerCase();
        
        if (this.options.debug) {
          console.log(`${name} 리뷰어 실행 시작`);
        }

        if (await reviewer.isEnabled()) {
          if (this.options.debug) {
            console.log(`${name} 리뷰어 실행 중...`);
          }

          const files = await this.getTargetFiles(name);
          if (this.options.debug) {
            console.log(`${name} 리뷰어가 검사할 파일 수: ${files.length}`);
          }

          const reviewResults = await reviewer.review(files);
          
          // 리뷰 결과를 GitHub Actions 로그에 표시
          for (const result of reviewResults) {
            const message = `[${result.reviewer}] ${result.file}:${result.line} - ${result.message}`;
            switch (result.severity) {
              case 'error':
                core.error(message);
                break;
              case 'warning':
                core.warning(message);
                break;
              default:
                core.notice(message);
            }
          }

          results.push(...reviewResults);

          if (this.options.debug) {
            console.log(`${name} 리뷰어 완료 (발견된 문제: ${reviewResults.length}개)`);
          }
        } else {
          if (this.options.debug) {
            console.log(`${name} 리뷰어가 비활성화되어 있어 건너뜁니다.`);
          }
        }
      } catch (error) {
        core.error(`${name} 리뷰어 실행 중 오류 발생: ${error}`);
        if (this.options.debug && error instanceof Error) {
          console.log(`스택 트레이스: ${error.stack}`);
        }
      }
    }

    await this.saveResults(results);

    // GitHub Actions 요약 페이지에 결과 표시
    await this.createActionsSummary(results);

    if (this.options.debug) {
      console.log(`모든 리뷰 완료. 총 ${results.length}개의 문제가 발견되었습니다.`);
    }
  }

  private async createActionsSummary(results: ReviewResult[]): Promise<void> {
    try {
      // 결과 그룹화 및 중복 제거
      const groupedResults = this.groupResults(results);

      // 심각도별 통계 계산 (그룹화된 결과 기준)
      const severityCounts = groupedResults.reduce((counts, result) => {
        counts[result.severity] = (counts[result.severity] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      // 요약 생성
      let summaryContent = '# 코드 품질 검사 결과\n\n';
      summaryContent += `총 ${groupedResults.length}개의 문제가 발견되었습니다.\n\n`;
      
      // 심각도별 통계
      summaryContent += '## 심각도별 통계\n\n';
      Object.entries(severityCounts).forEach(([severity, count]) => {
        const icon = {
          error: '🔴',
          warning: '⚠️',
          info: 'ℹ️'
        }[severity] || '';
        summaryContent += `${icon} **${severity}**: ${count}개\n`;
      });
      summaryContent += '\n---\n\n';

      // 리뷰어별 결과 추가
      const reviewerGroups = groupedResults.reduce((groups, result) => {
        if (!groups[result.reviewer]) {
          groups[result.reviewer] = [];
        }
        groups[result.reviewer].push(result);
        return groups;
      }, {} as Record<string, ReviewResult[]>);

      for (const [reviewer, reviewerResults] of Object.entries(reviewerGroups)) {
        summaryContent += `## ${reviewer} (${reviewerResults.length}개)\n\n`;

        for (const result of reviewerResults) {
          const severityIcon = {
            error: '🔴',
            warning: '⚠️',
            info: 'ℹ️'
          }[result.severity] || '';

          // 파일 위치 표시
          summaryContent += `### ${severityIcon} \`${result.file}:${result.line}\`\n\n`;
          
          // 메시지를 줄바꿈으로 분리하여 처리
          const lines = result.message.split('\n');
          let inCodeBlock = false;
          let isCurrentCode = false;
          let isImprovedCode = false;
          let currentCodeBlock = '';
          let improvedCodeBlock = '';
          let codeLanguage = 'typescript'; // 기본값
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            
            // 코드 블록 처리
            if (trimmedLine.startsWith('```')) {
              if (!inCodeBlock) {
                inCodeBlock = true;
                // 언어 감지
                const langMatch = trimmedLine.match(/^```(\w+)/);
                if (langMatch) {
                  codeLanguage = langMatch[1];
                }
                // 코드 블록 타입 확인
                isCurrentCode = lines[lines.indexOf(line) - 1]?.trim() === '현재 코드:';
                isImprovedCode = lines[lines.indexOf(line) - 1]?.trim() === '개선된 코드:';
                continue;
              } else {
                inCodeBlock = false;
                if (isCurrentCode) {
                  currentCodeBlock = currentCodeBlock.trim();
                } else if (isImprovedCode) {
                  improvedCodeBlock = improvedCodeBlock.trim();
                }
                continue;
              }
            }
            
            // 코드 블록 내용 처리
            if (inCodeBlock) {
              if (isCurrentCode) {
                currentCodeBlock += line + '\n';
              } else if (isImprovedCode) {
                improvedCodeBlock += line + '\n';
              } else {
                summaryContent += line + '\n';
              }
              continue;
            }
            
            // 일반 텍스트 처리
            if (trimmedLine) {
              if (trimmedLine === '현재 코드:' || trimmedLine === '개선된 코드:') {
                summaryContent += `#### ${trimmedLine}\n\n`;
              } else if (trimmedLine.startsWith('**')) {
                summaryContent += trimmedLine + '\n\n';
              } else if (trimmedLine.startsWith('-')) {
                summaryContent += trimmedLine + '\n';
              } else {
                summaryContent += trimmedLine + '\n\n';
              }
            }
          }
          
          // 코드 비교 표시
          if (currentCodeBlock && improvedCodeBlock) {
            summaryContent += '<details><summary>코드 변경사항 보기</summary>\n\n';
            
            // 현재 코드
            summaryContent += '#### 현재 코드\n\n';
            summaryContent += `\`\`\`${codeLanguage}\n${currentCodeBlock}\`\`\`\n\n`;
            
            // 개선된 코드
            summaryContent += '#### 개선된 코드\n\n';
            summaryContent += `\`\`\`${codeLanguage}\n${improvedCodeBlock}\`\`\`\n\n`;
            
            // 변경사항 요약
            const changes = this.generateChangeSummary(currentCodeBlock, improvedCodeBlock);
            if (changes) {
              summaryContent += '#### 변경사항 요약\n\n' + changes + '\n';
            }
            
            summaryContent += '</details>\n\n';
          }
          
          summaryContent += '---\n\n';
        }
      }

      // 마크다운 내용을 GitHub Actions 요약에 추가
      await core.summary
        .addRaw(summaryContent)
        .write();

    } catch (error) {
      core.error(`GitHub Actions 요약 생성 중 오류 발생: ${error}`);
    }
  }

  private processCodeLine(line: string): string {
    let processedLine = line;
    
    // 주석 강조
    if (line.trim().startsWith('//')) {
      return `<span class="comment">${line}</span>`;
    }

    // 문자열 강조
    processedLine = processedLine.replace(
      /("[^"]*"|'[^']*'|`[^`]*`)/g,
      '<span class="string">$1</span>'
    );

    // 함수 호출 강조
    processedLine = processedLine.replace(
      /\b(\w+)\(/g,
      '<span class="function">$1</span>('
    );

    // 키워드 강조
    processedLine = processedLine.replace(
      /(const|let|var|function|class|interface|type|import|export|return|if|else|for|while|try|catch|async|await|new|this)\b/g,
      '<span class="keyword">$1</span>'
    );

    return processedLine;
  }

  private createCodeBlockWithLineNumbers(code: string, language: string, startLine: number): string {
    const lines = code.split('\n');
    const numberedLines = lines.map((line, index) => {
      const lineNumber = startLine + index;
      const processedLine = this.processCodeLine(line);
      return `<div class="code-line"><span class="line-number">${lineNumber}</span>${processedLine}</div>`;
    });
    return numberedLines.join('\n');
  }

  private generateChangeSummary(currentCode: string, improvedCode: string): string {
    const currentLines = currentCode.split('\n');
    const improvedLines = improvedCode.split('\n');
    let summary = '';

    // 변경사항 분석
    const addedLines = improvedLines.filter(line => !currentLines.includes(line));
    const removedLines = currentLines.filter(line => !improvedLines.includes(line));

    if (addedLines.length > 0) {
      summary += '**추가된 내용:**\n\n';
      addedLines.forEach(line => {
        summary += `- ✨ \`${line.trim()}\`\n`;
      });
      summary += '\n';
    }

    if (removedLines.length > 0) {
      summary += '**제거된 내용:**\n\n';
      removedLines.forEach(line => {
        summary += `- 🗑️ \`${line.trim()}\`\n`;
      });
      summary += '\n';
    }

    return summary;
  }

  private groupResults(results: ReviewResult[]): ReviewResult[] {
    const grouped: ReviewResult[] = [];
    let currentGroup: ReviewResult | null = null;

    for (const result of results) {
      // 코드 블록이나 제안사항 리스트는 건너뜁니다
      if (result.message.startsWith('```') || result.message.startsWith('-') || result.message.startsWith('**')) {
        if (currentGroup) {
          currentGroup.message += '\n' + result.message;
        }
        continue;
      }

      // 새로운 그룹 시작
      if (!currentGroup || 
          currentGroup.file !== result.file || 
          currentGroup.severity !== result.severity ||
          currentGroup.reviewer !== result.reviewer) {
        if (currentGroup) {
          grouped.push(currentGroup);
        }
        currentGroup = { ...result };
      } else {
        // 기존 그룹에 메시지 추가
        currentGroup.message += '\n' + result.message;
      }
    }

    // 마지막 그룹 추가
    if (currentGroup) {
      grouped.push(currentGroup);
    }

    return grouped;
  }

  private formatMessage(message: string): string {
    // 메시지 포맷팅은 이제 createActionsSummary에서 직접 처리하므로
    // 이 메서드는 더 이상 사용되지 않습니다.
    return message;
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
        const isSourceFile = file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx');
        const matchesPattern = !this.options.filePatterns?.length ||
          this.options.filePatterns.some(pattern => file.match(pattern));
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
      await fs.mkdir(this.resultsDir, { recursive: true });
      
      const resultsFile = path.join(this.resultsDir, 'review-results.json');
      let existingResults: ReviewResult[] = [];

      // 기존 결과 파일이 있다면 읽어옴
      try {
        const content = await fs.readFile(resultsFile, 'utf8');
        existingResults = JSON.parse(content);
        if (this.options.debug) {
          console.log(`기존 리뷰 결과 ${existingResults.length}개를 불러왔습니다.`);
        }
      } catch (error) {
        if (this.options.debug) {
          console.log('기존 리뷰 결과 파일이 없습니다. 새로 생성합니다.');
        }
      }

      // 타임스탬프 추가
      const timestamp = new Date().toISOString();
      const newResults = results.map(result => ({
        ...result,
        timestamp,
      }));

      // 새로운 결과를 기존 결과 배열에 추가
      const updatedResults = [...existingResults, ...newResults];
      
      // 결과 파일 저장
      await fs.writeFile(resultsFile, JSON.stringify(updatedResults, null, 2));
      
      if (this.options.debug) {
        console.log(`리뷰 결과가 ${resultsFile}에 저장되었습니다. (총 ${updatedResults.length}개)`);
      }

      // 마크다운 요약 생성 및 저장
      const summary = await this.generateSummary(updatedResults);
      const summaryFile = path.join(this.resultsDir, 'review-summary.md');
      await fs.writeFile(summaryFile, summary);

      if (this.options.debug) {
        console.log(`리뷰 요약이 ${summaryFile}에 저장되었습니다.`);
      }
    } catch (error) {
      core.error(`결과 저장 중 오류 발생: ${error}`);
    }
  }

  async generateSummary(results: ReviewResult[]): Promise<string> {
    let summary = '# 코드 품질 검사 결과 요약\n\n';
    
    // 결과를 날짜별로 그룹화
    const dateGroups = results.reduce((groups, result) => {
      const date = (result as any).timestamp?.split('T')[0] || '날짜 없음';
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(result);
      return groups;
    }, {} as Record<string, ReviewResult[]>);

    // 날짜별로 정렬 (최신순)
    const sortedDates = Object.keys(dateGroups).sort().reverse();

    for (const date of sortedDates) {
      const dateResults = dateGroups[date];
      summary += `## ${date} 검사 결과\n\n`;
      summary += `총 ${dateResults.length}개의 문제가 발견되었습니다.\n\n`;

      // 리뷰어별 요약
      const reviewerGroups = dateResults.reduce((groups, result) => {
        const reviewer = result.reviewer;
        if (!groups[reviewer]) {
          groups[reviewer] = [];
        }
        groups[reviewer].push(result);
        return groups;
      }, {} as Record<string, ReviewResult[]>);

      for (const [reviewer, reviewerResults] of Object.entries(reviewerGroups)) {
        summary += `### ${reviewer}\n`;
        summary += `- 발견된 문제: ${reviewerResults.length}개\n\n`;

        // 심각도별 통계
        const severityCounts = reviewerResults.reduce((counts, result) => {
          counts[result.severity] = (counts[result.severity] || 0) + 1;
          return counts;
        }, {} as Record<string, number>);

        summary += '#### 심각도별 통계\n';
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
          summary += `#### ${file}\n\n`;
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

      summary += '---\n\n';
    }

    return summary;
  }
} 