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
          root: true,
          env: {
            browser: true,
            node: true,
            es2021: true
          },
          parser: '@babel/eslint-parser',
          parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            requireConfigFile: false,
            babelOptions: {
              presets: ['@babel/preset-env']
            }
          },
          extends: [
            'eslint:recommended',
            'plugin:prettier/recommended',
            'plugin:import/errors',
            'plugin:import/warnings'
          ],
          plugins: ['prettier', 'import', 'node'],
          rules: {
            'prettier/prettier': 'error',
            'import/no-unresolved': 'error',
            'node/no-unsupported-features/es-syntax': 'off'
          }
        };
    
    fs.writeFileSync(
      path.join(tempDir, '.eslintrc.json'),
      JSON.stringify(eslintConfig, null, 2)
    );

    // .eslintignore 파일 생성
    const eslintIgnore = `
node_modules/
dist/
build/
coverage/
*.min.js
    `.trim();

    fs.writeFileSync(
      path.join(tempDir, '.eslintignore'),
      eslintIgnore
    );

    // Prettier 설정 파일 생성
    const prettierConfig = {
      semi: true,
      singleQuote: true,
      trailingComma: 'es5',
      printWidth: 100,
      tabWidth: 2
    };

    fs.writeFileSync(
      path.join(tempDir, '.prettierrc'),
      JSON.stringify(prettierConfig, null, 2)
    );
  }

  // Stylelint 설정
  if (inputs.skip_stylelint !== 'true') {
    const stylelintConfig = inputs.stylelint_config_path
      ? JSON.parse(fs.readFileSync(inputs.stylelint_config_path, 'utf8'))
      : {
          extends: ['stylelint-config-standard'],
          rules: {
            'at-rule-no-unknown': null,
            'no-empty-source': null
          }
        };
    
    fs.writeFileSync(
      path.join(tempDir, '.stylelintrc.json'),
      JSON.stringify(stylelintConfig, null, 2)
    );

    // .stylelintignore 파일 생성
    const stylelintIgnore = `
node_modules/
dist/
build/
coverage/
    `.trim();

    fs.writeFileSync(
      path.join(tempDir, '.stylelintignore'),
      stylelintIgnore
    );
  }

  // Markdownlint 설정
  if (inputs.skip_markdownlint !== 'true') {
    const markdownlintConfig = inputs.markdownlint_config_path
      ? JSON.parse(fs.readFileSync(inputs.markdownlint_config_path, 'utf8'))
      : {
          'default': true,
          'line-length': false,
          'no-inline-html': false
        };
    
    fs.writeFileSync(
      path.join(tempDir, '.markdownlint.json'),
      JSON.stringify(markdownlintConfig, null, 2)
    );

    // .markdownlintignore 파일 생성
    const markdownlintIgnore = `
node_modules/
dist/
build/
coverage/
    `.trim();

    fs.writeFileSync(
      path.join(tempDir, '.markdownlintignore'),
      markdownlintIgnore
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