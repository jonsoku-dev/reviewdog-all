const https = require('https');
const url = require('url');

async function sendSlackNotification() {
  const {
    SLACK_WEBHOOK_URL,
    SLACK_CHANNEL,
    SLACK_USERNAME,
    SLACK_ICON_EMOJI,
    LINT_RESULTS,
    GITHUB_SERVER_URL = 'https://github.com'
  } = process.env;

  if (!SLACK_WEBHOOK_URL) {
    throw new Error('SLACK_WEBHOOK_URL이 설정되지 않았습니다.');
  }

  // Enterprise Slack URL 처리
  const webhookUrl = SLACK_WEBHOOK_URL.startsWith('slack://')
    ? `https://${SLACK_WEBHOOK_URL.slice(8)}/api/chat.postMessage`
    : SLACK_WEBHOOK_URL;

  // 린트 결과 파싱
  const results = JSON.parse(LINT_RESULTS);
  
  const statusConfig = {
    'success': { emoji: '✅', color: '#36a64f', header: '모든 검사가 통과되었습니다' },
    'failed': { emoji: '❌', color: '#dc3545', header: '일부 검사가 실패했습니다' }
  }[results.status];

  const message = {
    channel: SLACK_CHANNEL,
    username: SLACK_USERNAME || 'Lint Action Bot',
    icon_emoji: SLACK_ICON_EMOJI || ':lint:',
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${statusConfig.emoji} ${statusConfig.header}`,
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
            text: `*저장소*\n<${results.repository_url}|${results.repository}>`
          },
          {
            type: "mrkdwn",
            text: `*커밋*\n<${results.commit_url}|\`${results.commit}\`>`
          }
        ]
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

  // PR 정보가 있는 경우 추가
  if (results.pr) {
    message.blocks.push({
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*PR*\n<${results.pr.url}|#${results.pr.number}>`
        },
        {
          type: "mrkdwn",
          text: `*브랜치*\n\`${results.pr.head}\` → \`${results.pr.base}\``
        }
      ]
    });
  }

  // 각 린터별 결과 추가
  results.results.forEach(result => {
    const statusEmoji = {
      success: '✅',
      failed: '❌',
      skipped: '⏭️'
    }[result.status];

    const statusText = result.status === 'failed' ? '실패' : result.status === 'success' ? '통과' : '스킵됨';
    let text = `${statusEmoji} *${result.name}*: ${statusText}`;
    
    if (result.details) {
      // AI 리뷰와 접근성 검사 결과에 대한 특별 처리
      if (result.name === 'AI 코드 리뷰') {
        const aiDetails = typeof result.details === 'string' ? result.details : JSON.stringify(result.details);
        text += `\n*리뷰 결과:*\n${aiDetails}`;
        
        // AI 리뷰 파일이 있는 경우 추가
        if (result.reviewFilePath) {
          try {
            const reviewContent = require('fs').readFileSync(result.reviewFilePath, 'utf8');
            text += `\n\n*상세 리뷰 내용:*\n${reviewContent}`;
          } catch (error) {
            console.warn('AI 리뷰 파일을 읽을 수 없습니다:', error);
          }
        }
      } else if (result.name === '접근성 검사' && result.status === 'failed') {
        text += `\n${result.details}`;
      } else {
        text += `\n\`\`\`${result.details}\`\`\``;
      }
    }

    message.attachments[0].blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: text
      }
    });
  });

  // 실패한 경우 추가 정보
  if (results.status === 'failed' && results.failed_linters.length > 0) {
    message.attachments[0].blocks.push(
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*실패한 린터 상세:*"
        }
      }
    );

    results.failed_linters.forEach(linter => {
      if (linter.details) {
        let detailsText = linter.details;
        
        // AI 리뷰와 접근성 검사에 대한 특별 처리
        if (linter.name === 'AI 코드 리뷰') {
          const aiDetails = typeof linter.details === 'string' ? linter.details : JSON.stringify(linter.details);
          detailsText = `*리뷰 결과:*\n${aiDetails}`;
          
          // AI 리뷰 파일이 있는 경우 추가
          if (linter.reviewFilePath) {
            try {
              const reviewContent = require('fs').readFileSync(linter.reviewFilePath, 'utf8');
              detailsText += `\n\n*상세 리뷰 내용:*\n${reviewContent}`;
            } catch (error) {
              console.warn('AI 리뷰 파일을 읽을 수 없습니다:', error);
            }
          }
        } else if (linter.name === '접근성 검사') {
          detailsText = `${linter.details}`;
        } else {
          detailsText = `\`\`\`${linter.details}\`\`\``;
        }

        message.attachments[0].blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${linter.name}*:\n${detailsText}`
          }
        });
      }
    });
  }

  // 워크플로우 링크 추가
  message.attachments[0].blocks.push(
    {
      type: "divider"
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `자세한 내용은 <${results.workflow_url}|워크플로우>에서 확인하실 수 있습니다.`
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