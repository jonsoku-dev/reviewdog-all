"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// 버전 정보를 코드 내에서 직접 관리
const versions = {
    core: {
        '@actions/core': '^1.10.1',
        '@actions/exec': '^1.1.1'
    },
    linters: {
        eslint: {
            version: '^8.57.0',
            dependencies: {
                '@typescript-eslint/eslint-plugin': '^7.1.0',
                '@typescript-eslint/parser': '^7.1.0',
                'eslint-config-prettier': '^9.1.0',
                'eslint-plugin-import': '^2.29.1',
                'eslint-plugin-jest': '^27.9.0',
                'eslint-plugin-prettier': '^5.1.3'
            }
        },
        prettier: {
            version: '^3.2.5',
            dependencies: {}
        },
        stylelint: {
            version: '^16.2.1',
            dependencies: {
                'stylelint-config-standard': '^36.0.0',
                'stylelint-config-prettier': '^9.0.5'
            }
        },
        markdownlint: {
            version: '^0.33.0',
            dependencies: {
                'markdownlint-cli': '^0.39.0'
            }
        }
    }
};
function createPackageJson(workdir) {
    console.log('\n=== package.json 생성 시작 ===');
    try {
        // 필요한 의존성 수집
        const requiredDeps = {};
        const inputs = getInputs();
        // 1. 코어 의존성 추가
        Object.entries(versions.core).forEach(([pkg, version]) => {
            requiredDeps[pkg] = version;
        });
        // 2. 린터별 의존성 추가
        if (inputs.skip_eslint !== 'true' && versions.linters.eslint) {
            // ESLint 메인 패키지
            requiredDeps['eslint'] = versions.linters.eslint.version;
            // ESLint 의존성
            Object.entries(versions.linters.eslint.dependencies).forEach(([pkg, version]) => {
                requiredDeps[pkg] = version;
            });
            // Prettier 관련 의존성도 추가 (ESLint와 함께 사용)
            if (versions.linters.prettier) {
                requiredDeps['prettier'] = versions.linters.prettier.version;
                Object.entries(versions.linters.prettier.dependencies).forEach(([pkg, version]) => {
                    requiredDeps[pkg] = version;
                });
            }
        }
        if (inputs.skip_stylelint !== 'true' && versions.linters.stylelint) {
            requiredDeps['stylelint'] = versions.linters.stylelint.version;
            Object.entries(versions.linters.stylelint.dependencies).forEach(([pkg, version]) => {
                requiredDeps[pkg] = version;
            });
        }
        if (inputs.skip_markdownlint !== 'true' && versions.linters.markdownlint) {
            Object.entries(versions.linters.markdownlint.dependencies).forEach(([pkg, version]) => {
                requiredDeps[pkg] = version;
            });
        }
        // package.json 생성
        const packageJson = {
            name: 'lint-action-workspace',
            version: '1.0.0',
            private: true,
            engines: {
                node: '>=20'
            },
            dependencies: requiredDeps
        };
        // package.json 파일 쓰기
        const targetPath = path.join(workdir, 'package.json');
        fs.writeFileSync(targetPath, JSON.stringify(packageJson, null, 2));
        console.log('✅ package.json 생성 완료:', targetPath);
        // 설치될 패키지 목록 출력
        console.log('\n설치될 패키지 목록:');
        Object.entries(requiredDeps).forEach(([pkg, version]) => {
            console.log(`- ${pkg}@${version}`);
        });
    }
    catch (err) {
        console.error('❌ package.json 생성 중 오류 발생:', err);
        throw err;
    }
}
function getInputs() {
    return {
        workdir: process.env.INPUT_WORKDIR || '.',
        skip_eslint: process.env.INPUT_SKIP_ESLINT || 'false',
        skip_stylelint: process.env.INPUT_SKIP_STYLELINT || 'false',
        skip_markdownlint: process.env.INPUT_SKIP_MARKDOWNLINT || 'false',
        skip_misspell: process.env.INPUT_SKIP_MISSPELL || 'false'
    };
}
// 메인 실행
const inputs = getInputs();
createPackageJson(inputs.workdir);
