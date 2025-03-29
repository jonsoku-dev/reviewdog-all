import * as core from '@actions/core';
import { ReviewerManager } from './reviewers/reviewer-manager';

async function runReviews() {
  try {
    // 환경 변수에서 설정 가져오기
    const enabledReviewers = process.env.ENABLED_REVIEWERS?.split(',') || [];
    
    if (enabledReviewers.length === 0) {
      core.warning('활성화된 리뷰어가 없습니다.');
      return;
    }

    // ReviewerManager 인스턴스 생성
    const manager = new ReviewerManager();

    // 활성화된 리뷰어 등록
    for (const reviewerName of enabledReviewers) {
      try {
        // 리뷰어 설정 가져오기
        const configEnvKey = `${reviewerName.toUpperCase()}_REVIEWER_CONFIG`;
        const config = process.env[configEnvKey] ? JSON.parse(process.env[configEnvKey]) : {};

        if (!config.enabled) {
          core.info(`${reviewerName} 리뷰어가 설정에서 비활성화되어 있습니다.`);
          continue;
        }

        // 리뷰어 동적 로드 및 등록
        const ReviewerClass = await import(`./reviewers/${reviewerName}-reviewer`).then(m => m.default || m[`${reviewerName}Reviewer`]);
        if (ReviewerClass) {
          const reviewer = new ReviewerClass({
            workdir: process.env.GITHUB_WORKSPACE || '.',
            ...config
          });

          if (await reviewer.isEnabled()) {
            manager.registerReviewer(reviewer);
            core.info(`${reviewerName} 리뷰어가 등록되었습니다.`);
          } else {
            core.warning(`${reviewerName} 리뷰어가 비활성화되어 있습니다.`);
          }
        } else {
          core.warning(`${reviewerName} 리뷰어를 찾을 수 없습니다.`);
        }
      } catch (error) {
        core.warning(`${reviewerName} 리뷰어 로드 중 오류 발생: ${error}`);
      }
    }

    // 리뷰 실행
    await manager.runReviews();
    core.info('모든 리뷰가 완료되었습니다.');

  } catch (error) {
    core.error(`리뷰 실행 중 오류 발생: ${error}`);
    if (process.env.FAIL_ON_ERROR === 'true') {
      core.setFailed(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }
}

// 스크립트가 직접 실행될 때만 실행
if (require.main === module) {
  runReviews();
} 