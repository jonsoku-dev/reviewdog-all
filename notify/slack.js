const https = require('https');
const url = require('url');

async function sendSlackNotification() {
  const {
    SLACK_WEBHOOK_URL,
    SLACK_CHANNEL,
    SLACK_USERNAME,
    SLACK_ICON_EMOJI,
    LINT_RESULTS,
    GITHUB_REPOSITORY,
    GITHUB_SHA,
    GITHUB_REF,
    GITHUB_WORKFLOW,
    GITHUB_RUN_ID
  } = process.env;

  if (!SLACK_WEBHOOK_URL) {
    throw new Error('SLACK_WEBHOOK_URL이 설정되지 않았습니다.');
  }

  // Enterprise Slack URL 처리
  const webhookUrl = SLACK_WEBHOOK_URL.startsWith('slack://')
    ? `https://${SLACK_WEBHOOK_URL.slice(8)}/api/chat.postMessage`
    : SLACK_WEBHOOK_URL;

  // 린트 결과 파싱
  const results = LINT_RESULTS.split('\n').filter(line => line.trim());
  
  // 전체 오류/경고 수 계산
  const totals = results.reduce((acc, line) => {
    const errorMatch = line.match(/(\d+)\s+errors?/);
    const warningMatch = line.match(/(\d+)\s+warnings?/);
    if (errorMatch) acc.errors += parseInt(errorMatch[1]);
    if (warningMatch) acc.warnings += parseInt(warningMatch[1]);
    return acc;
  }, { errors: 0, warnings: 0 });

  // 상태 결정
  const status = totals.errors > 0 ? 'failure' : totals.warnings > 0 ? 'warning' : 'success';
  const statusConfig = {
    success: { emoji: '✅', color: '#36a64f', text: '성공' },
    warning: { emoji: '⚠️', color: '#ffd700', text: '경고' },
    failure: { emoji: '🚨', color: '#dc3545', text: '실패' }
  }[status];

  // 각 린터 결과 파싱
  const linterResults = {};
  results.forEach(line => {
    const [linter, counts] = line.split(':');
    if (counts) {
      const errorMatch = counts.match(/(\d+)\s+errors?/);
      const warningMatch = counts.match(/(\d+)\s+warnings?/);
      linterResults[linter.trim()] = {
        errors: errorMatch ? parseInt(errorMatch[1]) : 0,
        warnings: warningMatch ? parseInt(warningMatch[1]) : 0
      };
    }
  });

  const message = {
    channel: SLACK_CHANNEL,
    username: SLACK_USERNAME || 'Lint Action Bot',
    icon_emoji: SLACK_ICON_EMOJI || ':lint:',
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${statusConfig.emoji} 린트 검사 결과: ${statusConfig.text}`,
          emoji: true
        }
      },
      {
        type: "divider"
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*저장소:*\n<https://github.com/${GITHUB_REPOSITORY}|${GITHUB_REPOSITORY}>`
          },
          {
            type: "mrkdwn",
            text: `*브랜치:*\n${GITHUB_REF.replace('refs/heads/', '')}`
          }
        ]
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*커밋:*\n<https://github.com/${GITHUB_REPOSITORY}/commit/${GITHUB_SHA}|\`${GITHUB_SHA.slice(0, 7)}\`>`
          },
          {
            type: "mrkdwn",
            text: `*워크플로우:*\n<https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}|${GITHUB_WORKFLOW}>`
          }
        ]
      },
      {
        type: "divider"
      }
    ],
    attachments: [
      {
        color: statusConfig.color,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*상세 검사 결과*"
            }
          }
        ]
      }
    ]
  };

  // 각 린터별 결과 추가
  Object.entries(linterResults).forEach(([linter, counts]) => {
    const linterEmoji = counts.errors > 0 ? '🔴' : counts.warnings > 0 ? '🟡' : '🟢';
    message.attachments[0].blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${linterEmoji} *${linter}*\n오류: ${counts.errors} | 경고: ${counts.warnings}`
      }
    });
  });

  // 요약 정보 추가
  message.attachments[0].blocks.push(
    {
      type: "divider"
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `총계 - 오류: ${totals.errors} | 경고: ${totals.warnings}`
        }
      ]
    }
  );

  const parsedUrl = url.parse(webhookUrl);
  
  const options = {
    hostname: parsedUrl.hostname,
    path: parsedUrl.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  };

  // Enterprise API를 위한 인증 헤더 추가
  if (SLACK_WEBHOOK_URL.startsWith('slack://')) {
    options.headers['Authorization'] = `Bearer ${process.env.SLACK_TOKEN}`;
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Slack 통지 전송 완료');
          resolve();
        } else {
          reject(new Error(`Slack API 응답 오류: ${res.statusCode}\n응답: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Slack 통지 전송 실패:', error);
      reject(error);
    });

    req.write(JSON.stringify(message));
    req.end();
  });
}

// 스크립트 실행
sendSlackNotification().catch(error => {
  console.error('통지 전송 중 오류 발생:', error);
  process.exit(1);
}); 