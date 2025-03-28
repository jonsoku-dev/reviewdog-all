const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

function setupWorkspace(inputs) {
  console.log('\n=== 작업 공간 설정 시작 ===');
  
  // 임시 디렉토리 생성
  console.log('\n📁 임시 디렉토리 생성 중...');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-action-'));
  console.log('✓ 임시 디렉토리 생성됨:', tempDir);
  
  // GITHUB_ENV에 TEMP_DIR 추가
  console.log('\n🔧 환경 변수 설정 중...');
  fs.appendFileSync(process.env.GITHUB_ENV, `TEMP_DIR=${tempDir}\n`);
  process.env.TEMP_DIR = tempDir;
  console.log('✓ TEMP_DIR 환경 변수 설정됨');

  // package.json 생성
  console.log('\n📄 package.json 생성 중...');
  const packageJson = {
    name: 'lint-tools',
    version: '1.0.0',
    private: true,
    type: "module"
  };

  fs.writeFileSync(
    path.join(tempDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  console.log('✓ package.json 생성됨');

  // 필요한 패키지 목록
  const packages = [
    // ESLint 관련
    'eslint@^8.0.0',
    'prettier@latest',
    'eslint-config-prettier',
    'eslint-plugin-prettier',
    '@babel/core',
    '@babel/eslint-parser',
    '@babel/preset-env',
    'eslint-plugin-import',
    'eslint-plugin-node',
    
    // Stylelint 관련
    'stylelint@latest',
    'stylelint-config-standard',
    
    // Markdownlint 관련
    'markdownlint-cli@latest'
  ];

  console.log('\n📦 패키지 설치 준비...');
  console.log('설치할 패키지 목록:');
  packages.forEach(pkg => console.log(`  - ${pkg}`));

  try {
    // 패키지 설치 (프로젝트 루트에 node_modules가 있는 경우 재사용)
    const rootNodeModules = path.join(process.cwd(), 'node_modules');
    if (fs.existsSync(rootNodeModules)) {
      console.log('\n♻️ 기존 node_modules 재사용 중...');
      fs.symlinkSync(rootNodeModules, path.join(tempDir, 'node_modules'), 'junction');
      console.log('✓ node_modules 심볼릭 링크 생성됨');
    } else {
      console.log('\n⬇️ 새로운 패키지 설치 중...');
      process.chdir(tempDir);
      execSync(`npm install --no-package-lock ${packages.join(' ')}`, {
        stdio: 'inherit'
      });
      console.log('✓ 패키지 설치 완료');
    }
    
    // PATH에 node_modules/.bin 추가
    console.log('\n🔄 PATH 환경 변수 업데이트 중...');
    const binPath = path.join(tempDir, 'node_modules', '.bin');
    fs.appendFileSync(process.env.GITHUB_PATH, `${binPath}\n`);
    console.log('✓ node_modules/.bin을 PATH에 추가함');
    
    console.log('\n=== 작업 공간 설정 완료 ===');
    console.log('📍 작업 디렉토리:', tempDir);
  } catch (error) {
    console.error('\n❌ 작업 공간 설정 중 오류 발생:');
    console.error('오류 메시지:', error.message);
    if (error.stdout) console.error('표준 출력:', error.stdout.toString());
    if (error.stderr) console.error('오류 출력:', error.stderr.toString());
    throw error;
  }

  return tempDir;
}

// GitHub Actions 입력 값 가져오기 및 로깅
console.log('\n=== 설정값 ===');
const inputs = {
  skip_eslint: process.env.INPUT_SKIP_ESLINT,
  skip_stylelint: process.env.INPUT_SKIP_STYLELINT,
  skip_markdownlint: process.env.INPUT_SKIP_MARKDOWNLINT
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