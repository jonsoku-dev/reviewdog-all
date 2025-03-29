import * as core from '@actions/core';
import { ReviewerManager } from './reviewers/reviewer-manager';
import { createReviewer } from './reviewers';

async function runReviews() {
  try {
    // 디버그 모드 확인
    const isDebug = process.env.DEBUG === 'true';
    if (isDebug) {
      core.info('디버그 모드가 활성화되었습니다.');
    }

    // 환경 변수에서 설정 가져오기
    const enabledReviewers = process.env.ENABLED_REVIEWERS?.split(',').filter(Boolean) || [];

    if (enabledReviewers.length === 0) {
      core.warning('활성화된 리뷰어가 없습니다.');
      return;
    }

    // ReviewerManager 인스턴스 생성
    const manager = new ReviewerManager({
      workdir: process.env.WORKSPACE_PATH || '.',
      debug: isDebug
    });

    // 활성화된 리뷰어 등록
    for (const reviewerType of enabledReviewers) {
      try {
        if (isDebug) {
          core.debug(`${reviewerType} 리뷰어 생성 시도...`);

        }

        if (!process.env) {
          core.warning('환경 변수가 없습니다.');
        }

        const reviewer = createReviewer(reviewerType, process.env);
        if (reviewer) {
          manager.registerReviewer(reviewer);
          core.info(`${reviewerType} 리뷰어가 등록되었습니다.`);
        } else {
          core.warning(`${reviewerType} 리뷰어를 생성할 수 없습니다.`);
        }
      } catch (error) {
        core.warning(`${reviewerType} 리뷰어 생성 중 오류 발생: ${error}`);
        if (isDebug && error instanceof Error) {
          core.debug(`스택 트레이스: ${error.stack}`);
        }
      }
    }

    // 리뷰 실행
    await manager.runReviews();
    core.info('모든 리뷰가 완료되었습니다.');

  } catch (error) {
    core.error(`리뷰 실행 중 오류 발생: ${error}`);
    if (process.env.DEBUG === 'true' && error instanceof Error) {
      core.debug(`스택 트레이스: ${error.stack}`);
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