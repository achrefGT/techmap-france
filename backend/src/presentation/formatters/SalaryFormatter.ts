import { Job } from '../../domain/entities/Job';

export class SalaryFormatter {
  static format(job: Job, locale: string = 'fr-FR'): string {
    const { salaryMinKEuros, salaryMaxKEuros } = job;

    if (!salaryMinKEuros && !salaryMaxKEuros) {
      return locale === 'fr-FR' ? 'Non communiqué' : 'Not specified';
    }

    if (!salaryMaxKEuros) {
      return locale === 'fr-FR'
        ? `À partir de ${salaryMinKEuros}k€/an`
        : `From ${salaryMinKEuros}k€/year`;
    }

    if (!salaryMinKEuros) {
      return locale === 'fr-FR'
        ? `Jusqu'à ${salaryMaxKEuros}k€/an`
        : `Up to ${salaryMaxKEuros}k€/year`;
    }

    return `${salaryMinKEuros}k - ${salaryMaxKEuros}k€/an`;
  }
}
