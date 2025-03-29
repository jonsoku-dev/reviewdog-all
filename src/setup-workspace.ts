/// <reference types="node" />

import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { ExecSyncOptionsWithStringEncoding } from 'child_process';

// 타입 정의
interface ActionInputs {
  skip_eslint: string;
  skip_stylelint: string;
  skip_markdownlint: string;
  skip_ai_review: string;
  skip_accessibility: string;
}

interface PackagesList {
  dependencies: string[];
  devDependencies: string[];
}

// 에러 타입 정의
interface ExecError extends Error {
  stdout?: string;
  stderr?: string;
}

function getOptionalDependencies(inputs: ActionInputs): PackagesList {
  const packages: PackagesList = {
    dependencies: [],
    devDependencies: []
  };

  // 기본 패키지는 package.json에 이미 포함되어 있으므로 건너뜁니다.
  console.log('\n📦 선택적 패키지 확인 중...');

  // ESLint 관련 패키지 스킵 여부 확인
  if (inputs.skip_eslint === 'true') {
    console.log('  ⏩ ESLint 패키지 스킵됨');
  } else {
    console.log('  ✓ ESLint 패키지 포함됨');
  }

  // Stylelint 관련 패키지 스킵 여부 확인
  if (inputs.skip_stylelint === 'true') {
    console.log('  ⏩ Stylelint 패키지 스킵됨');
  } else {
    console.log('  ✓ Stylelint 패키지 포함됨');
  }

  // Markdownlint 관련 패키지 스킵 여부 확인
  if (inputs.skip_markdownlint === 'true') {
    console.log('  ⏩ Markdownlint 패키지 스킵됨');
  } else {
    console.log('  ✓ Markdownlint 패키지 포함됨');
  }

  // AI 코드 리뷰 관련 패키지 스킵 여부 확인
  if (inputs.skip_ai_review === 'true') {
    console.log('  ⏩ AI 코드 리뷰 패키지 스킵됨');
  } else {
    console.log('  ✓ AI 코드 리뷰 패키지 포함됨');
  }

  // 접근성 검사 관련 패키지 스킵 여부 확인
  if (inputs.skip_accessibility === 'true') {
    console.log('  ⏩ 접근성 검사 패키지 스킵됨');
  } else {
    console.log('  ✓ 접근성 검사 패키지 포함됨');
  }

  return packages;
}

function setupWorkspace(inputs: ActionInputs): void {
  console.log('\n=== 작업 공간 설정 시작 ===');
  
  const workdir = process.env.INPUT_WORKDIR || '.';
  
  try {
    console.log('\n⬇️ 패키지 설치 중...');
    process.chdir(workdir);
    
    // npm cache를 정리
    console.log('npm cache 정리 중...');
    execSync('npm cache clean --force', { stdio: 'inherit' });
    
    // package-lock.json이 있다면 삭제
    if (fsSync.existsSync('package-lock.json')) {
      console.log('기존 package-lock.json 삭제 중...');
      fsSync.unlinkSync('package-lock.json');
    }
    
    // node_modules가 있다면 삭제
    if (fsSync.existsSync('node_modules')) {
      console.log('기존 node_modules 삭제 중...');
      fsSync.rmSync('node_modules', { recursive: true, force: true });
    }
    
    // 전체 패키지 설치
    console.log('패키지 설치 중...');
    execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
    
    console.log('✓ 패키지 설치 완료');
    
    // 설치된 버전 확인
    console.log('\n📋 설치된 패키지 버전 확인:');
    execSync('npm list --depth=0', {
      stdio: 'inherit'
    });
    
    // PATH에 node_modules/.bin 추가
    console.log('\n🔄 PATH 환경 변수 업데이트 중...');
    const binPath = path.join(process.cwd(), 'node_modules', '.bin');
    if (process.env.GITHUB_PATH) {
      fsSync.appendFileSync(process.env.GITHUB_PATH, `${binPath}\n`);
      console.log('✓ node_modules/.bin을 PATH에 추가함');
    }
    
    console.log('\n=== 작업 공간 설정 완료 ===');
    console.log('📍 작업 디렉토리:', workdir);
  } catch (error) {
    const execError = error as ExecError;
    console.error('\n❌ 작업 공간 설정 중 오류 발생:');
    console.error('오류 메시지:', execError.message);
    if (execError.stdout) console.error('표준 출력:', execError.stdout.toString());
    if (execError.stderr) console.error('오류 출력:', execError.stderr.toString());
    throw error;
  }
}

// GitHub Actions 입력 값 가져오기 및 로깅
console.log('\n=== 설정값 ===');
const inputs: ActionInputs = {
  skip_eslint: process.env.INPUT_SKIP_ESLINT || 'false',
  skip_stylelint: process.env.INPUT_SKIP_STYLELINT || 'false',
  skip_markdownlint: process.env.INPUT_SKIP_MARKDOWNLINT || 'false',
  skip_ai_review: process.env.INPUT_SKIP_AI_REVIEW || 'false',
  skip_accessibility: process.env.INPUT_SKIP_ACCESSIBILITY || 'false'
};

console.log('환경변수 디버그 정보:');
Object.keys(process.env).forEach(key => {
  if (key.startsWith('INPUT_')) {
    console.log(`${key}:`, process.env[key]);
  }
});

console.log('\n설정된 입력값:');
Object.entries(inputs).forEach(([key, value]) => {
  console.log(`${key}: ${value}`);
});

// 작업 공간 설정 실행
try {
  setupWorkspace(inputs);
} catch (error) {
  console.error('\n❌ 작업 공간 설정 실패');
  process.exit(1);
}