import OpenAI from 'openai';
import * as core from '@actions/core';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import { Reviewer, ReviewResult, ReviewerOptions } from '../types/reviewer';
import path from 'path';

export class AIReviewer implements Reviewer {
  private openai: OpenAI;
  private options: ReviewerOptions;
  private readonly name = 'AIReviewer';

  constructor(options: ReviewerOptions = {}) {
    this.options = options;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }
    this.openai = new OpenAI({ apiKey });
  }

  async isEnabled(): Promise<boolean> {
    return process.env.SKIP_AI_REVIEW !== 'true' && !!process.env.OPENAI_API_KEY;
  }

  async review(files: string[]): Promise<ReviewResult[]> {
    const results: ReviewResult[] = [];
    const workdir = this.options.workdir || '.';

    // 파일 패턴이 지정되지 않은 경우 기본값 사용
    const targetFiles = files.length > 0 ? files : fsSync.readdirSync(workdir)
      .filter(file => file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx'));

    for (const file of targetFiles) {
      try {
        const filePath = path.join(workdir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const suggestions = await this.analyzeCode(content);
        
        // 각 제안사항을 개별 ReviewResult로 변환
        suggestions.forEach((suggestion, index) => {
          results.push({
            file: filePath,
            line: 1, // OpenAI API는 특정 라인 정보를 제공하지 않으므로 기본값 사용
            message: suggestion,
            severity: 'info',
            reviewer: this.name
          });
        });
      } catch (error) {
        core.warning(`파일 분석 중 오류 발생 (${file}): ${error}`);
      }
    }

    return results;
  }

  private async analyzeCode(code: string): Promise<string[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.options.model || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: '당신은 전문적인 코드 리뷰어입니다. 코드의 품질, 가독성, 성능, 보안 측면에서 개선사항을 제안해주세요.'
          },
          {
            role: 'user',
            content: `다음 코드를 리뷰하고 개선사항을 제안해주세요:\n\n${code}`
          }
        ],
        max_tokens: this.options.maxTokens || 1000,
        temperature: this.options.temperature || 0.7,
      });

      const suggestions = response.choices[0].message.content
        ?.split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^[0-9]+\.\s*/, '')) || [];

      return suggestions;
    } catch (error) {
      if (error instanceof Error) {
        core.error(error.message);
      } else {
        core.error('OpenAI API 호출 중 알 수 없는 오류가 발생했습니다.');
      }
      return [];
    }
  }
} 