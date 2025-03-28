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
  summary += '| 린터 | 상태 | 상세 |\n';
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
    if (linter.failed) {
      try {
        const { execSync } = require('child_process');
        const result = execSync(`npx ${linter.command} ${linter.flags} --format compact`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        if (result.trim()) {
          details = result.split('\n')[0]; // 첫 번째 오류만 표시
        }
      } catch (error) {
        if (error.stdout) {
          details = error.stdout.split('\n')[0]; // 첫 번째 오류만 표시
        }
      }
    }

    summary += `| ${linter.name} | ${statusEmoji} ${status} | ${details ? `\`${details}\`` : '-'} |\n`;
  });

  summary += '\n';

  // 최종 결과
  if (hasFailures) {
    summary += '## ❌ 최종 결과\n\n';
    summary += '다음 린터에서 문제가 발견되었습니다:\n\n';
    failedLinters.forEach(linter => {
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
      details: linter.failed ? getErrorDetails(linter) : null
    })),
    failed_linters: failedLinters.map(linter => ({
      name: linter.name,
      details: getErrorDetails(linter)
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

function getErrorDetails(linter) {
  try {
    const { execSync } = require('child_process');
    const result = execSync(`npx ${linter.command} ${linter.flags} --format compact`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return result.trim() ? result.split('\n')[0] : null;
  } catch (error) {
    return error.stdout ? error.stdout.split('\n')[0] : null;
  }
}

// 스크립트 실행
try {
  collectResults();
} catch (error) {
  console.error('결과 수집 중 오류 발생:', error);
  process.exit(1);
} 