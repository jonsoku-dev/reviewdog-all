const fs = require('fs');
const path = require('path');

function collectResults() {
  const {
    GITHUB_STEP_SUMMARY,
    GITHUB_SERVER_URL,
    GITHUB_REPOSITORY,
    GITHUB_SHA,
    GITHUB_RUN_ID,
    GITHUB_EVENT_NAME,
    GITHUB_EVENT_PATH,
  } = process.env;

  // 린터 결과 수집
  const linters = [
    {
      name: 'ESLint',
      skip: process.env.SKIP_ESLINT === 'true',
      outcome: process.env.ESLINT_OUTCOME,
      failed: process.env.ESLINT_FAILED === 'true',
      flags: process.env.ESLINT_FLAGS,
      command: 'eslint'
    },
    {
      name: 'Stylelint',
      skip: process.env.SKIP_STYLELINT === 'true',
      outcome: process.env.STYLELINT_OUTCOME,
      failed: process.env.STYLELINT_FAILED === 'true',
      flags: process.env.STYLELINT_INPUT,
      command: 'stylelint'
    },
    {
      name: 'Markdownlint',
      skip: process.env.SKIP_MARKDOWNLINT === 'true',
      outcome: process.env.MARKDOWNLINT_OUTCOME,
      failed: process.env.MARKDOWNLINT_FAILED === 'true',
      flags: process.env.MARKDOWNLINT_FLAGS,
      command: 'markdownlint'
    },
    {
      name: 'Misspell',
      skip: process.env.SKIP_MISSPELL === 'true',
      outcome: process.env.MISSPELL_OUTCOME,
      failed: process.env.MISSPELL_FAILED === 'true',
      flags: '.',
      command: 'misspell'
    },
    {
      name: '접근성 검사',
      skip: process.env.SKIP_ACCESSIBILITY === 'true',
      outcome: process.env.ACCESSIBILITY_OUTCOME,
      failed: process.env.ACCESSIBILITY_FAILED === 'true',
      resultFile: 'accessibility-results.json'
    },
    {
      name: 'AI 코드 리뷰',
      skip: process.env.SKIP_AI_REVIEW === 'true',
      outcome: process.env.AI_REVIEW_OUTCOME,
      failed: process.env.AI_REVIEW_FAILED === 'true',
      resultFile: 'ai-review-result.json',
      mdFile: 'ai-review-result.md'
    }
  ];

  // GitHub 링크 생성
  const repoUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}`;
  const commitUrl = `${repoUrl}/commit/${GITHUB_SHA}`;
  const workflowUrl = `${repoUrl}/actions/runs/${GITHUB_RUN_ID}`;

  // 실패한 린터 수집
  const failedLinters = linters.filter(linter => !linter.skip && linter.failed);
  const hasFailures = failedLinters.length > 0;

  let summary = '';

  // 1. 헤더 섹션
  summary += hasFailures ? '# ❌ 일부 검사가 실패했습니다\n\n' : '# ✅ 모든 검사가 통과되었습니다\n\n';

  // 2. 메타 정보 섹션
  summary += '## 📋 실행 정보\n\n';
  summary += '| 항목 | 내용 |\n';
  summary += '|:-----|:------|\n';
  summary += `| 저장소 | [\`${GITHUB_REPOSITORY}\`](${repoUrl}) |\n`;
  
  // PR 정보 추가
  if (GITHUB_EVENT_NAME === 'pull_request') {
    const event = JSON.parse(fs.readFileSync(GITHUB_EVENT_PATH, 'utf8'));
    const prUrl = `${repoUrl}/pull/${event.pull_request.number}`;
    summary += `| PR | [#${event.pull_request.number}](${prUrl}) |\n`;
    summary += `| 브랜치 | \`${event.pull_request.head.ref}\` → \`${event.pull_request.base.ref}\` |\n`;
  }
  
  summary += `| 커밋 | [\`${GITHUB_SHA.slice(0, 7)}\`](${commitUrl}) |\n`;
  summary += `| 워크플로우 | [보기](${workflowUrl}) |\n\n`;

  // 3. 검사 결과 요약 테이블
  summary += '## 🔍 검사 결과 요약\n\n';
  summary += '| 검사 도구 | 상태 | 요약 |\n';
  summary += '|:----------|:-----|:-----|\n';

  // 각 린터의 상태 추가
  linters.forEach(linter => {
    const status = linter.skip ? '⏭️ 스킵됨' : linter.failed ? '❌ 실패' : '✅ 통과';
    let details = '정보 없음';

    // 결과 파일이나 명령어 실행 결과로부터 요약 정보 추출
    if (linter.name === 'AI 코드 리뷰') {
      if (fs.existsSync(linter.resultFile)) {
        try {
          const results = JSON.parse(fs.readFileSync(linter.resultFile, 'utf8'));
          details = `${results.files_reviewed}개 파일 검토, ${results.total_issues}개 제안사항`;
        } catch (error) {}
      }
    } else if (linter.resultFile && fs.existsSync(linter.resultFile)) {
      try {
        const results = JSON.parse(fs.readFileSync(linter.resultFile, 'utf8'));
        if (linter.name === '접근성 검사') {
          details = `${results.summary?.totalViolations || 0}개 위반사항`;
        }
      } catch (error) {}
    } else if (!linter.skip && linter.command) {
      try {
        const { execSync } = require('child_process');
        const result = execSync(`npx ${linter.command} ${linter.flags} --format compact`, 
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        details = result.trim() ? '문제 발견됨' : '문제 없음';
      } catch (error) {
        details = '오류 발생';
      }
    }

    summary += `| ${linter.name} | ${status} | ${details} |\n`;
  });

  summary += '\n';

  // 4. 상세 검사 결과
  summary += '## 📊 상세 검사 결과\n\n';

  linters.forEach(linter => {
    const statusEmoji = linter.skip ? '⏭️' : linter.failed ? '❌' : '✅';
    const statusText = linter.skip ? '스킵됨' : linter.failed ? '실패' : '통과';
    
    summary += `### ${statusEmoji} ${linter.name} (${statusText})\n\n`;

    if (linter.skip) {
      summary += '이 검사는 스킵되었습니다.\n\n';
      return;
    }

    // AI 코드 리뷰 결과 처리
    if (linter.name === 'AI 코드 리뷰') {
      if (fs.existsSync(linter.resultFile)) {
        try {
          const results = JSON.parse(fs.readFileSync(linter.resultFile, 'utf8'));
          summary += `#### 검토 통계\n`;
          summary += `- 검토된 파일: ${results.files_reviewed}개\n`;
          summary += `- 발견된 이슈: ${results.total_issues}개\n\n`;

          if (results.reviews?.length > 0) {
            summary += `#### 상세 리뷰 내용\n\n`;
            results.reviews.forEach(review => {
              summary += `##### 📝 ${review.file}\n\n`;
              review.suggestions.forEach((suggestion, index) => {
                summary += `${index + 1}. ${suggestion}\n`;
              });
              summary += '\n';
            });
          }
        } catch (error) {
          if (fs.existsSync(linter.mdFile)) {
            const mdContent = fs.readFileSync(linter.mdFile, 'utf8');
            summary += mdContent + '\n';
          }
        }
      }
    }
    // 접근성 검사 결과 처리
    else if (linter.name === '접근성 검사' && fs.existsSync(linter.resultFile)) {
      try {
        const results = JSON.parse(fs.readFileSync(linter.resultFile, 'utf8'));
        if (results.details?.length > 0) {
          results.details.forEach(result => {
            if (result.violations?.length > 0) {
              summary += `#### ${result.file}\n\n`;
              result.violations.forEach(violation => {
                summary += `- ${violation.help}: ${violation.nodes.length}개 요소\n`;
                if (violation.nodes.length > 0) {
                  summary += '  - 영향받는 요소:\n';
                  violation.nodes.forEach(node => {
                    summary += `    - \`${node.html}\`\n`;
                  });
                }
              });
              summary += '\n';
            }
          });
        } else {
          summary += '접근성 문제가 발견되지 않았습니다.\n\n';
        }
      } catch (error) {
        summary += `결과 파일 읽기 실패: ${error.message}\n\n`;
      }
    }
    // 다른 린터 결과 처리
    else if (linter.command) {
      try {
        const { execSync } = require('child_process');
        const result = execSync(`npx ${linter.command} ${linter.flags} --format compact`,
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        
        if (result.trim()) {
          summary += '```diff\n' + result + '\n```\n\n';
        } else {
          summary += '문제가 발견되지 않았습니다.\n\n';
        }
      } catch (error) {
        if (error.stdout) {
          summary += '```diff\n' + error.stdout + '\n```\n\n';
        } else {
          summary += `명령어 실행 중 오류 발생: ${error.message}\n\n`;
        }
      }
    }
  });

  // 5. 결과 저장
  fs.writeFileSync(GITHUB_STEP_SUMMARY, summary);

  // 6. Slack 통지를 위한 환경 변수 설정
  const lintResults = {
    status: hasFailures ? 'failed' : 'success',
    repository: GITHUB_REPOSITORY,
    repository_url: repoUrl,
    commit: GITHUB_SHA.slice(0, 7),
    commit_url: commitUrl,
    workflow_url: workflowUrl,
    results: linters.map(linter => ({
      name: linter.name,
      status: linter.skip ? 'skipped' : linter.failed ? 'failed' : 'success',
      details: getResultDetails(linter)
    }))
  };

  // PR 정보 추가
  if (GITHUB_EVENT_NAME === 'pull_request') {
    const event = JSON.parse(fs.readFileSync(GITHUB_EVENT_PATH, 'utf8'));
    lintResults.pr = {
      number: event.pull_request.number,
      url: `${repoUrl}/pull/${event.pull_request.number}`,
      head: event.pull_request.head.ref,
      base: event.pull_request.base.ref
    };
  }

  fs.writeFileSync(process.env.GITHUB_ENV, `LINT_RESULTS<<EOF\n${JSON.stringify(lintResults)}\nEOF\n`, { flag: 'a' });
}

function getResultDetails(linter) {
  if (linter.skip) return null;

  if (linter.name === 'AI 코드 리뷰' && fs.existsSync(linter.resultFile)) {
    try {
      const results = JSON.parse(fs.readFileSync(linter.resultFile, 'utf8'));
      return {
        files_reviewed: results.files_reviewed,
        total_issues: results.total_issues,
        reviews: results.reviews
      };
    } catch (error) {
      if (fs.existsSync(linter.mdFile)) {
        return fs.readFileSync(linter.mdFile, 'utf8');
      }
    }
  }
  
  if (linter.resultFile && fs.existsSync(linter.resultFile)) {
    try {
      return JSON.parse(fs.readFileSync(linter.resultFile, 'utf8'));
    } catch (error) {}
  }
  
  if (linter.command) {
    try {
      const { execSync } = require('child_process');
      return execSync(`npx ${linter.command} ${linter.flags} --format compact`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      return error.stdout || error.message;
    }
  }
  
  return null;
}

// 스크립트 실행
try {
  collectResults();
} catch (error) {
  console.error('결과 수집 중 오류 발생:', error);
  process.exit(1);
} 