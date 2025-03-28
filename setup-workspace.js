const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

function setupWorkspace(inputs) {
  // 임시 디렉토리 생성
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-action-'));
  
  // GITHUB_ENV에 TEMP_DIR 추가
  fs.appendFileSync(process.env.GITHUB_ENV, `TEMP_DIR=${tempDir}\n`);
  process.env.TEMP_DIR = tempDir;

  // package.json 생성
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

  try {
    // 패키지 설치 (프로젝트 루트에 node_modules가 있는 경우 재사용)
    const rootNodeModules = path.join(process.cwd(), 'node_modules');
    if (fs.existsSync(rootNodeModules)) {
      console.log('기존 node_modules를 재사용합니다.');
      fs.symlinkSync(rootNodeModules, path.join(tempDir, 'node_modules'), 'junction');
    } else {
      console.log('새로운 패키지를 설치합니다.');
      process.chdir(tempDir);
      execSync(`npm install --no-package-lock ${packages.join(' ')}`, {
        stdio: 'inherit'
      });
    }
    
    // PATH에 node_modules/.bin 추가
    const binPath = path.join(tempDir, 'node_modules', '.bin');
    fs.appendFileSync(process.env.GITHUB_PATH, `${binPath}\n`);
    
    console.log('패키지 설치 완료:', packages.join(', '));
    console.log('작업 디렉토리:', tempDir);
  } catch (error) {
    console.error('패키지 설치 중 오류 발생:', error);
    throw error;
  }

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