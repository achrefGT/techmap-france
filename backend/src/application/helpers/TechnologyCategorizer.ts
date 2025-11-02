import { TechnologyCategory } from '../../domain/constants/TechnologyCategories';

export class TechnologyCategorizer {
  private static readonly CATEGORY_MAP: Record<string, TechnologyCategory> = {
    // Frontend
    react: 'frontend',
    reactjs: 'frontend',
    vue: 'frontend',
    vuejs: 'frontend',
    angular: 'frontend',
    svelte: 'frontend',
    typescript: 'frontend',
    javascript: 'frontend',
    ts: 'frontend',
    js: 'frontend',

    // Backend
    node: 'backend',
    nodejs: 'backend',
    'node.js': 'backend',
    python: 'backend',
    java: 'backend',
    go: 'backend',
    golang: 'backend',
    php: 'backend',
    ruby: 'backend',
    '.net': 'backend',
    dotnet: 'backend',
    'c#': 'backend',
    csharp: 'backend',

    // DevOps
    docker: 'devops',
    kubernetes: 'devops',
    k8s: 'devops',
    aws: 'devops',
    azure: 'devops',
    gcp: 'devops',
    jenkins: 'devops',
    terraform: 'devops',
    ansible: 'devops',

    // Database
    postgresql: 'database',
    postgres: 'database',
    mongodb: 'database',
    mongo: 'database',
    mysql: 'database',
    redis: 'database',
    elasticsearch: 'database',

    // AI/ML
    tensorflow: 'ai-ml',
    pytorch: 'ai-ml',
    'machine learning': 'ai-ml',
    'deep learning': 'ai-ml',
    ml: 'ai-ml',
  };

  static categorize(techName: string): TechnologyCategory {
    const normalized = techName.toLowerCase().trim();
    return this.CATEGORY_MAP[normalized] || 'other';
  }
}
