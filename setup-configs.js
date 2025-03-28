const fs = require('fs');
const path = require('path');

function createConfig(tempDir, inputs) {
  if (!tempDir) {
    console.error('TEMP_DIR이 설정되지 않았습니다.');
    process.exit(1);
  }

  // ESLint 설정 (with Prettier)
  if (inputs.skip_eslint !== 'true') {
    const eslintConfig = inputs.eslint_config_path
      ? JSON.parse(fs.readFileSync(inputs.eslint_config_path, 'utf8'))
      : {
          extends: [
            'eslint:recommended',
            'plugin:prettier/recommended'  // Prettier 규칙을 ESLint에 통합
          ],
          plugins: ['prettier'],
          rules: {
            'prettier/prettier': 'error'
          },
          // Prettier 설정을 ESLint 내부에 통합
          prettier: {
            semi: true,
            singleQuote: true,
            trailingComma: 'es5'
          }
        };
    
    fs.writeFileSync(
      path.join(tempDir, '.eslintrc.json'),
      JSON.stringify(eslintConfig, null, 2)
    );
  }

  // Stylelint 설정
  if (inputs.skip_stylelint !== 'true') {
    const stylelintConfig = inputs.stylelint_config_path
      ? JSON.parse(fs.readFileSync(inputs.stylelint_config_path, 'utf8'))
      : {
          extends: ['stylelint-config-standard']
        };
    
    fs.writeFileSync(
      path.join(tempDir, '.stylelintrc'),
      JSON.stringify(stylelintConfig, null, 2)
    );
  }

  // Markdownlint 설정
  if (inputs.skip_markdownlint !== 'true') {
    const markdownlintConfig = inputs.markdownlint_config_path
      ? JSON.parse(fs.readFileSync(inputs.markdownlint_config_path, 'utf8'))
      : {
          'default': true,
          'line-length': false
        };
    
    fs.writeFileSync(
      path.join(tempDir, '.markdownlint.json'),
      JSON.stringify(markdownlintConfig, null, 2)
    );
  }

  console.log('설정 파일 생성 완료:', tempDir);
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

// 설정 파일 생성
createConfig(process.env.TEMP_DIR, inputs); 