import OpenAI from 'openai';
// import { getOctokit, context } from '@actions/github';
import * as core from '@actions/core';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';

// 타입 정의
interface ReviewResult {
  file: string;
  suggestions: string[];
}

interface JsonResult {
  files_reviewed: number;
  total_issues: number;
  reviews: Array<{
    file: string;
    suggestions_count: number;
    suggestions: string[];
  }>;
}

type ReviewLevel = 'basic' | 'detailed' | 'security' | 'performance';

interface OpenAIError extends Error {
  response?: {
    data: any;
  };
}

async function runAICodeReview(): Promise<void> {
  try {
    // 환경변수 디버깅
    console.log('=== 환경변수 디버깅 ===');
    console.log('process.env:', {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '설정됨' : '설정되지 않음',
      AI_REVIEW_LEVEL: process.env.AI_REVIEW_LEVEL,
      AI_SUGGESTIONS_LIMIT: process.env.AI_SUGGESTIONS_LIMIT,
      NODE_PATH: process.env.NODE_PATH,
      PATH: process.env.PATH
    });

    const openaiApiKey = process.env.OPENAI_API_KEY;
    // const githubToken = process.env.GITHUB_TOKEN;
    const reviewLevel = (process.env.AI_REVIEW_LEVEL || 'basic') as ReviewLevel;
    const suggestionsLimit = parseInt(process.env.AI_SUGGESTIONS_LIMIT || '5');

    // OpenAI 클라이언트 초기화 디버깅
    core.debug('OpenAI 클라이언트 초기화 시작...');
    if (!openaiApiKey) {
      core.setOutput('ai_review_outcome', 'skipped');
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }
    
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });
    core.debug('OpenAI 클라이언트 초기화 완료');

    // const octokit = getOctokit(githubToken);

    // 테스트용 임시 코드 (실제 PR 변경 파일 대신 현재 디렉토리의 .js 파일들을 검사)
    const testFiles = fsSync.readdirSync('.').filter((file: string) => file.endsWith('.js'));
    core.debug(`검토할 파일 수: ${testFiles.length}`);
    
    const reviews: ReviewResult[] = [];
    let totalSuggestions = 0;

    for (const file of testFiles) {
      core.debug(`파일 분석 시작: ${file}`);

      try {
        // 파일 내용 읽기
        const fileContent = fsSync.readFileSync(file, 'utf8');
        core.debug(`파일 내용 로드 완료: ${file} (${fileContent.length} 바이트)`);
        
        // AI 리뷰 프롬프트 생성
        const prompt = generateReviewPrompt(fileContent, reviewLevel);
        core.debug('리뷰 프롬프트 생성 완료');
        
        // OpenAI API 호출 준비
        const requestParams = {
          model: 'gpt-4',
          messages: [
            { role: 'system' as const, content: '당신은 전문적인 코드 리뷰어입니다.' },
            { role: 'user' as const, content: prompt }
          ],
          max_tokens: 1000,
          temperature: 0.7,
        };
        
        core.debug('OpenAI API 호출 시작...');
        core.debug(`요청 파라미터: ${JSON.stringify(requestParams, null, 2)}`);
        
        // OpenAI API 호출
        const response = await openai.chat.completions.create(requestParams);
        
        core.debug('OpenAI API 응답 수신');
        core.debug(`응답 상태: ${response.choices ? 'Success' : 'No Choices'}`);
        
        if (!response.choices || response.choices.length === 0) {
          throw new Error('AI가 응답을 생성하지 못했습니다.');
        }

        const suggestions = response.choices[0].message.content;
        if (!suggestions) continue;

        const suggestionsList = suggestions.split('\n').slice(0, suggestionsLimit);
        totalSuggestions += suggestionsList.length;
        core.debug(`AI 제안 수신 완료 (${suggestionsList.length} 줄)`);
        
        reviews.push({
          file: file,
          suggestions: suggestionsList,
        });
        
        core.debug(`파일 분석 완료: ${file}`);
        
      } catch (error) {
        const err = error as Error;
        core.warning(`파일 ${file} 처리 중 오류 발생: ${err.message}`);
        continue;
      }
    }

    core.debug(`총 ${reviews.length}개 파일의 리뷰 완료`);

    // 리뷰 결과를 파일로 저장
    const reviewResult = formatReviewComment(reviews);
    fsSync.writeFileSync('ai-review-result.md', reviewResult);
    core.debug('리뷰 결과를 ai-review-result.md 파일에 저장했습니다.');
    
    // GitHub Actions outputs 설정
    core.setOutput('ai_review_outcome', 'success');
    core.setOutput('ai_review_count', reviews.length);
    core.setOutput('ai_suggestions_count', totalSuggestions);
    
    // GitHub Actions 환경 변수 설정
    core.exportVariable('AI_REVIEW_OUTCOME', 'success');
    core.exportVariable('AI_REVIEW_FAILED', 'false');
    
  } catch (error) {
    const err = error as OpenAIError;
    core.error('상세 에러 정보:');
    core.error(err.stack || err.message);
    if (err.response) {
      core.error('API 응답 에러:');
      core.error(JSON.stringify(err.response.data, null, 2));
    }
    
    // 에러 발생 시 환경 변수 설정
    core.setOutput('ai_review_outcome', 'failure');
    core.exportVariable('AI_REVIEW_OUTCOME', 'failure');
    core.exportVariable('AI_REVIEW_FAILED', 'true');
    
    core.setFailed(`AI 코드 리뷰 실패: ${err.message}`);
  }
}

function generateReviewPrompt(code: string, level: ReviewLevel): string {
  const basePrompt = '다음 코드를 리뷰하고 개선사항을 제안해주세요:';
  
  const levelSpecificPrompts: Record<ReviewLevel, string> = {
    basic: '코드 스타일과 기본적인 개선사항에 집중해주세요.',
    detailed: '코드 구조, 성능, 유지보수성 관점에서 상세한 리뷰를 해주세요.',
    security: '보안 취약점과 잠재적인 위험요소를 중점적으로 검토해주세요.',
    performance: '성능 최적화 관점에서 개선사항을 제안해주세요.',
  };

  return `${basePrompt}\n${levelSpecificPrompts[level]}\n\n${code}`;
}

function formatReviewComment(reviews: ReviewResult[]): string {
  let comment = '## 🤖 AI 코드 리뷰 결과\n\n';
  let totalIssues = 0;
  
  reviews.forEach(review => {
    comment += `### 📝 ${review.file}\n\n`;
    review.suggestions.forEach((suggestion, index) => {
      totalIssues++;
      comment += `${index + 1}. ${suggestion}\n`;
    });
    comment += '\n';
  });
  
  // 요약 정보 추가
  comment = `# AI 코드 리뷰 요약\n\n` +
    `- 검토된 파일: ${reviews.length}개\n` +
    `- 발견된 이슈: ${totalIssues}개\n\n` +
    comment;
  
  // 결과를 파일로 저장
  fsSync.writeFileSync('ai-review-result.md', comment);
  
  // 결과를 JSON 형식으로도 저장 (collect-results.js에서 사용)
  const jsonResult: JsonResult = {
    files_reviewed: reviews.length,
    total_issues: totalIssues,
    reviews: reviews.map(review => ({
      file: review.file,
      suggestions_count: review.suggestions.length,
      suggestions: review.suggestions
    }))
  };
  fsSync.writeFileSync('ai-review-result.json', JSON.stringify(jsonResult, null, 2));
  
  return comment;
}

runAICodeReview(); 