const { JSDOM, VirtualConsole } = require('jsdom');
const axeCore = require('axe-core');
const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const glob = require('glob');

async function runAccessibilityCheck() {
  try {
    // 환경 변수 설정 가져오기
    const accessibilityLevel = process.env.ACCESSIBILITY_LEVEL || 'AA';
    const contrastRatio = parseFloat(process.env.COLOR_CONTRAST_RATIO || '4.5');
    const skipAriaCheck = process.env.SKIP_ARIA_CHECK === 'true';
    const skipAltTextCheck = process.env.SKIP_ALT_TEXT_CHECK === 'true';

    console.log('설정값:', {
      accessibilityLevel,
      contrastRatio,
      skipAriaCheck,
      skipAltTextCheck
    });

    // 기본 axe 설정
    let axeConfig = {
      reporter: 'v2'
    };

    // 접근성 레벨에 따른 태그 설정
    if (accessibilityLevel === 'A') {
      axeConfig.runOnly = {
        type: 'tag',
        values: ['wcag2a']
      };
    } else if (accessibilityLevel === 'AA') {
      axeConfig.runOnly = {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa']
      };
    } else if (accessibilityLevel === 'AAA') {
      axeConfig.runOnly = {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag2aaa']
      };
    }

    // 규칙 초기화
    axeConfig.rules = {};

    // 색상 대비 규칙 설정
    axeConfig.rules['color-contrast'] = {
      enabled: true,
      options: {
        noScroll: true,
        levels: {
          normal: {
            minRatio: contrastRatio
          }
        }
      }
    };

    // 사용자 설정 파일 로드 시도
    try {
      const configPath = path.resolve(process.cwd(), '.axerc.json');
      console.log('axe 설정 파일 로드 시도:', configPath);
      
      if (fs.existsSync(configPath)) {
        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('axe 설정 파일 로드 성공');
        
        // 사용자 설정과 기본 설정 병합
        axeConfig = { ...axeConfig, ...userConfig };
        
        // rules가 덮어쓰여진 경우 color-contrast 설정 유지
        if (!axeConfig.rules['color-contrast']) {
          axeConfig.rules['color-contrast'] = {
            enabled: true,
            options: {
              noScroll: true,
              levels: {
                normal: {
                  minRatio: contrastRatio
                }
              }
            }
          };
        }
      } else {
        console.log('axe 설정 파일을 찾을 수 없어 기본 설정을 사용합니다.');
      }
    } catch (error) {
      console.warn('axe 설정 파일 로드 실패:', error);
      console.log('기본 설정을 사용합니다.');
    }

    // 환경 변수에 따라 규칙 비활성화
    if (skipAriaCheck) {
      // 모든 aria 관련 규칙 가져오기
      const ariaRules = axeCore.getRules()
        .filter(rule => rule.ruleId.startsWith('aria-'))
        .map(rule => rule.ruleId);
      
      // aria 규칙 비활성화
      ariaRules.forEach(ruleId => {
        axeConfig.rules[ruleId] = { enabled: false };
      });
    }

    if (skipAltTextCheck) {
      axeConfig.rules['image-alt'] = { enabled: false };
    }

    // HTML 파일 찾기
    const files = glob.sync('**/*.html', {
      ignore: ['node_modules/**', 'build/**', 'dist/**'],
    });

    console.log('검사할 HTML 파일:', files);

    if (files.length === 0) {
      console.log('검사할 HTML 파일이 없습니다.');
      return;
    }

    const results = [];

    // 각 HTML 파일 검사
    for (const file of files) {
      console.log(`\n파일 검사 중: ${file}`);
      const html = fs.readFileSync(file, 'utf8');
      
      // JSDOM 가상 콘솔 설정 (콘솔 메시지 무시)
      const virtualConsole = new VirtualConsole();
      virtualConsole.on("error", () => {});
      virtualConsole.on("warn", () => {});
      virtualConsole.on("info", () => {});
      virtualConsole.on("dir", () => {});

      // 기본 HTML 템플릿
      const template = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <base href="file://${path.dirname(file)}/">
          </head>
          <body>
            ${html}
          </body>
        </html>
      `;
      
      // JSDOM 인스턴스 생성
      const dom = new JSDOM(template, {
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true,
        virtualConsole,
        url: `file://${path.resolve(file)}`,
        contentType: 'text/html',
        includeNodeLocations: true,
        beforeParse(window) {
          window._resourceLoader = {
            abort: () => {}
          };
        }
      });

      const window = dom.window;
      const document = window.document;

      // 브라우저 환경 시뮬레이션
      window.requestAnimationFrame = callback => setTimeout(callback, 0);
      window.cancelAnimationFrame = id => clearTimeout(id);
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.HTMLElement.prototype.getBoundingClientRect = () => ({
        top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0
      });

      try {
        console.log('axe-core 초기화 중...');
        
        // axe-core를 현재 window에 주입
        window.axe = axeCore;
        
        // axe-core 설정 주입
        const source = axeCore.source;
        const script = window.document.createElement('script');
        script.textContent = source;
        window.document.head.appendChild(script);

        console.log('axe-core 실행 중...');
        
        // axe-core 실행 (내장된 모든 접근성 검사 포함)
        const axeResults = await window.axe.run(document.body, axeConfig);
        console.log(`발견된 위반사항: ${axeResults.violations.length}개`);

        // 결과 저장
        results.push({
          file,
          violations: axeResults.violations,
        });
      } catch (error) {
        console.error(`${file} 파일 검사 중 오류 발생:`, error);
      } finally {
        // 리소스 정리
        try {
          if (window._resourceLoader) {
            window._resourceLoader.abort();
          }
          window.close();
        } catch (error) {
          console.warn('창 닫기 중 오류 발생:', error);
        }
      }
    }

    // 결과 요약 생성
    const summary = generateAccessibilitySummary(results);
    console.log('\n=== 검사 결과 요약 ===');
    console.log(`총 위반사항: ${summary.totalViolations}개`);
    
    // GitHub Actions 출력 설정
    core.setOutput('accessibility_violations', summary.totalViolations);
    
    // 결과 파일 생성
    const reportPath = 'accessibility-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`상세 보고서가 ${reportPath}에 저장되었습니다.`);

    // 위반사항이 있으면 실패로 처리
    if (summary.totalViolations > 0) {
      core.setFailed(`접근성 검사 실패: ${summary.totalViolations}개의 위반사항이 발견되었습니다.`);
    } else {
      console.log('접근성 검사 완료: 위반사항이 없습니다.');
    }

  } catch (error) {
    console.error('접근성 검사 중 오류 발생:', error);
    core.setFailed(`접근성 검사 실패: ${error.message}`);
  }
}

// 접근성 검사 결과 요약 생성 함수
function generateAccessibilitySummary(results) {
  const summary = {
    totalViolations: 0,
    fileResults: {},
  };

  results.forEach(result => {
    const violations = result.violations.length;
    summary.totalViolations += violations;
    summary.fileResults[result.file] = violations;
  });

  return summary;
}

// 접근성 검사 실행
runAccessibilityCheck();