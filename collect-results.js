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

  let summary = '# 일부 검사가 실패했습니다\n\n';

  // 저장소 정보
  summary += '## 저장소:\n';
  summary += `jonsoku-dev/reviewdog-all\n\n`;

  // 브랜치/PR 정보
  summary += '## 브랜치/PR:\n';
  if (GITHUB_EVENT_NAME === 'pull_request') {
    const event = JSON.parse(fs.readFileSync(GITHUB_EVENT_PATH, 'utf8'));
    summary += `PR #${event.pull_request.number}\n\n`;
  }

  // 커밋 정보
  summary += '## 커밋:\n';
  summary += `${GITHUB_SHA.slice(0, 7)}\n\n`;

  // 워크플로우 정보
  summary += '## 워크플로우:\n';
  summary += `보기\n\n`;

  // 상세 검사 결과
  summary += '## 상세 검사 결과\n\n';

  // 각 린터의 결과 추가
  const failedLinters = [];
  linters.forEach(linter => {
    if (linter.skip) {
      summary += `${linter.name}: ⏭️ 스킵됨\n`;
    } else {
      if (!linter.failed) {
        summary += `${linter.name}: ✅ 통과\n`;
      } else {
        failedLinters.push(linter.name);
        summary += `${linter.name}: ❌ 실패\n`;
        try {
          const { execSync } = require('child_process');
          const result = execSync(`npx ${linter.command} ${linter.flags} --format compact`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
          if (result.trim()) {
            summary += '```\n' + result + '```\n';
          }
        } catch (error) {
          if (error.stdout) {
            summary += '```\n' + error.stdout + '```\n';
          }
        }
      }
    }
  });

  // 최종 결과
  if (failedLinters.length > 0) {
    summary += `\n❌ 최종 결과: 3개의 린터에서 총 0개의 문제가 발견되었습니다.\n`;
    summary += `자세한 내용은 여기에서 확인하실 수 있습니다.\n`;
  } else {
    summary += '\n✅ 모든 검사가 통과되었습니다.\n';
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