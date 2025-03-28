import * as fs from 'fs';
import * as path from 'path';

interface ConfigInputs {
  skip_eslint: string;
  skip_stylelint: string;
  skip_markdownlint: string;
  eslint_config_path: string;
  stylelint_config_path: string;
  markdownlint_config_path: string;
  workdir: string;
}

function copyConfigFiles(workdir: string, toolName: string, configPath?: string): void {
  console.log(`\n[${toolName}] 설정 파일 복사 시작`);
  const sourceDir = path.join(__dirname, '..', 'configs', toolName);
  
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
          fs.copyFileSync(configPath, targetPath);
        } else {
          // 기본 설정 파일 복사
          console.log(`[${toolName}] 기본 설정 파일 복사:`, file);
          fs.copyFileSync(sourcePath, targetPath);
        }
        console.log(`[${toolName}] ✓ ${file} 복사 완료`);
      } catch (err) {
        console.error(`[${toolName}] ✗ ${file} 복사 실패:`, err);
        throw err;
      }
    });
    
    console.log(`[${toolName}] 모든 설정 파일 복사 완료`);
  } catch (err) {
    console.error(`[${toolName}] 설정 파일 복사 중 오류 발생:`, err);
    throw err;
  }
}

function createConfig(workdir: string, inputs: ConfigInputs): void {
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

    console.log('\n✅ 모든 설정 파일 생성 완료');
    console.log('작업 디렉토리:', workdir);
  } catch (err) {
    console.error('\n❌ 설정 파일 생성 중 오류 발생:', err);
    process.exit(1);
  }
}

// GitHub Actions 입력 값 가져오기
const inputs: ConfigInputs = {
  skip_eslint: process.env.INPUT_SKIP_ESLINT || 'false',
  skip_stylelint: process.env.INPUT_SKIP_STYLELINT || 'false',
  skip_markdownlint: process.env.INPUT_SKIP_MARKDOWNLINT || 'false',
  eslint_config_path: process.env.INPUT_ESLINT_CONFIG_PATH || '',
  stylelint_config_path: process.env.INPUT_STYLELINT_CONFIG_PATH || '',
  markdownlint_config_path: process.env.INPUT_MARKDOWNLINT_CONFIG_PATH || '',
  workdir: process.env.INPUT_WORKDIR || '.'
};

// 입력값 로깅
console.log('\n=== 설정값 ===');
Object.entries(inputs).forEach(([key, value]) => {
  console.log(`${key}:`, value || '(기본값 사용)');
});

// 설정 파일 생성
createConfig(inputs.workdir, inputs); 