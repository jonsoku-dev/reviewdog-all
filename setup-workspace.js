const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

function setupWorkspace(inputs) {
  // 프로젝트 루트의 package.json 확인
  const rootPackageJson = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(rootPackageJson)) {
    console.log('프로젝트에 package.json이 존재합니다. 기존 환경을 사용합니다.');
    return process.cwd();
  }

  // 임시 디렉토리 생성
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-action-'));
  
  // GITHUB_ENV에 TEMP_DIR 추가
  fs.appendFileSync(process.env.GITHUB_ENV, `TEMP_DIR=${tempDir}\n`);
  process.env.TEMP_DIR = tempDir;

  // package.json 생성
  const packageJson = {
    name: 'lint-tools',
    version: '1.0.0',
    private: true
  };

  fs.writeFileSync(
    path.join(tempDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // 필요한 패키지 결정
  const packages = [];
  
  if (inputs.skip_eslint !== 'true') {
    packages.push(
      'eslint@^8.0.0',
      'prettier@latest',  // ESLint에서 Prettier를 사용하기 위해 필요
      'eslint-config-prettier',
      'eslint-plugin-prettier'
    );
  }

  if (inputs.skip_stylelint !== 'true') {
    packages.push('stylelint@latest');
  }

  if (inputs.skip_markdownlint !== 'true') {
    packages.push('markdownlint-cli@latest');
  }

  // 패키지 설치
  if (packages.length > 0) {
    try {
      process.chdir(tempDir);
      execSync(`npm install --no-package-lock ${packages.join(' ')}`, {
        stdio: 'inherit'
      });
      
      // PATH에 node_modules/.bin 추가
      const binPath = path.join(tempDir, 'node_modules', '.bin');
      fs.appendFileSync(process.env.GITHUB_PATH, `${binPath}\n`);
      
      console.log('패키지 설치 완료:', packages.join(', '));
    } catch (error) {
      console.error('패키지 설치 중 오류 발생:', error);
      throw error;
    }
  }

  console.log('작업 디렉토리:', tempDir);
  return tempDir;
}

// GitHub Actions 입력 값 가져오기
const inputs = {
  skip_eslint: process.env.INPUT_SKIP_ESLINT,
  skip_stylelint: process.env.INPUT_SKIP_STYLELINT,
  skip_markdownlint: process.env.INPUT_SKIP_MARKDOWNLINT
};

// 작업 공간 설정 실행
setupWorkspace(inputs); 