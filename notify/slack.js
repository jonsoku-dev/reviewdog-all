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
  
  // 각 린터의 결과 파싱
  const linterResults = {};
  let overallStatus = '통과';
  
  results.forEach(line => {
    if (line.includes(':')) {
      const [linter, result] = line.split(':').map(s => s.trim());
      if (linter && result) {
        linterResults[linter] = {
          status: result.includes('✅') ? 'success' : 
                 result.includes('❌') ? 'failure' : 
                 result.includes('⏭️') ? 'skipped' : 'unknown',
          text: result
        };
        
        // 전체 상태 업데이트
        if (result.includes('❌')) {
          overallStatus = '실패';
        }
      }
    }
  });

  const statusConfig = {
    '통과': { emoji: '✅', color: '#36a64f' },
    '실패': { emoji: '❌', color: '#dc3545' }
  }[overallStatus];

  const message = {
    channel: SLACK_CHANNEL,
    username: SLACK_USERNAME || 'Lint Action Bot',
    icon_emoji: SLACK_ICON_EMOJI || ':lint:',
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${statusConfig.emoji} 린트 검사 결과: ${overallStatus}`,
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
  Object.entries(linterResults).forEach(([linter, result]) => {
    message.attachments[0].blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${result.text}`
      }
    });
  });

  // 전체 결과 상태 추가
  const overallResult = results.find(line => line.includes('전체 상태:'));
  if (overallResult) {
    message.attachments[0].blocks.push(
      {
        type: "divider"
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: overallResult.trim()
          }
        ]
      }
    );
  }

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