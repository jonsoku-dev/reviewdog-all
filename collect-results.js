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

  let summary = '# 린트 검사 결과 요약\n\n';
  summary += '## 전체 결과\n\n';

  // 각 린터의 결과 추가
  const failedLinters = [];
  linters.forEach(linter => {
    if (linter.skip) {
      summary += `### ${linter.name}: ⏭️ 스킵됨\n\n`;
    } else {
      if (!linter.failed) {
        summary += `### ${linter.name}: ✅ 통과\n\n`;
      } else {
        failedLinters.push(linter.name);
        summary += `### ${linter.name}: ❌ 실패\n\n`;
        try {
          const { execSync } = require('child_process');
          const result = execSync(`npx ${linter.command} ${linter.flags} --format compact`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
          summary += '```\n' + result + '```\n\n';
        } catch (error) {
          if (error.stdout) {
            summary += '```\n' + error.stdout + '```\n\n';
          }
        }
      }
    }
  });

  // 상세 정보 추가
  summary += '## 상세 정보\n\n';
  summary += `* 워크플로우 실행: [링크](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID})\n`;
  summary += `* 커밋: [\`${GITHUB_SHA.slice(0, 7)}\`](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/commit/${GITHUB_SHA})\n`;

  // PR 정보 추가
  if (GITHUB_EVENT_NAME === 'pull_request') {
    const event = JSON.parse(fs.readFileSync(GITHUB_EVENT_PATH, 'utf8'));
    summary += `* PR: [#${event.pull_request.number}](${event.pull_request.html_url})\n`;
  }

  // 전체 상태 추가
  summary += '\n## 최종 결과\n\n';
  if (failedLinters.length > 0) {
    summary += `❌ 다음 린터에서 문제가 발견되었습니다: ${failedLinters.join(', ')}\n`;
  } else {
    summary += '✅ 모든 검사가 통과되었습니다.\n';
  }

  // 결과를 GITHUB_STEP_SUMMARY에 저장
  fs.writeFileSync(GITHUB_STEP_SUMMARY, summary);

  // Slack 통지를 위한 환경 변수 설정
  const lintResults = [
    '린트 검사 결과 요약:',
    '-------------------'
  ];

  linters.forEach(linter => {
    if (linter.skip) {
      lintResults.push(`${linter.name}: ⏭️ 스킵됨`);
    } else {
      lintResults.push(`${linter.name}: ${!linter.failed ? '✅ 통과' : '❌ 실패'}`);
    }
  });

  lintResults.push('-------------------');
  lintResults.push(failedLinters.length > 0 ? '전체 상태: ❌ 일부 검사 실패' : '전체 상태: ✅ 모든 검사 통과');

  fs.writeFileSync(process.env.GITHUB_ENV, `LINT_RESULTS<<EOF\n${lintResults.join('\n')}\nEOF\n`, { flag: 'a' });
}

// 스크립트 실행
try {
  collectResults();
} catch (error) {
  console.error('결과 수집 중 오류 발생:', error);
  process.exit(1);
} 