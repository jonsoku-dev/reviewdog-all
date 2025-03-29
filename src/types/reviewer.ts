export interface ReviewResult {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  reviewer: string;
}

export interface ReviewerOptions {
  // 기본 설정
  workdir?: string;
  enabled?: boolean;
  debug?: boolean;
  
  // AI 리뷰어 옵션
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  filePatterns?: string[];
  excludePatterns?: string[];
  language?: 'ko' | 'en' | 'ja';  // 출력 언어 설정 (한국어 또는 영어)
}

export interface Reviewer {
  options: ReviewerOptions;
  isEnabled(): Promise<boolean>;
  review(files: string[]): Promise<ReviewResult[]>;
} 