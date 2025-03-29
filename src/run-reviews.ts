import * as core from '@actions/core';
import { ReviewerManager } from './reviewers/reviewer-manager';

async function runReviews() {
  try {
    // 디버그 모드 확인
    const isDebug = process.env.DEBUG === 'true';
    if (isDebug) {
      core.info('디버그 모드가 활성화되었습니다.');
      core.debug('환경 변수:');
      Object.entries(process.env).forEach(([key, value]) => {
        if (key.includes('REVIEWER') || key.includes('GITHUB')) {
          core.debug(`${key}: ${value}`);
        }
      });
    }

    // 환경 변수에서 설정 가져오기
    const enabledReviewers = process.env.ENABLED_REVIEWERS?.split(',').filter(Boolean) || [];
    
    if (enabledReviewers.length === 0) {
      core.warning('활성화된 리뷰어가 없습니다.');
      return;
    }

    // ReviewerManager 인스턴스 생성
    const manager = new ReviewerManager();

    // 활성화된 리뷰어 등록
    for (const reviewerName of enabledReviewers) {
      try {
        if (isDebug) {
          core.debug(`${reviewerName} 리뷰어 설정을 로드합니다...`);
        }

        // 리뷰어 설정 구성
        const config = {
          enabled: process.env[`${reviewerName.toUpperCase()}_REVIEWER_ENABLED`] === 'true',
          apiKey: process.env[`${reviewerName.toUpperCase()}_REVIEWER_API_KEY`] || '',
          model: process.env[`${reviewerName.toUpperCase()}_REVIEWER_MODEL`] || '',
          maxTokens: parseInt(process.env[`${reviewerName.toUpperCase()}_REVIEWER_MAX_TOKENS`] || '1000'),
          temperature: parseFloat(process.env[`${reviewerName.toUpperCase()}_REVIEWER_TEMPERATURE`] || '0.7'),
          filePatterns: process.env[`${reviewerName.toUpperCase()}_REVIEWER_FILE_PATTERNS`]?.split(',') || [],
          excludePatterns: process.env[`${reviewerName.toUpperCase()}_REVIEWER_EXCLUDE_PATTERNS`]?.split(',') || []
        };

        if (!config.enabled) {
          core.info(`${reviewerName} 리뷰어가 설정에서 비활성화되어 있습니다.`);
          continue;
        }

        if (isDebug) {
          core.debug(`${reviewerName} 리뷰어 설정: ${JSON.stringify(config, null, 2)}`);
        }

        // 리뷰어 동적 로드 및 등록
        try {
          const ReviewerClass = await import(`./reviewers/${reviewerName}-reviewer`);
          if (ReviewerClass) {
            const reviewer = new ReviewerClass.default({
              workdir: process.env.WORKSPACE_PATH || '.',
              ...config
            });

            if (await reviewer.isEnabled()) {
              manager.registerReviewer(reviewer);
              core.info(`${reviewerName} 리뷰어가 등록되었습니다.`);
            } else {
              core.warning(`${reviewerName} 리뷰어가 비활성화되어 있습니다.`);
            }
          }
        } catch (error: any) {
          core.warning(`${reviewerName} 리뷰어 모듈을 찾을 수 없습니다: ${error.message}`);
          if (isDebug) {
            core.debug(`모듈 로드 오류 상세: ${error.stack}`);
          }
        }
      } catch (error) {
        core.warning(`${reviewerName} 리뷰어 로드 중 오류 발생: ${error}`);
        if (isDebug && error instanceof Error) {
          core.debug(`스택 트레이스: ${error.stack || error.message}`);
        }
      }
    }

    // 리뷰 실행
    await manager.runReviews();
    core.info('모든 리뷰가 완료되었습니다.');

  } catch (error) {
    core.error(`리뷰 실행 중 오류 발생: ${error}`);
    if (process.env.DEBUG === 'true' && error instanceof Error) {
      core.debug(`스택 트레이스: ${error.stack || error.message}`);
    }
    if (process.env.FAIL_ON_ERROR === 'true') {
      core.setFailed(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }
}

// 스크립트가 직접 실행될 때만 실행
if (require.main === module) {
  runReviews();
} 