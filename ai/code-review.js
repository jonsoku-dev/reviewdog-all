const OpenAI = require('openai');
const { getOctokit } = require('@actions/github');
const core = require('@actions/core');
const fs = require('fs');
const path = require('path');

async function runAICodeReview() {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const reviewLevel = process.env.AI_REVIEW_LEVEL;
    const suggestionsLimit = parseInt(process.env.AI_SUGGESTIONS_LIMIT);

    if (!openaiApiKey) {
      throw new Error('OpenAI API 키가 필요합니다.');
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // GitHub API 클라이언트 설정
    const octokit = getOctokit(process.env.GITHUB_TOKEN);
    const context = JSON.parse(process.env.GITHUB_CONTEXT);

    // PR의 변경된 파일 가져오기
    const { data: changedFiles } = await octokit.rest.pulls.listFiles({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: context.payload.pull_request.number,
    });

    const reviews = [];

    for (const file of changedFiles) {
      if (file.status === 'removed') continue;

      const fileContent = fs.readFileSync(file.filename, 'utf8');
      
      // AI 리뷰 프롬프트 생성
      const prompt = generateReviewPrompt(fileContent, reviewLevel);
      
      // OpenAI API 호출
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: '당신은 전문적인 코드 리뷰어입니다.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const suggestions = response.choices[0].message.content;
      
      // 리뷰 결과 저장
      reviews.push({
        file: file.filename,
        suggestions: suggestions.split('\n').slice(0, suggestionsLimit),
      });
    }

    // 리뷰 결과를 PR 코멘트로 작성
    await createPRComment(octokit, context, reviews);

    core.setOutput('review_count', reviews.length);
    
  } catch (error) {
    core.setFailed(`AI 코드 리뷰 실패: ${error.message}`);
  }
}

function generateReviewPrompt(code, level) {
  const basePrompt = '다음 코드를 리뷰하고 개선사항을 제안해주세요:';
  
  const levelSpecificPrompts = {
    basic: '코드 스타일과 기본적인 개선사항에 집중해주세요.',
    detailed: '코드 구조, 성능, 유지보수성 관점에서 상세한 리뷰를 해주세요.',
    security: '보안 취약점과 잠재적인 위험요소를 중점적으로 검토해주세요.',
    performance: '성능 최적화 관점에서 개선사항을 제안해주세요.',
  };

  return `${basePrompt}\n${levelSpecificPrompts[level]}\n\n${code}`;
}

async function createPRComment(octokit, context, reviews) {
  const comment = formatReviewComment(reviews);
  
  await octokit.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.payload.pull_request.number,
    body: comment,
  });
}

function formatReviewComment(reviews) {
  let comment = '## 🤖 AI 코드 리뷰 결과\n\n';
  
  reviews.forEach(review => {
    comment += `### 📝 ${review.file}\n\n`;
    review.suggestions.forEach((suggestion, index) => {
      comment += `${index + 1}. ${suggestion}\n`;
    });
    comment += '\n';
  });
  
  return comment;
}

runAICodeReview(); 