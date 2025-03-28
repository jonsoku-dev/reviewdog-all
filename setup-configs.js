const fs = require('fs');
const path = require('path');

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`디렉토리 생성됨: ${dirPath}`);
  }
}

function copyConfigFiles(workdir, toolName, configPath) {
  console.log(`\n[${toolName}] 설정 파일 복사 시작`);
  
  // 작업 디렉토리 생성
  ensureDirectoryExists(workdir);
  
  // GitHub Actions 환경에서의 configs 디렉토리 경로 설정
  const actionPath = process.env.GITHUB_ACTION_PATH || __dirname;
  const sourceDir = path.join(actionPath, 'configs', toolName);
  console.log(`[${toolName}] 액션 경로:`, actionPath);
  console.log(`[${toolName}] 소스 디렉토리 경로:`, sourceDir);
  
  if (!fs.existsSync(sourceDir)) {
    console.error(`[${toolName}] 소스 디렉토리가 존재하지 않습니다:`, sourceDir);
    // 상위 디렉토리 탐색
    const parentSourceDir = path.join(actionPath, '..', 'configs', toolName);
    console.log(`[${toolName}] 상위 디렉토리 탐색:`, parentSourceDir);
    
    if (fs.existsSync(parentSourceDir)) {
      console.log(`[${toolName}] 상위 디렉토리에서 configs 발견`);
      sourceDir = parentSourceDir;
    } else {
      throw new Error(`소스 디렉토리를 찾을 수 없음: ${sourceDir} 또는 ${parentSourceDir}`);
    }
  }
  
  try {
    const files = fs.readdirSync(sourceDir);
    console.log(`[${toolName}] 복사할 파일 목록:`, files);
    
    files.forEach(file => {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(workdir, file);
      
      try {
        if (configPath && file.endsWith('.json')) {
          // 사용자 정의 설정 파일이 있는 경우
          console.log(`[${toolName}] 사용자 정의 설정 파일 사용:`, configPath);
          if (!fs.existsSync(configPath)) {
            throw new Error(`사용자 정의 설정 파일을 찾을 수 없음: ${configPath}`);
          }
          fs.copyFileSync(configPath, targetPath);
        } else {
          // 기본 설정 파일 복사
          console.log(`[${toolName}] 기본 설정 파일 복사:`, file);
          if (!fs.existsSync(sourcePath)) {
            throw new Error(`소스 파일을 찾을 수 없음: ${sourcePath}`);
          }
          fs.copyFileSync(sourcePath, targetPath);
        }
        console.log(`[${toolName}] ✓ ${file} 복사 완료 -> ${targetPath}`);
      } catch (err) {
        console.error(`[${toolName}] ✗ ${file} 복사 실패:`, err.message);
        throw err;
      }
    });
    
    console.log(`[${toolName}] 모든 설정 파일 복사 완료`);
  } catch (err) {
    console.error(`[${toolName}] 설정 파일 복사 중 오류 발생:`, err.message);
    throw err;
  }
}

function createConfig(workdir, inputs) {
  console.log('\n=== 설정 파일 생성 시작 ===');
  console.log('작업 디렉토리:', workdir);
  
  try {
    // ESLint 설정 (with Prettier)
    if (inputs.skip_eslint !== 'true') {
      copyConfigFiles(workdir, 'eslint', inputs.eslint_config_path);
    } else {
      console.log('\n[eslint] 건너뛰기');
    }

    // Stylelint 설정
    if (inputs.skip_stylelint !== 'true') {
      copyConfigFiles(workdir, 'stylelint', inputs.stylelint_config_path);
    } else {
      console.log('\n[stylelint] 건너뛰기');
    }

    // Markdownlint 설정
    if (inputs.skip_markdownlint !== 'true') {
      copyConfigFiles(workdir, 'markdownlint', inputs.markdownlint_config_path);
    } else {
      console.log('\n[markdownlint] 건너뛰기');
    }

    // Axe 설정
    if (inputs.skip_accessibility !== 'true') {
      copyConfigFiles(workdir, 'axe', inputs.axe_config_path);
    } else {
      console.log('\n[axe] 건너뛰기');
    }

    console.log('\n✅ 모든 설정 파일 생성 완료');
    console.log('작업 디렉토리:', workdir);
  } catch (err) {
    console.error('\n❌ 설정 파일 생성 중 오류 발생:', err.message);
    process.exit(1);
  }
}

// GitHub Actions 입력 값 가져오기 및 로깅
console.log('\n=== 설정값 ===');
const inputs = {
  skip_eslint: process.env.INPUT_SKIP_ESLINT,
  skip_stylelint: process.env.INPUT_SKIP_STYLELINT,
  skip_markdownlint: process.env.INPUT_SKIP_MARKDOWNLINT,
  skip_accessibility: process.env.INPUT_SKIP_ACCESSIBILITY,
  eslint_config_path: process.env.INPUT_ESLINT_CONFIG_PATH,
  stylelint_config_path: process.env.INPUT_STYLELINT_CONFIG_PATH,
  markdownlint_config_path: process.env.INPUT_MARKDOWNLINT_CONFIG_PATH,
  axe_config_path: process.env.INPUT_AXE_CONFIG_PATH,
  workdir: process.env.INPUT_WORKDIR || '.'
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


// 설정 파일 생성
createConfig(inputs.workdir, inputs);