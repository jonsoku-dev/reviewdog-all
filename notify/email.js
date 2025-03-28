const nodemailer = require('nodemailer');
const axios = require('axios');

async function sendEmailNotification() {
  const {
    EMAIL_SERVER_TYPE,
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USERNAME,
    EMAIL_PASSWORD,
    EMAIL_FROM,
    EMAIL_TO,
    LINT_RESULTS,
    GITHUB_REPOSITORY,
    GITHUB_SHA,
    GITHUB_REF,
    GITHUB_WORKFLOW,
    GITHUB_RUN_ID
  } = process.env;

  if (!EMAIL_HOST || !EMAIL_FROM || !EMAIL_TO) {
    throw new Error('필수 이메일 설정이 누락되었습니다.');
  }

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

  // 상태 이모지 결정
  const statusEmoji = totals.errors > 0 ? '🚨' : totals.warnings > 0 ? '⚠️' : '✅';

  const emailContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { font-size: 24px; margin-bottom: 20px; }
        .info-table { width: 100%; margin-bottom: 20px; border-collapse: collapse; }
        .info-table td { padding: 8px; border: 1px solid #ddd; }
        .info-table td:first-child { font-weight: bold; width: 120px; }
        .results { background: #f6f8fa; padding: 15px; border-radius: 6px; font-family: monospace; }
        .summary { margin: 20px 0; padding: 10px; background: ${totals.errors > 0 ? '#ffebe9' : totals.warnings > 0 ? '#fff8c5' : '#dafbe1'}; border-radius: 6px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${statusEmoji} 린트 검사 결과
        </div>
        
        <table class="info-table">
          <tr>
            <td>저장소</td>
            <td>${GITHUB_REPOSITORY}</td>
          </tr>
          <tr>
            <td>브랜치</td>
            <td>${GITHUB_REF}</td>
          </tr>
          <tr>
            <td>커밋</td>
            <td><code>${GITHUB_SHA.slice(0, 7)}</code></td>
          </tr>
        </table>

        <div class="summary">
          <strong>검사 요약:</strong><br>
          총 오류: ${totals.errors}개<br>
          총 경고: ${totals.warnings}개
        </div>

        <div class="results">
          <pre>${results.join('\n')}</pre>
        </div>

        <div class="footer">
          <a href="https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}">
            워크플로우 실행 보기
          </a>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailSubject = `[Lint Report] ${statusEmoji} ${GITHUB_REPOSITORY} - ${totals.errors ? '오류 발생' : totals.warnings ? '경고 발생' : '정상'}`;

  if (EMAIL_SERVER_TYPE === 'enterprise') {
    // Enterprise 메일 API 사용
    try {
      await axios.post(EMAIL_HOST, {
        from: EMAIL_FROM,
        to: EMAIL_TO.split(','),
        subject: emailSubject,
        html: emailContent
      }, {
        headers: {
          'Authorization': `Bearer ${EMAIL_PASSWORD}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Enterprise 이메일 전송 완료');
    } catch (error) {
      console.error('❌ Enterprise 이메일 전송 실패:', error.response?.data || error.message);
      throw error;
    }
  } else {
    // SMTP 서버 사용
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: parseInt(EMAIL_PORT),
      secure: EMAIL_PORT === '465',
      auth: {
        user: EMAIL_USERNAME,
        pass: EMAIL_PASSWORD
      }
    });

    try {
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: EMAIL_TO,
        subject: emailSubject,
        html: emailContent
      });
      console.log('✅ SMTP 이메일 전송 완료');
    } catch (error) {
      console.error('❌ SMTP 이메일 전송 실패:', error);
      throw error;
    }
  }
}

// 스크립트 실행
sendEmailNotification().catch(error => {
  console.error('통지 전송 중 오류 발생:', error);
  process.exit(1);
}); 