const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 의존성 설정 파일 로드
const dependencies = require('./configs/dependencies.json');

function getDependencies(inputs) {
  const packages = {
    dependencies: [],
    devDependencies: []
  };
  
  // ESLint 관련 패키지
  if (inputs.skip_eslint !== 'true') {
    console.log('\n📦 ESLint 패키지 추가 중...');
    Object.entries(dependencies.eslint).forEach(([category, deps]) => {
      console.log(`  [${category}]`);
      Object.entries(deps).forEach(([pkg, version]) => {
        packages.devDependencies.push(`${pkg}@${version}`);
        console.log(`    - ${pkg}@${version}`);
      });
    });
  }

  // Stylelint 관련 패키지
  if (inputs.skip_stylelint !== 'true') {
    console.log('\n📦 Stylelint 패키지 추가 중...');
    Object.entries(dependencies.stylelint).forEach(([category, deps]) => {
      console.log(`  [${category}]`);
      Object.entries(deps).forEach(([pkg, version]) => {
        packages.devDependencies.push(`${pkg}@${version}`);
        console.log(`    - ${pkg}@${version}`);
      });
    });
  }

  // Markdownlint 관련 패키지
  if (inputs.skip_markdownlint !== 'true') {
    console.log('\n📦 Markdownlint 패키지 추가 중...');
    Object.entries(dependencies.markdownlint).forEach(([category, deps]) => {
      console.log(`  [${category}]`);
      Object.entries(deps).forEach(([pkg, version]) => {
        packages.devDependencies.push(`${pkg}@${version}`);
        console.log(`    - ${pkg}@${version}`);
      });
    });
  }

  // AI 코드 리뷰 관련 패키지
  if (inputs.skip_ai_review !== 'true') {
    console.log('\n📦 AI 코드 리뷰 패키지 추가 중...');
    Object.entries(dependencies['ai-review']).forEach(([category, deps]) => {
      console.log(`  [${category}]`);
      Object.entries(deps).forEach(([pkg, version]) => {
        packages.dependencies.push(`${pkg}@${version}`);
        console.log(`    - ${pkg}@${version}`);
      });
    });
  }

  // 접근성 검사 관련 패키지
  if (inputs.skip_accessibility !== 'true') {
    console.log('\n📦 접근성 검사 패키지 추가 중...');
    Object.entries(dependencies.accessibility).forEach(([category, deps]) => {
      console.log(`  [${category}]`);
      Object.entries(deps).forEach(([pkg, version]) => {
        packages.dependencies.push(`${pkg}@${version}`);
        console.log(`    - ${pkg}@${version}`);
      });
    });
  }

  return packages;
}

function setupWorkspace(inputs) {
  console.log('\n=== 작업 공간 설정 시작 ===');
  
  const workdir = process.env.INPUT_WORKDIR || '.';
  
  // package.json 생성 (없는 경우에만)
  const packageJsonPath = path.join(workdir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.log('\n📄 package.json 생성 중...');
    const packageJson = {
      name: 'lint-tools',
      version: '1.0.0',
      private: true,
      engines: {
        node: ">=16"
      },
      dependencies: {},
      devDependencies: {}
    };

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✓ package.json 생성됨');
  }

  // 필요한 패키지 목록 생성
  const packages = getDependencies(inputs);

  try {
    console.log('\n⬇️ 패키지 설치 중...');
    process.chdir(workdir);
    
    // npm cache를 정리하고 패키지 설치
    console.log('npm cache 정리 중...');
    execSync('npm cache clean --force', { stdio: 'inherit' });
    
    // package-lock.json이 있다면 삭제
    if (fs.existsSync('package-lock.json')) {
      console.log('기존 package-lock.json 삭제 중...');
      fs.unlinkSync('package-lock.json');
    }
    
    // node_modules가 있다면 삭제
    if (fs.existsSync('node_modules')) {
      console.log('기존 node_modules 삭제 중...');
      fs.rmSync('node_modules', { recursive: true, force: true });
    }
    
    // 의존성 패키지 설치
    if (packages.dependencies.length > 0) {
      const installDepsCmd = `npm install --save --legacy-peer-deps ${packages.dependencies.join(' ')}`;
      console.log('의존성 패키지 설치 명령어:', installDepsCmd);
      execSync(installDepsCmd, { stdio: 'inherit' });
    }

    // 개발 의존성 패키지 설치
    if (packages.devDependencies.length > 0) {
      const installDevDepsCmd = `npm install --save-dev --legacy-peer-deps ${packages.devDependencies.join(' ')}`;
      console.log('개발 의존성 패키지 설치 명령어:', installDevDepsCmd);
      execSync(installDevDepsCmd, { stdio: 'inherit' });
    }

    console.log('✓ 패키지 설치 완료');
    
    // 설치된 버전 확인
    console.log('\n📋 설치된 패키지 버전 확인:');
    execSync('npm list --depth=0', {
      stdio: 'inherit'
    });
    
    // PATH에 node_modules/.bin 추가
    console.log('\n🔄 PATH 환경 변수 업데이트 중...');
    const binPath = path.join(process.cwd(), 'node_modules', '.bin');
    fs.appendFileSync(process.env.GITHUB_PATH, `${binPath}\n`);
    console.log('✓ node_modules/.bin을 PATH에 추가함');
    
    console.log('\n=== 작업 공간 설정 완료 ===');
    console.log('📍 작업 디렉토리:', workdir);
  } catch (error) {
    console.error('\n❌ 작업 공간 설정 중 오류 발생:');
    console.error('오류 메시지:', error.message);
    if (error.stdout) console.error('표준 출력:', error.stdout.toString());
    if (error.stderr) console.error('오류 출력:', error.stderr.toString());
    throw error;
  }
}

// GitHub Actions 입력 값 가져오기 및 로깅
console.log('\n=== 설정값 ===');
const inputs = {
  skip_eslint: process.env.INPUT_SKIP_ESLINT,
  skip_stylelint: process.env.INPUT_SKIP_STYLELINT,
  skip_markdownlint: process.env.INPUT_SKIP_MARKDOWNLINT,
  skip_ai_review: process.env.INPUT_SKIP_AI_REVIEW,
  skip_accessibility: process.env.INPUT_SKIP_ACCESSIBILITY
};

Object.entries(inputs).forEach(([key, value]) => {
  console.log(`${key}:`, value || '(기본값 사용)');
});

// 작업 공간 설정 실행
try {
  setupWorkspace(inputs);
} catch (error) {
  console.error('\n❌ 작업 공간 설정 실패');
  process.exit(1);
}