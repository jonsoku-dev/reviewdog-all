export interface ReviewResult {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  reviewer: string;
}

export interface ReviewerOptions {
  workdir?: string;
  // AI 리뷰어 옵션
  model?: string;
  maxTokens?: number;
  temperature?: number;
  filePatterns?: string[];
  excludePatterns?: string[];
}

export interface Reviewer {
  isEnabled(): Promise<boolean>;
  review(files: string[]): Promise<ReviewResult[]>;
} 