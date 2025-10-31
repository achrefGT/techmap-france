export class TechnologyDetector {
  private patterns: Map<string, RegExp> = new Map([
    ['React', /\breact(?:js|\.js)?\b/i],
    ['Vue', /\bvue(?:js|\.js)?\b/i],
    ['Angular', /\bangular(?:js)?\b/i],
    ['Node.js', /\bnode(?:\.js|js)?\b/i],
    ['TypeScript', /\btypescript\b/i],
    ['JavaScript', /\bjavascript\b/i],
    ['Python', /\bpython\b/i],
    ['Java', /\bjava\b(?!script)/i],
    ['Spring Boot', /\bspring\s*boot\b/i],
    ['Django', /\bdjango\b/i],
    ['FastAPI', /\bfastapi\b/i],
    ['.NET', /(?:\b(?:dotnet|asp\.?net)\b|\.net\b)/i],
    ['Go', /\b(?:golang|go)\b(?!ogle|od)/i],
    ['PHP', /\bphp\b/i],
    ['Docker', /\bdocker\b/i],
    ['Kubernetes', /\bkubernetes\b/i],
    ['AWS', /\baws\b/i],
    ['Azure', /\bazure\b/i],
    ['GCP', /\bgcp\b/i],
    ['PostgreSQL', /\bpostgresql\b/i],
    ['MongoDB', /\bmongodb\b/i],
    ['Redis', /\bredis\b/i],
    ['GraphQL', /\bgraphql\b/i],
    ['REST API', /\brest\s*api\b/i],
    ['Machine Learning', /\b(?:machine\s*learning|ml)\b/i],
    ['TensorFlow', /\btensorflow\b/i],
    ['PyTorch', /\bpytorch\b/i],
  ]);

  detect(text: string): string[] {
    const found = new Set<string>();
    const lowerText = text.toLowerCase();

    for (const [name, pattern] of this.patterns) {
      if (pattern.test(lowerText)) {
        found.add(name);
      }
    }

    return Array.from(found).sort();
  }
}

export const techDetector = new TechnologyDetector();
