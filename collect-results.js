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
      resultFile: 'ai-review-results.json'
    }
  ];

  // GitHub 링크 생성
  const repoUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}`;
  const commitUrl = `${repoUrl}/commit/${GITHUB_SHA}`;
  const workflowUrl = `${repoUrl}/actions/runs/${GITHUB_RUN_ID}`;

  // 실패한 린터 수집
  const failedLinters = linters.filter(linter => !linter.skip && linter.failed);
  const hasFailures = failedLinters.length > 0;

  // 헤더 생성
  let summary = hasFailures ? '# ❌ 일부 검사가 실패했습니다\n\n' : '# ✅ 모든 검사가 통과되었습니다\n\n';

  // 메타 정보 테이블 생성
  summary += '| 항목 | 내용 |\n';
  summary += '|:-----|:------|\n';
  summary += `| 저장소 | [\`${GITHUB_REPOSITORY}\`](${repoUrl}) |\n`;
  
  // PR 또는 브랜치 정보
  if (GITHUB_EVENT_NAME === 'pull_request') {
    const event = JSON.parse(fs.readFileSync(GITHUB_EVENT_PATH, 'utf8'));
    const prUrl = `${repoUrl}/pull/${event.pull_request.number}`;
    summary += `| PR | [#${event.pull_request.number}](${prUrl}) |\n`;
    summary += `| 브랜치 | \`${event.pull_request.head.ref}\` → \`${event.pull_request.base.ref}\` |\n`;
  }
  
  summary += `| 커밋 | [\`${GITHUB_SHA.slice(0, 7)}\`](${commitUrl}) |\n`;
  summary += `| 워크플로우 | [보기](${workflowUrl}) |\n\n`;

  // 상세 검사 결과
  summary += '## 상세 검사 결과\n\n';

  // 린터 결과를 테이블로 표시
  summary += '| 검사 도구 | 상태 | 상세 |\n';
  summary += '|:-----|:-----|:------|\n';

  // 각 린터의 결과 추가
  linters.forEach(linter => {
    let status, statusEmoji;
    if (linter.skip) {
      status = '스킵됨';
      statusEmoji = '⏭️';
    } else if (!linter.failed) {
      status = '통과';
      statusEmoji = '✅';
    } else {
      status = '실패';
      statusEmoji = '❌';
    }

    let details = '';
    if (linter.resultFile && fs.existsSync(linter.resultFile)) {
      try {
        const results = JSON.parse(fs.readFileSync(linter.resultFile, 'utf8'));
        if (linter.name === '접근성 검사') {
          details = `${results.summary.totalViolations}개의 위반사항`;
        } else if (linter.name === 'AI 코드 리뷰') {
          details = `${results.suggestions?.length || 0}개의 제안사항`;
        }
      } catch (error) {
        details = '결과 파일 읽기 실패';
      }
    } else if (linter.command) {
      try {
        const { execSync } = require('child_process');
        const result = execSync(`npx ${linter.command} ${linter.flags} --format compact`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        if (result.trim()) {
          details = result.split('\n')[0];
        }
      } catch (error) {
        if (error.stdout) {
          details = error.stdout.split('\n')[0];
        }
      }
    }

    summary += `| ${linter.name} | ${statusEmoji} ${status} | ${details ? `\`${details}\`` : '-'} |\n`;
  });

  summary += '\n';

  // 모든 린터의 상세 결과 표시
  summary += '## 상세 검사 결과\n\n';
  
  linters.forEach(linter => {
    if (linter.name === 'AI 코드 리뷰') {
      try {
        // AI 리뷰 결과 파일 읽기 시도
        let aiResults;
        if (fs.existsSync('ai-review-result.json')) {
          aiResults = JSON.parse(fs.readFileSync('ai-review-result.json', 'utf8'));
          summary += `### ${linter.name} ${linter.skip ? '(스킵됨)' : linter.failed ? '(실패)' : '(통과)'}\n\n`;
          summary += `- 검토된 파일: ${aiResults.files_reviewed}개\n`;
          summary += `- 발견된 이슈: ${aiResults.total_issues}개\n\n`;
          
          if (aiResults.reviews && aiResults.reviews.length > 0) {
            aiResults.reviews.forEach(review => {
              summary += `#### 📝 ${review.file}\n\n`;
              review.suggestions.forEach((suggestion, index) => {
                summary += `${index + 1}. ${suggestion}\n`;
              });
              summary += '\n';
            });
          }
        } else if (fs.existsSync('ai-review-result.md')) {
          // JSON이 없는 경우 마크다운 파일 사용
          const mdContent = fs.readFileSync('ai-review-result.md', 'utf8');
          summary += `### ${linter.name} ${linter.skip ? '(스킵됨)' : linter.failed ? '(실패)' : '(통과)'}\n\n`;
          summary += mdContent + '\n';
        }
      } catch (error) {
        summary += `### ${linter.name}\n\n`;
        summary += `결과 파일 읽기 실패: ${error.message}\n\n`;
      }
    } else if (linter.resultFile && fs.existsSync(linter.resultFile)) {
      try {
        const results = JSON.parse(fs.readFileSync(linter.resultFile, 'utf8'));
        summary += `### ${linter.name} ${linter.skip ? '(스킵됨)' : linter.failed ? '(실패)' : '(통과)'}\n\n`;
        
        if (linter.name === '접근성 검사') {
          results.details.forEach(result => {
            if (result.violations.length > 0) {
              summary += `#### ${result.file}\n\n`;
              result.violations.forEach(violation => {
                summary += `- ${violation.help}: ${violation.nodes.length}개 요소\n`;
              });
              summary += '\n';
            }
          });
        }
      } catch (error) {
        summary += `결과 파일 읽기 실패: ${error.message}\n\n`;
      }
    } else if (linter.command && !linter.skip) {
      try {
        const { execSync } = require('child_process');
        const result = execSync(`npx ${linter.command} ${linter.flags} --format compact`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        if (result.trim()) {
          summary += `### ${linter.name} ${linter.failed ? '(실패)' : '(통과)'}\n\n\`\`\`diff\n${result}\n\`\`\`\n\n`;
        } else {
          summary += `### ${linter.name} (통과)\n\n문제가 발견되지 않았습니다.\n\n`;
        }
      } catch (error) {
        if (error.stdout) {
          summary += `### ${linter.name} (실패)\n\n\`\`\`diff\n${error.stdout}\n\`\`\`\n\n`;
        }
      }
    }
  });

  // 최종 결과
  if (hasFailures) {
    summary += '## ❌ 실패한 검사 요약\n\n';
    summary += '다음 검사에서 문제가 발견되었습니다:\n\n';
    failedLinters.forEach(linter => {
      if (linter.resultFile && fs.existsSync(linter.resultFile)) {
        try {
          const results = JSON.parse(fs.readFileSync(linter.resultFile, 'utf8'));
          summary += `### ${linter.name}\n\n`;
          
          if (linter.name === '접근성 검사') {
            results.details.forEach(result => {
              if (result.violations.length > 0) {
                summary += `#### ${result.file}\n\n`;
                result.violations.forEach(violation => {
                  summary += `- ${violation.help}: ${violation.nodes.length}개 요소\n`;
                });
                summary += '\n';
              }
            });
          } else if (linter.name === 'AI 코드 리뷰') {
            if (results.suggestions?.length > 0) {
              results.suggestions.forEach((suggestion, index) => {
                summary += `${index + 1}. ${suggestion.message}\n`;
                if (suggestion.file) {
                  summary += `   파일: \`${suggestion.file}\`\n`;
                }
                summary += '\n';
              });
            }
          }
        } catch (error) {
          summary += `결과 파일 읽기 실패: ${error.message}\n\n`;
        }
      } else if (linter.command) {
        try {
          const { execSync } = require('child_process');
          const result = execSync(`npx ${linter.command} ${linter.flags} --format compact`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
          if (result.trim()) {
            summary += `### ${linter.name}\n\n\`\`\`diff\n${result}\n\`\`\`\n\n`;
          }
        } catch (error) {
          if (error.stdout) {
            summary += `### ${linter.name}\n\n\`\`\`diff\n${error.stdout}\n\`\`\`\n\n`;
          }
        }
      }
    });
  }

  // 결과를 GITHUB_STEP_SUMMARY에 저장
  fs.writeFileSync(GITHUB_STEP_SUMMARY, summary);

  // Slack 통지를 위한 환경 변수 설정
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
      details: linter.failed ? getResultDetails(linter) : null
    })),
    failed_linters: failedLinters.map(linter => ({
      name: linter.name,
      details: getResultDetails(linter)
    }))
  };

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
  if (linter.resultFile && fs.existsSync(linter.resultFile)) {
    try {
      const results = JSON.parse(fs.readFileSync(linter.resultFile, 'utf8'));
      if (linter.name === '접근성 검사') {
        return `${results.summary.totalViolations}개의 위반사항`;
      } else if (linter.name === 'AI 코드 리뷰') {
        return `${results.suggestions?.length || 0}개의 제안사항`;
      }
    } catch (error) {
      return '결과 파일 읽기 실패';
    }
  } else if (linter.command) {
    try {
      const { execSync } = require('child_process');
      const result = execSync(`npx ${linter.command} ${linter.flags} --format compact`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return result.trim() ? result.split('\n')[0] : null;
    } catch (error) {
      return error.stdout ? error.stdout.split('\n')[0] : null;
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