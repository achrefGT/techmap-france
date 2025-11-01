import { DomainError, DomainErrorCode } from '../../domain/errors/DomainErrors';

export class ErrorFormatter {
  private static readonly MESSAGES: Record<string, Record<string, string>> = {
    'fr-FR': {
      [DomainErrorCode.JOB_TITLE_REQUIRED]: 'Le titre du poste est requis',
      [DomainErrorCode.JOB_NO_TECHNOLOGIES]: 'Le poste doit inclure au moins une technologie',
      [DomainErrorCode.SALARY_INVALID_RANGE]: 'Le salaire minimum ne peut pas dépasser le maximum',
      [DomainErrorCode.SALARY_NEGATIVE]: 'Le salaire ne peut pas être négatif',
      [DomainErrorCode.SALARY_UNREALISTIC]: 'Le salaire semble irréaliste',
      [DomainErrorCode.JOB_FUTURE_DATE]: 'La date de publication ne peut pas être dans le futur',
      [DomainErrorCode.TECHNOLOGY_NAME_REQUIRED]: 'Le nom de la technologie est requis',
      [DomainErrorCode.TECHNOLOGY_INVALID_CATEGORY]: 'Catégorie de technologie invalide',
      [DomainErrorCode.REGION_CODE_INVALID]: 'Code région invalide',
      [DomainErrorCode.JOB_EXPIRED]: 'Cette offre a expiré',
    },
    'en-US': {
      [DomainErrorCode.JOB_TITLE_REQUIRED]: 'Job title is required',
      [DomainErrorCode.JOB_NO_TECHNOLOGIES]: 'Job must include at least one technology',
      [DomainErrorCode.SALARY_INVALID_RANGE]: 'Minimum salary cannot exceed maximum',
      [DomainErrorCode.SALARY_NEGATIVE]: 'Salary cannot be negative',
      [DomainErrorCode.SALARY_UNREALISTIC]: 'Salary seems unrealistic',
      [DomainErrorCode.JOB_FUTURE_DATE]: 'Posted date cannot be in the future',
      [DomainErrorCode.TECHNOLOGY_NAME_REQUIRED]: 'Technology name is required',
      [DomainErrorCode.TECHNOLOGY_INVALID_CATEGORY]: 'Invalid technology category',
      [DomainErrorCode.REGION_CODE_INVALID]: 'Invalid region code',
      [DomainErrorCode.JOB_EXPIRED]: 'This job has expired',
    },
  };

  static format(error: DomainError, locale: string = 'fr-FR'): string {
    const messages = this.MESSAGES[locale] || this.MESSAGES['en-US'];
    let message = messages[error.code] || error.code;

    // Add metadata if present
    if (error.metadata) {
      const metaStr = Object.entries(error.metadata)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      message += ` (${metaStr})`;
    }

    return message;
  }
}
