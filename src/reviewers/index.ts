import AIReviewer from './ai-reviewer';
import { Reviewer } from '../types/reviewer';

export const createReviewer = (type: string): Reviewer | null => {
  switch (type) {
    case 'ai':
      return new AIReviewer({
        debug: process.env.DEBUG === 'true',
        enabled: process.env.AI_REVIEWER_ENABLED === 'true',
        apiKey: process.env.AI_REVIEWER_API_KEY,
        language: process.env.AI_REVIEWER_API_LANGUAGE as 'ko' | 'en' | 'ja',
        model: process.env.AI_REVIEWER_MODEL,
        maxTokens: parseInt(process.env.AI_REVIEWER_MAX_TOKENS || '1000'),
        temperature: parseFloat(process.env.AI_REVIEWER_TEMPERATURE || '0.7'),
        filePatterns: process.env.AI_REVIEWER_FILE_PATTERNS?.split(','),
        excludePatterns: process.env.AI_REVIEWER_EXCLUDE_PATTERNS?.split(','),
        workdir: process.env.WORKSPACE_PATH || '.'
      });
    default:
      return null;
  }
}; 