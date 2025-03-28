const { JSDOM } = require('jsdom');
const axe = require('axe-core');
const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const glob = require('glob');

async function runAccessibilityCheck() {
  try {
    const accessibilityLevel = process.env.ACCESSIBILITY_LEVEL;
    const contrastRatio = parseFloat(process.env.COLOR_CONTRAST_RATIO);
    const skipAriaCheck = process.env.SKIP_ARIA_CHECK === 'true';
    const skipAltTextCheck = process.env.SKIP_ALT_TEXT_CHECK === 'true';

    // HTML 파일 찾기
    const files = glob.sync('**/*.html', {
      ignore: ['node_modules/**', 'build/**', 'dist/**'],
    });

    const results = [];

    for (const file of files) {
      const html = fs.readFileSync(file, 'utf8');
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // axe-core 설정
      const axeConfig = {
        rules: {
          'color-contrast': { enabled: true, options: { noScroll: true } },
          'aria-*': { enabled: !skipAriaCheck },
          'image-alt': { enabled: !skipAltTextCheck },
        },
        resultTypes: ['violations'],
        levels: [accessibilityLevel],
      };

      // axe-core 실행
      const axeResults = await axe.run(document, axeConfig);

      // 색상 대비 검사
      if (contrastRatio > 0) {
        const colorContrastIssues = checkColorContrast(document, contrastRatio);
        axeResults.violations.push(...colorContrastIssues);
      }

      results.push({
        file,
        violations: axeResults.violations,
      });
    }

    // 결과 저장
    const summary = generateAccessibilitySummary(results);
    core.setOutput('accessibility_violations', summary.totalViolations);
    
    // 결과 파일 생성
    fs.writeFileSync(
      'accessibility-report.json',
      JSON.stringify(results, null, 2)
    );

    if (summary.totalViolations > 0) {
      core.setFailed(`접근성 검사 실패: ${summary.totalViolations}개의 위반사항이 발견되었습니다.`);
    }

  } catch (error) {
    core.setFailed(`접근성 검사 실패: ${error.message}`);
  }
}

function checkColorContrast(document, minRatio) {
  const violations = [];
  const elements = document.querySelectorAll('*');

  elements.forEach(element => {
    const style = getComputedStyle(element);
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