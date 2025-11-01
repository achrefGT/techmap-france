import { Technology } from '../../../../src/domain/entities/Technology';
import { describe, it, expect } from '@jest/globals';
import { DomainError } from '../../../../src/domain/errors/DomainErrors';

describe('Technology Entity', () => {
  describe('Constructor and Validation', () => {
    it('should create technology with all properties', () => {
      const tech = new Technology(1, 'React', 'frontend', 'React.js', 250);

      expect(tech.id).toBe(1);
      expect(tech.name).toBe('React');
      expect(tech.category).toBe('frontend');
      expect(tech.displayName).toBe('React.js');
      expect(tech.jobCount).toBe(250);
    });

    it('should default jobCount to 0 when not provided', () => {
      const tech = new Technology(2, 'Vue', 'frontend', 'Vue.js');

      expect(tech.jobCount).toBe(0);
    });

    it('should allow null id for new technologies', () => {
      const tech = new Technology(null, 'NewTech', 'backend', 'NewTech');

      expect(tech.id).toBeNull();
      expect(tech.name).toBe('NewTech');
    });

    it('should throw error when name is empty', () => {
      expect(() => {
        new Technology(1, '', 'frontend', 'Display Name');
      }).toThrow(DomainError);
    });

    it('should throw error when name is whitespace only', () => {
      expect(() => {
        new Technology(1, '   ', 'frontend', 'Display Name');
      }).toThrow(DomainError);
    });

    it('should throw error when category is invalid', () => {
      expect(() => {
        new Technology(1, 'React', 'InvalidCategory' as any, 'React.js');
      }).toThrow(DomainError);
    });

    it('should accept valid categories', () => {
      const validCategories = [
        'frontend',
        'backend',
        'database',
        'devops',
        'mobile',
        'ai-ml',
        'other',
      ];

      validCategories.forEach(category => {
        expect(() => {
          new Technology(1, 'Test', category as any, 'Test');
        }).not.toThrow();
      });
    });
  });

  describe('Factory Method - create()', () => {
    it('should create new technology with null id', () => {
      const tech = Technology.create('React', 'frontend', 'React.js');

      expect(tech.id).toBeNull();
      expect(tech.name).toBe('React');
      expect(tech.category).toBe('frontend');
      expect(tech.displayName).toBe('React.js');
      expect(tech.jobCount).toBe(0);
    });

    it('should use name as displayName when not provided', () => {
      const tech = Technology.create('TypeScript', 'frontend');

      expect(tech.displayName).toBe('TypeScript');
    });

    it('should initialize jobCount to 0', () => {
      const tech = Technology.create('Vue', 'frontend');

      expect(tech.jobCount).toBe(0);
    });
  });

  describe('Popularity Level Classification', () => {
    it('should classify as trending (>500 jobs)', () => {
      const tech = new Technology(1, 'React', 'frontend', 'React.js', 750);

      expect(tech.getPopularityLevel()).toBe('trending');
    });

    it('should classify as popular (>200 jobs)', () => {
      const tech = new Technology(2, 'Vue', 'frontend', 'Vue.js', 300);

      expect(tech.getPopularityLevel()).toBe('popular');
    });

    it('should classify as common (>50 jobs)', () => {
      const tech = new Technology(3, 'Svelte', 'frontend', 'Svelte', 75);

      expect(tech.getPopularityLevel()).toBe('common');
    });

    it('should classify as niche (<=50 jobs)', () => {
      const tech = new Technology(4, 'Elm', 'frontend', 'Elm', 25);

      expect(tech.getPopularityLevel()).toBe('niche');
    });

    it('should classify zero jobs as niche', () => {
      const tech = new Technology(5, 'NewFramework', 'frontend', 'NewFramework', 0);

      expect(tech.getPopularityLevel()).toBe('niche');
    });

    it('should handle boundary case of exactly 500 jobs', () => {
      const tech = new Technology(1, 'React', 'frontend', 'React.js', 500);

      expect(tech.getPopularityLevel()).toBe('popular');
    });

    it('should handle boundary case of exactly 501 jobs', () => {
      const tech = new Technology(1, 'React', 'frontend', 'React.js', 501);

      expect(tech.getPopularityLevel()).toBe('trending');
    });

    it('should handle boundary case of exactly 200 jobs', () => {
      const tech = new Technology(2, 'Vue', 'frontend', 'Vue.js', 200);

      expect(tech.getPopularityLevel()).toBe('common');
    });

    it('should handle boundary case of exactly 201 jobs', () => {
      const tech = new Technology(2, 'Vue', 'frontend', 'Vue.js', 201);

      expect(tech.getPopularityLevel()).toBe('popular');
    });

    it('should handle boundary case of exactly 50 jobs', () => {
      const tech = new Technology(3, 'Svelte', 'frontend', 'Svelte', 50);

      expect(tech.getPopularityLevel()).toBe('niche');
    });

    it('should handle boundary case of exactly 51 jobs', () => {
      const tech = new Technology(3, 'Svelte', 'frontend', 'Svelte', 51);

      expect(tech.getPopularityLevel()).toBe('common');
    });
  });

  describe('isInDemand()', () => {
    it('should return true when job count is above 100', () => {
      const popularTech = new Technology(1, 'React', 'frontend', 'React.js', 150);

      expect(popularTech.isInDemand()).toBe(true);
    });

    it('should return true for exactly 101 jobs', () => {
      const tech = new Technology(2, 'Vue', 'frontend', 'Vue.js', 101);

      expect(tech.isInDemand()).toBe(true);
    });

    it('should return false when job count is exactly 100', () => {
      const tech = new Technology(3, 'Angular', 'frontend', 'Angular', 100);

      expect(tech.isInDemand()).toBe(false);
    });

    it('should return false when job count is below 100', () => {
      const unpopularTech = new Technology(4, 'Svelte', 'frontend', 'Svelte', 50);

      expect(unpopularTech.isInDemand()).toBe(false);
    });

    it('should return false when job count is 0', () => {
      const newTech = new Technology(5, 'Qwik', 'frontend', 'Qwik', 0);

      expect(newTech.isInDemand()).toBe(false);
    });

    it('should return false for exactly 1 job', () => {
      const rareTech = new Technology(6, 'ObscureTech', 'other', 'ObscureTech', 1);

      expect(rareTech.isInDemand()).toBe(false);
    });
  });

  describe('Real-world Technology Scenarios', () => {
    it('should handle popular frontend framework', () => {
      const react = new Technology(1, 'React', 'frontend', 'React.js', 1200);

      expect(react.getPopularityLevel()).toBe('trending');
      expect(react.isInDemand()).toBe(true);
    });

    it('should handle popular backend technology', () => {
      const nodejs = new Technology(2, 'Node.js', 'backend', 'Node.js', 800);

      expect(nodejs.getPopularityLevel()).toBe('trending');
      expect(nodejs.isInDemand()).toBe(true);
    });

    it('should handle database technology', () => {
      const postgres = new Technology(3, 'PostgreSQL', 'database', 'PostgreSQL', 350);

      expect(postgres.getPopularityLevel()).toBe('popular');
      expect(postgres.isInDemand()).toBe(true);
    });

    it('should handle emerging technology', () => {
      const deno = new Technology(4, 'Deno', 'backend', 'Deno', 45);

      expect(deno.getPopularityLevel()).toBe('niche');
      expect(deno.isInDemand()).toBe(false);
    });

    it('should handle cloud platform', () => {
      const aws = new Technology(5, 'AWS', 'other', 'Amazon Web Services', 950);

      expect(aws.getPopularityLevel()).toBe('trending');
      expect(aws.isInDemand()).toBe(true);
    });

    it('should handle DevOps tool', () => {
      const docker = new Technology(6, 'Docker', 'devops', 'Docker', 600);

      expect(docker.getPopularityLevel()).toBe('trending');
      expect(docker.isInDemand()).toBe(true);
    });

    it('should handle mobile framework', () => {
      const reactNative = new Technology(7, 'React Native', 'mobile', 'React Native', 280);

      expect(reactNative.getPopularityLevel()).toBe('popular');
      expect(reactNative.isInDemand()).toBe(true);
    });

    it('should handle specialized technology', () => {
      const graphql = new Technology(8, 'GraphQL', 'backend', 'GraphQL', 180);

      expect(graphql.getPopularityLevel()).toBe('common');
      expect(graphql.isInDemand()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very high job counts', () => {
      const massiveTech = new Technology(1, 'JavaScript', 'frontend', 'JavaScript', 10000);

      expect(massiveTech.getPopularityLevel()).toBe('trending');
      expect(massiveTech.isInDemand()).toBe(true);
      expect(massiveTech.jobCount).toBe(10000);
    });

    it('should handle technology with special characters in name', () => {
      const tech = new Technology(1, 'C++', 'backend', 'C++', 150);

      expect(tech.name).toBe('C++');
      expect(tech.displayName).toBe('C++');
    });

    it('should handle technology with dots in name', () => {
      const tech = new Technology(1, 'Vue.js', 'frontend', 'Vue.js', 200);

      expect(tech.name).toBe('Vue.js');
    });

    it('should handle long display names', () => {
      const tech = new Technology(1, 'AWS', 'other', 'Amazon Web Services Cloud Platform', 500);

      expect(tech.displayName).toBe('Amazon Web Services Cloud Platform');
    });
  });

  describe('Multiple Categories', () => {
    it('should handle frontend technologies', () => {
      const frontend = new Technology(1, 'React', 'frontend', 'React.js', 500);
      expect(frontend.category).toBe('frontend');
    });

    it('should handle backend technologies', () => {
      const backend = new Technology(2, 'Express', 'backend', 'Express.js', 300);
      expect(backend.category).toBe('backend');
    });

    it('should handle database technologies', () => {
      const db = new Technology(3, 'MongoDB', 'database', 'MongoDB', 400);
      expect(db.category).toBe('database');
    });

    it('should handle devops technologies', () => {
      const devops = new Technology(4, 'Kubernetes', 'devops', 'Kubernetes', 350);
      expect(devops.category).toBe('devops');
    });

    it('should handle mobile technologies', () => {
      const mobile = new Technology(5, 'Flutter', 'mobile', 'Flutter', 200);
      expect(mobile.category).toBe('mobile');
    });

    it('should handle ai-ml technologies', () => {
      const aiml = new Technology(6, 'TensorFlow', 'ai-ml', 'TensorFlow', 450);
      expect(aiml.category).toBe('ai-ml');
    });

    it('should handle other category', () => {
      const other = new Technology(7, 'Git', 'other', 'Git', 100);
      expect(other.category).toBe('other');
    });
  });
});
