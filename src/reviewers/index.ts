import AIReviewer from './ai-reviewer';
import { Reviewer } from '../types/reviewer';

export const createReviewer = (type: string, env?: NodeJS.ProcessEnv): Reviewer | null => {
  console.log(env, '[createReviewer] env');
  switch (type) {
    case 'ai':
      return new AIReviewer({
        debug: env?.DEBUG === 'true',
        enabled: env?.AI_REVIEWER_ENABLED === 'true',
        apiKey: env?.AI_REVIEWER_API_KEY,
        model: env?.AI_REVIEWER_MODEL,
        maxTokens: parseInt(env?.AI_REVIEWER_MAX_TOKENS || '1000'),
        temperature: parseFloat(env?.AI_REVIEWER_TEMPERATURE || '0.7'),
        filePatterns: env?.AI_REVIEWER_FILE_PATTERNS?.split(','),
        excludePatterns: env?.AI_REVIEWER_EXCLUDE_PATTERNS?.split(','),
        workdir: env?.WORKSPACE_PATH || '.'
      });
    default:
      return null;
  }
}; 