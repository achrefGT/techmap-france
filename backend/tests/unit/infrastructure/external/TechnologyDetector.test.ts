import { describe, it, expect, beforeEach } from '@jest/globals';
import { TechnologyDetector } from '../../../../src/infrastructure/external/TechnologyDetector';

describe('TechnologyDetector', () => {
  let detector: TechnologyDetector;

  beforeEach(() => {
    detector = new TechnologyDetector();
  });

  describe('detect', () => {
    it('should detect single technology', () => {
      const text = 'We are looking for a React developer';
      const result = detector.detect(text);

      expect(result).toContain('React');
      expect(result).toHaveLength(1);
    });

    it('should detect multiple technologies', () => {
      const text = 'Full stack developer with React, Node.js, and PostgreSQL experience';
      const result = detector.detect(text);

      expect(result).toContain('React');
      expect(result).toContain('Node.js');
      expect(result).toContain('PostgreSQL');
      expect(result).toHaveLength(3);
    });

    it('should be case insensitive', () => {
      const text = 'PYTHON and DJANGO developer needed';
      const result = detector.detect(text);

      expect(result).toContain('Python');
      expect(result).toContain('Django');
    });

    it('should handle different variations of technology names', () => {
      const text = 'Experience with reactjs, nodejs, and .NET';
      const result = detector.detect(text);

      expect(result).toContain('React');
      expect(result).toContain('Node.js');
      expect(result).toContain('.NET');
    });

    it('should not detect Java in JavaScript', () => {
      const text = 'JavaScript developer';
      const result = detector.detect(text);

      expect(result).toContain('JavaScript');
      expect(result).not.toContain('Java');
    });

    it('should detect cloud providers', () => {
      const text = 'DevOps engineer with AWS, Azure, and GCP experience';
      const result = detector.detect(text);

      expect(result).toContain('AWS');
      expect(result).toContain('Azure');
      expect(result).toContain('GCP');
    });

    it('should detect containerization technologies', () => {
      const text = 'Docker and Kubernetes experience required';
      const result = detector.detect(text);

      expect(result).toContain('Docker');
      expect(result).toContain('Kubernetes');
    });

    it('should return empty array when no technologies found', () => {
      const text = 'Looking for a motivated team player';
      const result = detector.detect(text);

      expect(result).toHaveLength(0);
    });

    it('should return sorted results', () => {
      const text = 'Vue, React, Angular developer';
      const result = detector.detect(text);

      expect(result).toEqual(['Angular', 'React', 'Vue']);
    });

    it('should not duplicate technologies', () => {
      const text = 'React developer with React experience and React skills';
      const result = detector.detect(text);

      expect(result).toEqual(['React']);
    });

    it('should detect machine learning technologies', () => {
      const text = 'ML engineer with TensorFlow and PyTorch';
      const result = detector.detect(text);

      expect(result).toContain('Machine Learning');
      expect(result).toContain('TensorFlow');
      expect(result).toContain('PyTorch');
    });

    it('should detect API technologies', () => {
      const text = 'Backend with REST API and GraphQL';
      const result = detector.detect(text);

      expect(result).toContain('REST API');
      expect(result).toContain('GraphQL');
    });
  });
});
