export const TECHNOLOGY_CATEGORIES = [
  'frontend',
  'backend',
  'database',
  'devops',
  'ai-ml',
  'mobile',
  'other',
] as const;

export type TechnologyCategory = (typeof TECHNOLOGY_CATEGORIES)[number];
