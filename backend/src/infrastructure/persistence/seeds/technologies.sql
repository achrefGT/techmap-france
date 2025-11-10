-- Seed: Technologies
-- Common technologies in the French tech job market
-- Categories: frontend, backend, database, devops, ai-ml, mobile, other

INSERT INTO technologies (name, category, display_name, job_count, created_at, updated_at) VALUES

-- ============================================================================
-- FRONTEND
-- ============================================================================
('React', 'frontend', 'React', 0, NOW(), NOW()),
('Vue.js', 'frontend', 'Vue.js', 0, NOW(), NOW()),
('Angular', 'frontend', 'Angular', 0, NOW(), NOW()),
('TypeScript', 'frontend', 'TypeScript', 0, NOW(), NOW()),
('JavaScript', 'frontend', 'JavaScript', 0, NOW(), NOW()),
('Next.js', 'frontend', 'Next.js', 0, NOW(), NOW()),
('Svelte', 'frontend', 'Svelte', 0, NOW(), NOW()),
('HTML', 'frontend', 'HTML', 0, NOW(), NOW()),
('CSS', 'frontend', 'CSS', 0, NOW(), NOW()),
('Tailwind CSS', 'frontend', 'Tailwind CSS', 0, NOW(), NOW()),
('SASS', 'frontend', 'SASS', 0, NOW(), NOW()),
('Webpack', 'frontend', 'Webpack', 0, NOW(), NOW()),
('Vite', 'frontend', 'Vite', 0, NOW(), NOW()),

-- ============================================================================
-- BACKEND
-- ============================================================================
('Node.js', 'backend', 'Node.js', 0, NOW(), NOW()),
('Python', 'backend', 'Python', 0, NOW(), NOW()),
('Java', 'backend', 'Java', 0, NOW(), NOW()),
('C#', 'backend', 'C#', 0, NOW(), NOW()),
('Go', 'backend', 'Go', 0, NOW(), NOW()),
('PHP', 'backend', 'PHP', 0, NOW(), NOW()),
('Ruby', 'backend', 'Ruby', 0, NOW(), NOW()),
('Rust', 'backend', 'Rust', 0, NOW(), NOW()),
('Express.js', 'backend', 'Express.js', 0, NOW(), NOW()),
('NestJS', 'backend', 'NestJS', 0, NOW(), NOW()),
('Django', 'backend', 'Django', 0, NOW(), NOW()),
('Flask', 'backend', 'Flask', 0, NOW(), NOW()),
('FastAPI', 'backend', 'FastAPI', 0, NOW(), NOW()),
('Spring Boot', 'backend', 'Spring Boot', 0, NOW(), NOW()),
('Laravel', 'backend', 'Laravel', 0, NOW(), NOW()),
('Ruby on Rails', 'backend', 'Ruby on Rails', 0, NOW(), NOW()),
('.NET', 'backend', '.NET', 0, NOW(), NOW()),
('ASP.NET', 'backend', 'ASP.NET', 0, NOW(), NOW()),

-- ============================================================================
-- DATABASE
-- ============================================================================
('PostgreSQL', 'database', 'PostgreSQL', 0, NOW(), NOW()),
('MySQL', 'database', 'MySQL', 0, NOW(), NOW()),
('MongoDB', 'database', 'MongoDB', 0, NOW(), NOW()),
('Redis', 'database', 'Redis', 0, NOW(), NOW()),
('Elasticsearch', 'database', 'Elasticsearch', 0, NOW(), NOW()),
('SQLite', 'database', 'SQLite', 0, NOW(), NOW()),
('MariaDB', 'database', 'MariaDB', 0, NOW(), NOW()),
('Oracle', 'database', 'Oracle', 0, NOW(), NOW()),
('SQL Server', 'database', 'SQL Server', 0, NOW(), NOW()),
('Cassandra', 'database', 'Cassandra', 0, NOW(), NOW()),
('DynamoDB', 'database', 'DynamoDB', 0, NOW(), NOW()),

-- ============================================================================
-- DEVOPS
-- ============================================================================
('Docker', 'devops', 'Docker', 0, NOW(), NOW()),
('Kubernetes', 'devops', 'Kubernetes', 0, NOW(), NOW()),
('AWS', 'devops', 'AWS', 0, NOW(), NOW()),
('Azure', 'devops', 'Azure', 0, NOW(), NOW()),
('GCP', 'devops', 'Google Cloud Platform', 0, NOW(), NOW()),
('Terraform', 'devops', 'Terraform', 0, NOW(), NOW()),
('Ansible', 'devops', 'Ansible', 0, NOW(), NOW()),
('Jenkins', 'devops', 'Jenkins', 0, NOW(), NOW()),
('GitLab CI', 'devops', 'GitLab CI/CD', 0, NOW(), NOW()),
('GitHub Actions', 'devops', 'GitHub Actions', 0, NOW(), NOW()),
('CircleCI', 'devops', 'CircleCI', 0, NOW(), NOW()),
('Prometheus', 'devops', 'Prometheus', 0, NOW(), NOW()),
('Grafana', 'devops', 'Grafana', 0, NOW(), NOW()),
('Nginx', 'devops', 'Nginx', 0, NOW(), NOW()),
('Apache', 'devops', 'Apache', 0, NOW(), NOW()),
('Linux', 'devops', 'Linux', 0, NOW(), NOW()),

-- ============================================================================
-- AI/ML
-- ============================================================================
('TensorFlow', 'ai-ml', 'TensorFlow', 0, NOW(), NOW()),
('PyTorch', 'ai-ml', 'PyTorch', 0, NOW(), NOW()),
('Scikit-learn', 'ai-ml', 'Scikit-learn', 0, NOW(), NOW()),
('Pandas', 'ai-ml', 'Pandas', 0, NOW(), NOW()),
('NumPy', 'ai-ml', 'NumPy', 0, NOW(), NOW()),
('Keras', 'ai-ml', 'Keras', 0, NOW(), NOW()),
('OpenAI', 'ai-ml', 'OpenAI', 0, NOW(), NOW()),
('LangChain', 'ai-ml', 'LangChain', 0, NOW(), NOW()),
('Hugging Face', 'ai-ml', 'Hugging Face', 0, NOW(), NOW()),
('MLflow', 'ai-ml', 'MLflow', 0, NOW(), NOW()),
('Apache Spark', 'ai-ml', 'Apache Spark', 0, NOW(), NOW()),
('Databricks', 'ai-ml', 'Databricks', 0, NOW(), NOW()),

-- ============================================================================
-- MOBILE
-- ============================================================================
('React Native', 'mobile', 'React Native', 0, NOW(), NOW()),
('Flutter', 'mobile', 'Flutter', 0, NOW(), NOW()),
('iOS', 'mobile', 'iOS', 0, NOW(), NOW()),
('Android', 'mobile', 'Android', 0, NOW(), NOW()),
('Swift', 'mobile', 'Swift', 0, NOW(), NOW()),
('Kotlin', 'mobile', 'Kotlin', 0, NOW(), NOW()),
('Xamarin', 'mobile', 'Xamarin', 0, NOW(), NOW()),
('Ionic', 'mobile', 'Ionic', 0, NOW(), NOW()),

-- ============================================================================
-- OTHER
-- ============================================================================
('Git', 'other', 'Git', 0, NOW(), NOW()),
('GraphQL', 'other', 'GraphQL', 0, NOW(), NOW()),
('REST API', 'other', 'REST API', 0, NOW(), NOW()),
('gRPC', 'other', 'gRPC', 0, NOW(), NOW()),
('Agile', 'other', 'Agile', 0, NOW(), NOW()),
('Scrum', 'other', 'Scrum', 0, NOW(), NOW()),
('JIRA', 'other', 'JIRA', 0, NOW(), NOW()),
('Microservices', 'other', 'Microservices', 0, NOW(), NOW()),
('CI/CD', 'other', 'CI/CD', 0, NOW(), NOW()),
('Testing', 'other', 'Testing', 0, NOW(), NOW()),
('Jest', 'other', 'Jest', 0, NOW(), NOW()),
('Cypress', 'other', 'Cypress', 0, NOW(), NOW()),
('Selenium', 'other', 'Selenium', 0, NOW(), NOW()),
('Postman', 'other', 'Postman', 0, NOW(), NOW())

ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  display_name = EXCLUDED.display_name,
  updated_at = NOW();

-- Notes:
-- - job_count starts at 0 and will be updated by the analytics service
-- - Technologies are seeded with common French market skills
-- - Additional technologies will be auto-detected and added by TechnologyDetector
-- - Display names can differ from internal names (e.g., "Google Cloud Platform" vs "GCP")