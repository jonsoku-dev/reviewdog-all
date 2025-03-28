const fs = require('fs');
const path = require('path');

function copyConfigFiles(tempDir, toolName, configPath) {
  console.log(`\n[${toolName}] 설정 파일 복사 시작`);
  const sourceDir = path.join(__dirname, 'configs', toolName);
  
  try {
    const files = fs.readdirSync(sourceDir);
    console.log(`[${toolName}] 복사할 파일 목록:`, files);
    
    files.forEach(file => {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(tempDir, file);
      
      try {
        if (configPath && file.endsWith('.json')) {
          // 사용자 정의 설정 파일이 있는 경우
          console.log(`[${toolName}] 사용자 정의 설정 파일 사용:`, configPath);
          fs.copyFileSync(configPath, targetPath);
        } else {
          // 기본 설정 파일 복사
          console.log(`[${toolName}] 기본 설정 파일 복사:`, file);
          fs.copyFileSync(sourcePath, targetPath);
        }
        console.log(`[${toolName}] ✓ ${file} 복사 완료`);
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

function createConfig(tempDir, inputs) {
  console.log('\n=== 설정 파일 생성 시작 ===');
  console.log('작업 디렉토리:', tempDir);
  
  if (!tempDir) {
    console.error('❌ TEMP_DIR이 설정되지 않았습니다.');
    process.exit(1);
  }

  try {
    // ESLint 설정 (with Prettier)
    if (inputs.skip_eslint !== 'true') {
      copyConfigFiles(tempDir, 'eslint', inputs.eslint_config_path);
    } else {
      console.log('\n[eslint] 건너뛰기');
    }

    // Stylelint 설정
    if (inputs.skip_stylelint !== 'true') {
      copyConfigFiles(tempDir, 'stylelint', inputs.stylelint_config_path);
    } else {
      console.log('\n[stylelint] 건너뛰기');
    }

    // Markdownlint 설정
    if (inputs.skip_markdownlint !== 'true') {
      copyConfigFiles(tempDir, 'markdownlint', inputs.markdownlint_config_path);
    } else {
      console.log('\n[markdownlint] 건너뛰기');
    }

    console.log('\n✅ 모든 설정 파일 생성 완료');
    console.log('작업 디렉토리:', tempDir);
  } catch (err) {
    console.error('\n❌ 설정 파일 생성 중 오류 발생:', err.message);
    process.exit(1);
  }
}

// GitHub Actions 입력 값 가져오기
const inputs = {
  skip_eslint: process.env.INPUT_SKIP_ESLINT,
  skip_stylelint: process.env.INPUT_SKIP_STYLELINT,
  skip_markdownlint: process.env.INPUT_SKIP_MARKDOWNLINT,
  eslint_config_path: process.env.INPUT_ESLINT_CONFIG_PATH,
  stylelint_config_path: process.env.INPUT_STYLELINT_CONFIG_PATH,
  markdownlint_config_path: process.env.INPUT_MARKDOWNLINT_CONFIG_PATH
};

// 입력값 로깅
console.log('\n=== 설정값 ===');
Object.entries(inputs).forEach(([key, value]) => {
  console.log(`${key}:`, value || '(기본값 사용)');
});

// 설정 파일 생성
createConfig(process.env.TEMP_DIR, inputs); 