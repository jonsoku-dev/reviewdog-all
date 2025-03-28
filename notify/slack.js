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
    GITHUB_RUN_ID,
    GITHUB_SERVER_URL = 'https://github.com'
  } = process.env;

  if (!SLACK_WEBHOOK_URL) {
    throw new Error('SLACK_WEBHOOK_URL이 설정되지 않았습니다.');
  }

  // Enterprise Slack URL 처리
  const webhookUrl = SLACK_WEBHOOK_URL.startsWith('slack://')
    ? `https://${SLACK_WEBHOOK_URL.slice(8)}/api/chat.postMessage`
    : SLACK_WEBHOOK_URL;

  // GitHub 링크 생성 헬퍼 함수
  const createGitHubLinks = () => {
    const repoUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}`;
    const commitUrl = `${repoUrl}/commit/${GITHUB_SHA}`;
    const workflowUrl = `${repoUrl}/actions/runs/${GITHUB_RUN_ID}`;
    const prMatch = GITHUB_REF.match(/refs\/pull\/(\d+)\/merge/);
    const prNumber = prMatch ? prMatch[1] : null;
    const prUrl = prNumber ? `${repoUrl}/pull/${prNumber}` : null;
    const branch = GITHUB_REF.replace('refs/heads/', '').replace('refs/pull/', 'PR #').replace('/merge', '');
    
    return { repoUrl, commitUrl, workflowUrl, prUrl, branch };
  };

  // 린트 결과 파싱
  const results = LINT_RESULTS.split('\n').filter(line => line.trim());
  
  // 각 린터의 결과 파싱
  const linterResults = {};
  let overallStatus = '통과';
  let failedLinters = [];
  
  results.forEach(line => {
    if (line.includes(':')) {
      const [linter, result] = line.split(':').map(s => s.trim());
      if (linter && result) {
        const envVar = `${linter.toUpperCase()}_FAILED`;
        const hasFailed = process.env[envVar] === 'true';
        
        const status = hasFailed ? 'failure' :
                      result.includes('⏭️') ? 'skipped' : 'success';
        
        linterResults[linter] = {
          status,
          text: result
        };
        
        if (status === 'failure') {
          failedLinters.push(linter);
          overallStatus = '실패';
        }
      }
    }
  });

  const statusConfig = {
    '통과': { emoji: '✅', color: '#36a64f', header: '모든 검사가 통과되었습니다' },
    '실패': { emoji: '❌', color: '#dc3545', header: '일부 검사가 실패했습니다' }
  }[overallStatus];

  const { repoUrl, commitUrl, workflowUrl, prUrl, branch } = createGitHubLinks();

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
            text: `*저장소:*\n${GITHUB_REPOSITORY}`
          },
          {
            type: "mrkdwn",
            text: `*브랜치/PR:*\n${prUrl ? `PR #${prMatch[1]}` : branch}`
          }
        ]
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*커밋:*\n\`${GITHUB_SHA.slice(0, 7)}\``
          },
          {
            type: "mrkdwn",
            text: `*워크플로우:*\n보기`
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

  // 각 린터별 결과 추가
  Object.entries(linterResults).forEach(([linter, result]) => {
    const statusEmoji = {
      success: '✅',
      failure: '❌',
      skipped: '⏭️'
    }[result.status];

    message.attachments[0].blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${statusEmoji} *${linter}*: ${result.status === 'failure' ? '실패' : result.status === 'success' ? '통과' : '스킵됨'}`
      }
    });
  });

  // 최종 결과 추가
  message.attachments[0].blocks.push(
    {
      type: "divider"
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: failedLinters.length > 0 
            ? `❌ 최종 결과: 3개의 린터에서 총 0개의 문제가 발견되었습니다.\n자세한 내용은 <${workflowUrl}|여기>에서 확인하실 수 있습니다.`
            : `✅ 모든 검사가 통과되었습니다.`
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