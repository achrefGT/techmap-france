/**
 * Experience Level Detector
 * Infrastructure layer - Extracts experience level from job text using pattern matching
 */
export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'lead' | 'unknown';

export class ExperienceDetector {
  private readonly patterns = {
    // Lead/Principal level indicators (check first - most specific)
    LEAD: [
      /\blead\b/i,
      /\bprincipal\b/i,
      /\bstaff\b/i,
      /\bhead\s+of\b/i,
      /\bdirecteur\s+technique\b/i,
      /\bcto\b/i,
      /\btech\s+lead\b/i,
      /\bteam\s+lead\b/i,
    ],

    // Senior level indicators
    SENIOR: [
      /\bsenior\b/i,
      /\bconfirm[eé]\b/i,
      /\bexpert\b/i,
      /\b(?:plus\s+de\s+)?[5-9]\+?\s+ans?\b/i,
      /\b(?:plus\s+de\s+)?1[0-9]\+?\s+ans?\b/i,
      /\b[5-9]\s+ans?\s+d['']expérience\b/i,
      /\b1[0-9]\s+ans?\s+d['']expérience\b/i,
      /\barchitecte\b/i,
      /\bexpériment[eé]\b/i,
    ],

    // Junior level indicators
    JUNIOR: [
      /\bjunior\b/i,
      /\bd[eé]butant\b/i,
      /\bentr[eé]e\s+de\s+carri[eè]re\b/i,
      /\b0[-\s]?[aà][-\s]?2\s+ans?\b/i,
      /\bpremi[eè]re\s+expérience\b/i,
      /\bjeune\s+dipl[oô]m[eé]\b/i,
      /\bstage\b/i,
      /\balternance\b/i,
      /\b[0-2]\s+ans?\s+d['']expérience\b/i,
    ],

    // Mid level indicators
    MID: [
      /\b[3-4]\s+ans?\s+d['']expérience\b/i,
      /\b[3-4]\s+ans?\b/i,
      /\b[2-4][-\s]?[aà][-\s]?5\s+ans?\b/i,
      /\bintermédiaire\b/i,
      /\bmid[-\s]?level\b/i,
      /\bconfirm[eé]\b/i,
    ],
  };

  /**
   * Detect experience level from job text
   * Checks title, experienceLevel field, and description
   * Returns the most specific match (lead > senior > junior > mid > unknown)
   */
  detect(title: string, experienceLevel: string | null, description: string): ExperienceLevel {
    const text = `${title} ${experienceLevel || ''} ${description}`.toLowerCase();

    // Check in order of specificity
    if (this.patterns.LEAD.some(p => p.test(text))) {
      return 'lead';
    }

    if (this.patterns.SENIOR.some(p => p.test(text))) {
      return 'senior';
    }

    if (this.patterns.JUNIOR.some(p => p.test(text))) {
      return 'junior';
    }

    if (this.patterns.MID.some(p => p.test(text))) {
      return 'mid';
    }

    return 'unknown';
  }

  /**
   * Check if text indicates a specific experience level
   */
  matchesLevel(text: string, level: ExperienceLevel): boolean {
    if (level === 'unknown') return false;

    const lowerText = text.toLowerCase();
    return this.patterns[level.toUpperCase() as keyof typeof this.patterns].some(p =>
      p.test(lowerText)
    );
  }
}

export const experienceDetector = new ExperienceDetector();
