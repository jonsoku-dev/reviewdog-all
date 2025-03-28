const { JSDOM, VirtualConsole } = require('jsdom');
const axeCore = require('axe-core');
const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const glob = require('glob');

async function runAccessibilityCheck() {
  try {
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

    // axe 설정 파일 로드
    let axeConfig;
    try {
      const configPath = path.resolve(process.cwd(), '.axerc.json');
      console.log('axe 설정 파일 로드:', configPath);
      axeConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // 환경 변수에 따라 규칙 비활성화
      if (skipAriaCheck) {
        Object.keys(axeConfig.rules).forEach(key => {
          if (key.startsWith('aria-')) {
            axeConfig.rules[key].enabled = false;
          }
        });
      }
      if (skipAltTextCheck) {
        if (axeConfig.rules['image-alt']) {
          axeConfig.rules['image-alt'].enabled = false;
        }
      }
      
      // 접근성 레벨 설정
      axeConfig.levels = [accessibilityLevel];
      
    } catch (error) {
      console.error('axe 설정 파일 로드 실패:', error);
      throw new Error('axe 설정 파일을 찾을 수 없습니다. setup-configs.js가 실행되었는지 확인해주세요.');
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

    for (const file of files) {
      console.log(`\n파일 검사 중: ${file}`);
      const html = fs.readFileSync(file, 'utf8');
      
      // JSDOM 설정
      const virtualConsole = new VirtualConsole();
      virtualConsole.on("error", () => { /* 콘솔 에러 무시 */ });
      virtualConsole.on("warn", () => { /* 콘솔 경고 무시 */ });
      virtualConsole.on("info", () => { /* 콘솔 정보 무시 */ });
      virtualConsole.on("dir", () => { /* 콘솔 dir 무시 */ });

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
      
      const dom = new JSDOM(template, {
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true,
        virtualConsole,
        url: `file://${path.resolve(file)}`,
        contentType: 'text/html',
        includeNodeLocations: true,
        beforeParse(window) {
          // 리소스 요청 중단 메서드 추가
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
        // axe-core 실행
        const axeResults = await window.axe.run(document.body, axeConfig);
        console.log(`발견된 위반사항: ${axeResults.violations.length}개`);

        // 색상 대비 검사
        if (contrastRatio > 0) {
          console.log('색상 대비 검사 실행 중...');
          const colorContrastIssues = checkColorContrast(document, window, contrastRatio);
          axeResults.violations.push(...colorContrastIssues);
        }

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

    // 결과 저장
    const summary = generateAccessibilitySummary(results);
    console.log('\n=== 검사 결과 요약 ===');
    console.log(`총 위반사항: ${summary.totalViolations}개`);
    
    core.setOutput('accessibility_violations', summary.totalViolations);
    
    // 결과 파일 생성
    const reportPath = 'accessibility-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`상세 보고서가 ${reportPath}에 저장되었습니다.`);

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

function checkColorContrast(document, window, minRatio) {
  const violations = [];
  const elements = document.querySelectorAll('*');

  elements.forEach(element => {
    const style = window.getComputedStyle(element);
    const backgroundColor = style.backgroundColor;
    const color = style.color;

    if (backgroundColor && color) {
      const ratio = calculateContrastRatio(backgroundColor, color);
      if (ratio < minRatio) {
        violations.push({
          id: 'custom-color-contrast',
          impact: 'serious',
          description: `색상 대비가 부족합니다 (비율: ${ratio.toFixed(2)}:1, 최소 요구: ${minRatio}:1)`,
          nodes: [{ target: [element] }],
        });
      }
    }
  });

  return violations;
}

function calculateContrastRatio(bg, fg) {
  // 색상 대비 계산 로직 구현
  // WCAG 2.0 공식 사용
  const bgLuminance = getLuminance(bg);
  const fgLuminance = getLuminance(fg);
  
  const ratio = (Math.max(bgLuminance, fgLuminance) + 0.05) /
                (Math.min(bgLuminance, fgLuminance) + 0.05);
  
  return ratio;
}

function getLuminance(color) {
  // sRGB 상대 휘도 계산
  const rgb = color.match(/\d+/g).map(Number);
  const [r, g, b] = rgb.map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

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

runAccessibilityCheck(); 