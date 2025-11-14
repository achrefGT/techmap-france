import 'dotenv/config';
import { writeFileSync } from 'fs';
import { FranceTravailAPI } from '../src/infrastructure/external/FranceTravailAPI';
import { AdzunaAPI } from '../src/infrastructure/external/AdzunaAPI';
import { RemotiveAPI } from '../src/infrastructure/external/RemotiveAPI';
import { FranceTravailMapper } from '../src/infrastructure/external/mappers/FranceTravailMapper';
import { AdzunaMapper } from '../src/infrastructure/external/mappers/AdzunaMapper';
import { RemotiveMapper } from '../src/infrastructure/external/mappers/RemotiveMapper';
import { techDetector } from '../src/infrastructure/external/TechnologyDetector';
import { experienceDetector } from '../src/infrastructure/external/ExperienceDetector';
import { Job } from '../src/domain/entities/Job';
import { RawJobData } from '../src/application/use-cases/JobIngestionService';

interface MapperTestResult {
  source: string;
  passed: boolean;
  details: {
    apiFetch: { success: boolean; count: number; error?: string };
    dtoToRaw: { success: boolean; count: number; validJobs: number; error?: string };
    rawToDomain: { success: boolean; count: number; avgQuality: number; error?: string };
    techDetection: { success: boolean; avgTechCount: number; coverage: number };
    expDetection: { success: boolean; distribution: Record<string, number> };
  };
  samples: Array<{
    title: string;
    company: string;
    technologies: string[];
    experience: string;
    qualityScore: number;
    hasRegion: boolean;
    hasSalary: boolean;
  }>;
  rawApiData?: any[];
  convertedJobs?: any[];
}

interface TestSummary {
  timestamp: string;
  totalSources: number;
  passedSources: number;
  failedSources: number;
  totalJobsFetched: number;
  totalJobsTransformed: number;
  overallStats: {
    avgQualityScore: number;
    avgTechCount: number;
    avgTechCoverage: number;
    experienceDistribution: Record<string, number>;
    topTechnologies: Array<{ tech: string; count: number }>;
  };
}

class MapperTestRunner {
  private results: MapperTestResult[] = [];
  private allJobs: Job[] = [];
  private startTime: Date = new Date();
  private printRawData: boolean = false;

  constructor(printRawData: boolean = false) {
    this.printRawData = printRawData;
  }

  async testAllSources(): Promise<void> {
    console.log('🧪 Testing Mappers & Transformation Pipeline\n');
    console.log('='.repeat(70));
    console.log('This tests the complete transformation WITHOUT database:');
    console.log('  1. API → DTO');
    console.log('  2. DTO → RawJobData (Mapper)');
    console.log('  3. RawJobData → Job Entity');
    console.log('  4. Technology Detection');
    console.log('  5. Experience Detection');
    console.log('  6. Quality Score Calculation');
    if (this.printRawData) {
      console.log('\n🔍 RAW DATA PRINTING ENABLED');
    }
    console.log('='.repeat(70) + '\n');

    await this.testFranceTravailMapper();
    await this.testAdzunaMapper();
    await this.testRemotiveMapper();

    this.displayResults();
    this.generateReports();
  }

  async testSingleSource(source: string): Promise<void> {
    console.log(`🧪 Testing ${source.toUpperCase()} Mapper & Transformation\n`);
    if (this.printRawData) {
      console.log('🔍 RAW DATA PRINTING ENABLED\n');
    }
    console.log('='.repeat(70) + '\n');

    if (source === 'france' || source === 'francetravail') {
      await this.testFranceTravailMapper();
    } else if (source === 'adzuna') {
      await this.testAdzunaMapper();
    } else if (source === 'remotive') {
      await this.testRemotiveMapper();
    } else {
      console.error(`❌ Unknown source: ${source}`);
      console.log('Valid sources: france, adzuna, remotive');
      process.exit(1);
    }

    this.displayResults();
    this.generateReports();
  }

  private printRawApiJob(dto: any, index: number, source: string): void {
    if (!this.printRawData) return;

    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📦 RAW API JOB #${index + 1} (${source})`);
    console.log(`${'─'.repeat(70)}`);
    console.log(JSON.stringify(dto, null, 2));
    console.log(`${'─'.repeat(70)}\n`);
  }

  private printConvertedJob(job: Job, rawData: RawJobData, index: number): void {
    if (!this.printRawData) return;

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`✨ CONVERTED JOB #${index + 1}`);
    console.log(`${'═'.repeat(70)}`);

    console.log('\n📋 RAW JOB DATA (Mapper Output):');
    console.log(
      JSON.stringify(
        {
          id: rawData.id,
          title: rawData.title,
          company: rawData.company,
          description: rawData.description.substring(0, 200) + '...',
          location: rawData.location,
          isRemote: rawData.isRemote,
          salaryMin: rawData.salaryMin,
          salaryMax: rawData.salaryMax,
          experienceLevel: rawData.experienceLevel,
          sourceApi: rawData.sourceApi,
          externalId: rawData.externalId,
          sourceUrl: rawData.sourceUrl,
          postedDate: rawData.postedDate,
        },
        null,
        2
      )
    );

    console.log('\n🎯 JOB ENTITY (Domain Model):');
    console.log(
      JSON.stringify(
        {
          id: job.id,
          title: job.title,
          company: job.company,
          description: job.description.substring(0, 200) + '...',
          technologies: job.technologies,
          location: job.location,
          regionId: job.regionId,
          isRemote: job.isRemote,
          salaryMinKEuros: job.salaryMinKEuros,
          salaryMaxKEuros: job.salaryMaxKEuros,
          experienceLevel: job.experienceLevel,
          experienceCategory: job.experienceCategory,
          qualityScore: job.calculateQualityScore(),
          sourceApi: job.sourceApi,
          externalId: job.externalId,
          sourceUrl: job.sourceUrl,
          postedDate: job.postedDate,
        },
        null,
        2
      )
    );

    console.log(`\n📊 QUALITY BREAKDOWN:`);
    console.log(`   Quality Score: ${job.calculateQualityScore()}/10`);
    console.log(`   Technologies: ${job.technologies.length} detected`);
    console.log(`   Experience: ${job.experienceCategory}`);
    console.log(`   Has Salary: ${job.salaryMinKEuros !== null || job.salaryMaxKEuros !== null}`);
    console.log(`   Is Remote: ${job.isRemote}`);
    console.log(`${'═'.repeat(70)}\n`);
  }

  private async testFranceTravailMapper(): Promise<void> {
    console.log('📡 Testing France Travail API → Mapper → Domain Entity');
    console.log('-'.repeat(70));

    const result: MapperTestResult = {
      source: 'france_travail',
      passed: false,
      details: {
        apiFetch: { success: false, count: 0 },
        dtoToRaw: { success: false, count: 0, validJobs: 0 },
        rawToDomain: { success: false, count: 0, avgQuality: 0 },
        techDetection: { success: false, avgTechCount: 0, coverage: 0 },
        expDetection: { success: false, distribution: {} },
      },
      samples: [],
    };

    try {
      const clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID;
      const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        result.details.apiFetch.error = 'Credentials not configured';
        console.log('  ⚠️  Credentials not configured (skipping)');
        this.results.push(result);
        return;
      }

      console.log('\n  Step 1: API → DTO');
      const api = new FranceTravailAPI(clientId, clientSecret);
      const dtos = await api.fetchJobs({ maxResults: 10 });

      result.details.apiFetch.success = dtos.length > 0;
      result.details.apiFetch.count = dtos.length;
      console.log(`    ✅ Fetched ${dtos.length} DTOs from API`);

      if (dtos.length === 0) {
        result.details.apiFetch.error = 'No jobs returned from API';
        this.results.push(result);
        return;
      }

      // Store raw API data
      result.rawApiData = dtos.slice(0, 3);

      // Print first raw API job if enabled
      if (this.printRawData && dtos.length > 0) {
        this.printRawApiJob(dtos[0], 0, 'France Travail');
      }

      console.log('\n  Step 2: DTO → RawJobData (Mapper)');
      const rawJobs: RawJobData[] = dtos.map(dto => FranceTravailMapper.toRawJobData(dto));

      const validRawJobs = rawJobs.filter(
        raw => raw.id && raw.title && raw.company && raw.description
      );

      result.details.dtoToRaw.success = validRawJobs.length > 0;
      result.details.dtoToRaw.count = rawJobs.length;
      result.details.dtoToRaw.validJobs = validRawJobs.length;
      console.log(`    ✅ Mapped ${rawJobs.length} DTOs to RawJobData`);
      console.log(`    ✅ ${validRawJobs.length} valid jobs (have required fields)`);

      const { jobs, avgQuality, techStats, expDistribution } =
        await this.transformAndAnalyze(validRawJobs);

      // Print first converted job if enabled
      if (this.printRawData && jobs.length > 0) {
        this.printConvertedJob(jobs[0], validRawJobs[0], 0);
      }

      // Store converted jobs
      result.convertedJobs = jobs.slice(0, 3).map(job => ({
        id: job.id,
        title: job.title,
        company: job.company,
        technologies: job.technologies,
        experienceCategory: job.experienceCategory,
        qualityScore: job.calculateQualityScore(),
        location: job.location,
        isRemote: job.isRemote,
        salary: { min: job.salaryMinKEuros, max: job.salaryMaxKEuros },
      }));

      this.allJobs.push(...jobs);

      result.details.rawToDomain.success = jobs.length > 0;
      result.details.rawToDomain.count = jobs.length;
      result.details.rawToDomain.avgQuality = avgQuality;
      result.details.techDetection = techStats;
      result.details.expDetection.success = expDistribution.unknown < jobs.length;
      result.details.expDetection.distribution = expDistribution;

      console.log(`\n  Step 3: Created ${jobs.length} Job entities (avg quality: ${avgQuality})`);
      console.log(
        `  Step 4: Tech detection - ${techStats.avgTechCount} avg, ${techStats.coverage}% coverage`
      );
      console.log(
        `  Step 5: Experience detection - ${Object.values(expDistribution).reduce((a, b) => a + b, 0) - expDistribution.unknown} detected`
      );

      result.samples = jobs.slice(0, 3).map(job => ({
        title: job.title.substring(0, 50) + (job.title.length > 50 ? '...' : ''),
        company: job.company,
        technologies: job.technologies,
        experience: job.experienceCategory,
        qualityScore: Math.round(job.calculateQualityScore() * 10) / 10,
        hasRegion: job.regionId !== null,
        hasSalary: job.salaryMinKEuros !== null || job.salaryMaxKEuros !== null,
      }));

      result.passed =
        result.details.apiFetch.success &&
        result.details.dtoToRaw.success &&
        result.details.rawToDomain.success &&
        result.details.techDetection.coverage > 50 &&
        result.details.rawToDomain.avgQuality > 5.0;

      console.log(
        `\n  ${result.passed ? '✅' : '❌'} France Travail mapper test ${result.passed ? 'PASSED' : 'FAILED'}`
      );
    } catch (error) {
      result.details.apiFetch.error = error instanceof Error ? error.message : 'Unknown error';
      console.log(`\n  ❌ France Travail mapper test FAILED`);
      console.log(`     Error: ${result.details.apiFetch.error}`);
    }

    this.results.push(result);
    console.log();
  }

  private async testAdzunaMapper(): Promise<void> {
    console.log('📡 Testing Adzuna API → Mapper → Domain Entity');
    console.log('-'.repeat(70));

    const result: MapperTestResult = {
      source: 'adzuna',
      passed: false,
      details: {
        apiFetch: { success: false, count: 0 },
        dtoToRaw: { success: false, count: 0, validJobs: 0 },
        rawToDomain: { success: false, count: 0, avgQuality: 0 },
        techDetection: { success: false, avgTechCount: 0, coverage: 0 },
        expDetection: { success: false, distribution: {} },
      },
      samples: [],
    };

    try {
      const appId = process.env.ADZUNA_APP_ID;
      const appKey = process.env.ADZUNA_APP_KEY;

      if (!appId || !appKey) {
        result.details.apiFetch.error = 'Credentials not configured';
        console.log('  ⚠️  Credentials not configured (skipping)');
        this.results.push(result);
        return;
      }

      console.log('\n  Step 1: API → DTO');
      const api = new AdzunaAPI(appId, appKey);
      const dtos = await api.fetchJobs({ maxPages: 1, resultsPerPage: 10 });

      result.details.apiFetch.success = dtos.length > 0;
      result.details.apiFetch.count = dtos.length;
      console.log(`    ✅ Fetched ${dtos.length} DTOs from API`);

      if (dtos.length === 0) {
        result.details.apiFetch.error = 'No jobs returned from API';
        this.results.push(result);
        return;
      }

      result.rawApiData = dtos.slice(0, 3);
      if (this.printRawData && dtos.length > 0) {
        this.printRawApiJob(dtos[0], 0, 'Adzuna');
      }

      console.log('\n  Step 2: DTO → RawJobData (Mapper)');
      const rawJobs: RawJobData[] = dtos.map(dto => AdzunaMapper.toRawJobData(dto));

      const validRawJobs = rawJobs.filter(
        raw => raw.id && raw.title && raw.company && raw.description
      );

      result.details.dtoToRaw.success = validRawJobs.length > 0;
      result.details.dtoToRaw.count = rawJobs.length;
      result.details.dtoToRaw.validJobs = validRawJobs.length;
      console.log(`    ✅ Mapped ${rawJobs.length} DTOs to RawJobData`);
      console.log(`    ✅ ${validRawJobs.length} valid jobs (have required fields)`);

      const { jobs, avgQuality, techStats, expDistribution } =
        await this.transformAndAnalyze(validRawJobs);

      if (this.printRawData && jobs.length > 0) {
        this.printConvertedJob(jobs[0], validRawJobs[0], 0);
      }

      result.convertedJobs = jobs.slice(0, 3).map(job => ({
        id: job.id,
        title: job.title,
        company: job.company,
        technologies: job.technologies,
        experienceCategory: job.experienceCategory,
        qualityScore: job.calculateQualityScore(),
        location: job.location,
        isRemote: job.isRemote,
        salary: { min: job.salaryMinKEuros, max: job.salaryMaxKEuros },
      }));

      this.allJobs.push(...jobs);

      result.details.rawToDomain.success = jobs.length > 0;
      result.details.rawToDomain.count = jobs.length;
      result.details.rawToDomain.avgQuality = avgQuality;
      result.details.techDetection = techStats;
      result.details.expDetection.success = expDistribution.unknown < jobs.length;
      result.details.expDetection.distribution = expDistribution;

      console.log(`\n  Step 3: Created ${jobs.length} Job entities (avg quality: ${avgQuality})`);
      console.log(
        `  Step 4: Tech detection - ${techStats.avgTechCount} avg, ${techStats.coverage}% coverage`
      );
      console.log(
        `  Step 5: Experience detection - ${Object.values(expDistribution).reduce((a, b) => a + b, 0) - expDistribution.unknown} detected`
      );

      result.samples = jobs.slice(0, 3).map(job => ({
        title: job.title.substring(0, 50) + (job.title.length > 50 ? '...' : ''),
        company: job.company,
        technologies: job.technologies,
        experience: job.experienceCategory,
        qualityScore: Math.round(job.calculateQualityScore() * 10) / 10,
        hasRegion: job.regionId !== null,
        hasSalary: job.salaryMinKEuros !== null || job.salaryMaxKEuros !== null,
      }));

      result.passed =
        result.details.apiFetch.success &&
        result.details.dtoToRaw.success &&
        result.details.rawToDomain.success &&
        result.details.techDetection.coverage > 50 &&
        result.details.rawToDomain.avgQuality > 5.0;

      console.log(
        `\n  ${result.passed ? '✅' : '❌'} Adzuna mapper test ${result.passed ? 'PASSED' : 'FAILED'}`
      );
    } catch (error) {
      result.details.apiFetch.error = error instanceof Error ? error.message : 'Unknown error';
      console.log(`\n  ❌ Adzuna mapper test FAILED`);
      console.log(`     Error: ${result.details.apiFetch.error}`);
    }

    this.results.push(result);
    console.log();
  }

  private async testRemotiveMapper(): Promise<void> {
    console.log('📡 Testing Remotive API → Mapper → Domain Entity');
    console.log('-'.repeat(70));

    const result: MapperTestResult = {
      source: 'remotive',
      passed: false,
      details: {
        apiFetch: { success: false, count: 0 },
        dtoToRaw: { success: false, count: 0, validJobs: 0 },
        rawToDomain: { success: false, count: 0, avgQuality: 0 },
        techDetection: { success: false, avgTechCount: 0, coverage: 0 },
        expDetection: { success: false, distribution: {} },
      },
      samples: [],
    };

    try {
      console.log('\n  Step 1: API → DTO');
      const api = new RemotiveAPI();
      const dtos = await api.fetchJobs({ limit: 10 });

      result.details.apiFetch.success = dtos.length > 0;
      result.details.apiFetch.count = dtos.length;
      console.log(`    ✅ Fetched ${dtos.length} DTOs from API`);

      if (dtos.length === 0) {
        result.details.apiFetch.error = 'No jobs returned from API';
        this.results.push(result);
        return;
      }

      result.rawApiData = dtos.slice(0, 3);
      if (this.printRawData && dtos.length > 0) {
        this.printRawApiJob(dtos[0], 0, 'Remotive');
      }

      console.log('\n  Step 2: DTO → RawJobData (Mapper)');
      const rawJobs: RawJobData[] = dtos.map(dto => RemotiveMapper.toRawJobData(dto));

      const validRawJobs = rawJobs.filter(
        raw => raw.id && raw.title && raw.company && raw.description
      );

      result.details.dtoToRaw.success = validRawJobs.length > 0;
      result.details.dtoToRaw.count = rawJobs.length;
      result.details.dtoToRaw.validJobs = validRawJobs.length;
      console.log(`    ✅ Mapped ${rawJobs.length} DTOs to RawJobData`);
      console.log(`    ✅ ${validRawJobs.length} valid jobs (have required fields)`);

      const { jobs, avgQuality, techStats, expDistribution } =
        await this.transformAndAnalyze(validRawJobs);

      if (this.printRawData && jobs.length > 0) {
        this.printConvertedJob(jobs[0], validRawJobs[0], 0);
      }

      result.convertedJobs = jobs.slice(0, 3).map(job => ({
        id: job.id,
        title: job.title,
        company: job.company,
        technologies: job.technologies,
        experienceCategory: job.experienceCategory,
        qualityScore: job.calculateQualityScore(),
        location: job.location,
        isRemote: job.isRemote,
        salary: { min: job.salaryMinKEuros, max: job.salaryMaxKEuros },
      }));

      this.allJobs.push(...jobs);

      result.details.rawToDomain.success = jobs.length > 0;
      result.details.rawToDomain.count = jobs.length;
      result.details.rawToDomain.avgQuality = avgQuality;
      result.details.techDetection = techStats;
      result.details.expDetection.success = expDistribution.unknown < jobs.length;
      result.details.expDetection.distribution = expDistribution;

      console.log(`\n  Step 3: Created ${jobs.length} Job entities (avg quality: ${avgQuality})`);
      console.log(
        `  Step 4: Tech detection - ${techStats.avgTechCount} avg, ${techStats.coverage}% coverage`
      );
      console.log(
        `  Step 5: Experience detection - ${Object.values(expDistribution).reduce((a, b) => a + b, 0) - expDistribution.unknown} detected`
      );

      result.samples = jobs.slice(0, 3).map(job => ({
        title: job.title.substring(0, 50) + (job.title.length > 50 ? '...' : ''),
        company: job.company,
        technologies: job.technologies,
        experience: job.experienceCategory,
        qualityScore: Math.round(job.calculateQualityScore() * 10) / 10,
        hasRegion: job.regionId !== null,
        hasSalary: job.salaryMinKEuros !== null || job.salaryMaxKEuros !== null,
      }));

      result.passed =
        result.details.apiFetch.success &&
        result.details.dtoToRaw.success &&
        result.details.rawToDomain.success &&
        result.details.techDetection.coverage > 50 &&
        result.details.rawToDomain.avgQuality > 5.0;

      console.log(
        `\n  ${result.passed ? '✅' : '❌'} Remotive mapper test ${result.passed ? 'PASSED' : 'FAILED'}`
      );
    } catch (error) {
      result.details.apiFetch.error = error instanceof Error ? error.message : 'Unknown error';
      console.log(`\n  ❌ Remotive mapper test FAILED`);
      console.log(`     Error: ${result.details.apiFetch.error}`);
    }

    this.results.push(result);
    console.log();
  }

  private async transformAndAnalyze(rawJobs: RawJobData[]): Promise<{
    jobs: Job[];
    avgQuality: number;
    techStats: { success: boolean; avgTechCount: number; coverage: number };
    expDistribution: Record<string, number>;
  }> {
    const jobs: Job[] = [];

    for (const raw of rawJobs) {
      const technologies = techDetector.detect(raw.description);
      const experienceCategory = experienceDetector.detect(
        raw.title,
        raw.experienceLevel,
        raw.description
      );

      const job = new Job(
        raw.id,
        raw.title,
        raw.company,
        raw.description,
        technologies,
        raw.location,
        null,
        raw.isRemote,
        raw.salaryMin,
        raw.salaryMax,
        raw.experienceLevel,
        experienceCategory,
        raw.sourceApi,
        raw.externalId,
        raw.sourceUrl,
        raw.postedDate instanceof Date ? raw.postedDate : new Date(raw.postedDate)
      );

      jobs.push(job);
    }

    const avgQuality =
      jobs.reduce((sum, job) => sum + job.calculateQualityScore(), 0) / jobs.length;
    const totalTechs = jobs.reduce((sum, job) => sum + job.technologies.length, 0);
    const avgTechs = totalTechs / jobs.length;
    const jobsWithTech = jobs.filter(job => job.technologies.length > 0).length;
    const techCoverage = (jobsWithTech / jobs.length) * 100;

    const expDistribution: Record<string, number> = {
      junior: 0,
      mid: 0,
      senior: 0,
      lead: 0,
      unknown: 0,
    };

    jobs.forEach(job => {
      expDistribution[job.experienceCategory]++;
    });

    return {
      jobs,
      avgQuality: Math.round(avgQuality * 10) / 10,
      techStats: {
        success: techCoverage > 50,
        avgTechCount: Math.round(avgTechs * 10) / 10,
        coverage: Math.round(techCoverage),
      },
      expDistribution,
    };
  }

  private calculateOverallStats(): TestSummary['overallStats'] {
    const totalJobs = this.allJobs.length;

    if (totalJobs === 0) {
      return {
        avgQualityScore: 0,
        avgTechCount: 0,
        avgTechCoverage: 0,
        experienceDistribution: {},
        topTechnologies: [],
      };
    }

    const avgQuality =
      this.allJobs.reduce((sum, job) => sum + job.calculateQualityScore(), 0) / totalJobs;
    const totalTechs = this.allJobs.reduce((sum, job) => sum + job.technologies.length, 0);
    const avgTechs = totalTechs / totalJobs;
    const jobsWithTech = this.allJobs.filter(job => job.technologies.length > 0).length;
    const techCoverage = (jobsWithTech / totalJobs) * 100;

    const expDistribution: Record<string, number> = {};
    this.allJobs.forEach(job => {
      expDistribution[job.experienceCategory] = (expDistribution[job.experienceCategory] || 0) + 1;
    });

    const techCounts: Record<string, number> = {};
    this.allJobs.forEach(job => {
      job.technologies.forEach(tech => {
        techCounts[tech] = (techCounts[tech] || 0) + 1;
      });
    });

    const topTechnologies = Object.entries(techCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tech, count]) => ({ tech, count }));

    return {
      avgQualityScore: Math.round(avgQuality * 10) / 10,
      avgTechCount: Math.round(avgTechs * 10) / 10,
      avgTechCoverage: Math.round(techCoverage),
      experienceDistribution: expDistribution,
      topTechnologies,
    };
  }

  private displayResults(): void {
    console.log('\n' + '='.repeat(70));
    console.log('📊 MAPPER TEST RESULTS SUMMARY');
    console.log('='.repeat(70) + '\n');

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.source.toUpperCase()}`);
      console.log('-'.repeat(70));

      if (result.details.apiFetch.error) {
        console.log(`   Error: ${result.details.apiFetch.error}`);
      } else {
        console.log(`   API Fetch:       ${result.details.apiFetch.count} DTOs`);
        console.log(
          `   Mapper:          ${result.details.dtoToRaw.validJobs}/${result.details.dtoToRaw.count} valid RawJobData`
        );
        console.log(`   Job Entities:    ${result.details.rawToDomain.count} created`);
        console.log(`   Quality Score:   ${result.details.rawToDomain.avgQuality}`);
        console.log(
          `   Tech Detection:  ${result.details.techDetection.avgTechCount} avg, ${result.details.techDetection.coverage}% coverage`
        );
        console.log(
          `   Exp Detection:   ${JSON.stringify(result.details.expDetection.distribution)}`
        );

        if (result.samples.length > 0) {
          console.log(`\n   Sample Jobs:`);
          result.samples.forEach((sample, i) => {
            console.log(`     ${i + 1}. "${sample.title}"`);
            console.log(`        Company: ${sample.company}`);
            console.log(`        Tech: [${sample.technologies.join(', ')}]`);
            console.log(`        Experience: ${sample.experience}`);
            console.log(
              `        Quality: ${sample.qualityScore}, Salary: ${sample.hasSalary ? '✓' : '✗'}`
            );
          });
        }
      }
      console.log();
    });

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log('='.repeat(70));
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
    console.log('='.repeat(70) + '\n');

    if (passed === total) {
      console.log('🎉 All mapper tests passed!\n');
    } else {
      console.log('⚠️  Some mapper tests failed. Review errors above.\n');
    }
  }

  private generateReports(): void {
    const timestamp = this.startTime.toISOString().replace(/[:.]/g, '-').slice(0, -5);

    // Generate JSON report
    this.generateJSONReport(timestamp);

    // Generate Markdown report
    this.generateMarkdownReport(timestamp);

    console.log('📄 Reports generated:');
    console.log(`   - test-results-${timestamp}.json`);
    console.log(`   - test-results-${timestamp}.md\n`);
  }

  private generateJSONReport(timestamp: string): void {
    const totalJobsFetched = this.results.reduce((sum, r) => sum + r.details.apiFetch.count, 0);
    const totalJobsTransformed = this.results.reduce(
      (sum, r) => sum + r.details.rawToDomain.count,
      0
    );

    const summary: TestSummary = {
      timestamp: this.startTime.toISOString(),
      totalSources: this.results.length,
      passedSources: this.results.filter(r => r.passed).length,
      failedSources: this.results.filter(r => !r.passed).length,
      totalJobsFetched,
      totalJobsTransformed,
      overallStats: this.calculateOverallStats(),
    };

    const report = {
      summary,
      results: this.results,
    };

    writeFileSync(`test-results-${timestamp}.json`, JSON.stringify(report, null, 2));
  }

  private generateMarkdownReport(timestamp: string): void {
    const totalJobsFetched = this.results.reduce((sum, r) => sum + r.details.apiFetch.count, 0);
    const totalJobsTransformed = this.results.reduce(
      (sum, r) => sum + r.details.rawToDomain.count,
      0
    );
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const overallStats = this.calculateOverallStats();

    let markdown = `# Mapper Test Results Report\n\n`;
    markdown += `**Generated:** ${this.startTime.toISOString()}\n\n`;
    markdown += `---\n\n`;

    // Executive Summary
    markdown += `## 📊 Executive Summary\n\n`;
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| **Total Sources Tested** | ${this.results.length} |\n`;
    markdown += `| **✅ Passed** | ${passed} |\n`;
    markdown += `| **❌ Failed** | ${failed} |\n`;
    markdown += `| **Success Rate** | ${((passed / this.results.length) * 100).toFixed(1)}% |\n`;
    markdown += `| **Total Jobs Fetched** | ${totalJobsFetched} |\n`;
    markdown += `| **Total Jobs Transformed** | ${totalJobsTransformed} |\n`;
    markdown += `| **Avg Quality Score** | ${overallStats.avgQualityScore}/10 |\n`;
    markdown += `| **Avg Technologies/Job** | ${overallStats.avgTechCount} |\n`;
    markdown += `| **Tech Coverage** | ${overallStats.avgTechCoverage}% |\n\n`;

    // Experience Distribution
    if (Object.keys(overallStats.experienceDistribution).length > 0) {
      markdown += `### Experience Level Distribution\n\n`;
      markdown += `| Level | Count | Percentage |\n`;
      markdown += `|-------|-------|------------|\n`;
      const total = Object.values(overallStats.experienceDistribution).reduce((a, b) => a + b, 0);
      Object.entries(overallStats.experienceDistribution)
        .sort(([, a], [, b]) => b - a)
        .forEach(([level, count]) => {
          const pct = ((count / total) * 100).toFixed(1);
          markdown += `| ${level} | ${count} | ${pct}% |\n`;
        });
      markdown += `\n`;
    }

    // Top Technologies
    if (overallStats.topTechnologies.length > 0) {
      markdown += `### Top 10 Technologies Detected\n\n`;
      markdown += `| Rank | Technology | Occurrences |\n`;
      markdown += `|------|------------|-------------|\n`;
      overallStats.topTechnologies.forEach((tech, idx) => {
        markdown += `| ${idx + 1} | ${tech.tech} | ${tech.count} |\n`;
      });
      markdown += `\n`;
    }

    // Detailed Results by Source
    markdown += `---\n\n## 📡 Detailed Results by Source\n\n`;

    this.results.forEach(result => {
      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      markdown += `### ${result.source.toUpperCase()} - ${status}\n\n`;

      if (result.details.apiFetch.error) {
        markdown += `**Error:** ${result.details.apiFetch.error}\n\n`;
      } else {
        markdown += `#### Pipeline Statistics\n\n`;
        markdown += `| Stage | Metric | Value |\n`;
        markdown += `|-------|--------|-------|\n`;
        markdown += `| **Step 1: API Fetch** | DTOs Fetched | ${result.details.apiFetch.count} |\n`;
        markdown += `| **Step 2: Mapper** | Valid RawJobData | ${result.details.dtoToRaw.validJobs}/${result.details.dtoToRaw.count} |\n`;
        markdown += `| **Step 3: Domain Entities** | Jobs Created | ${result.details.rawToDomain.count} |\n`;
        markdown += `| | Avg Quality Score | ${result.details.rawToDomain.avgQuality}/10 |\n`;
        markdown += `| **Step 4: Tech Detection** | Avg Technologies | ${result.details.techDetection.avgTechCount} |\n`;
        markdown += `| | Coverage | ${result.details.techDetection.coverage}% |\n`;
        markdown += `| **Step 5: Experience Detection** | Distribution | ${JSON.stringify(result.details.expDetection.distribution)} |\n\n`;

        // Sample Jobs
        if (result.samples.length > 0) {
          markdown += `#### Sample Jobs (First ${result.samples.length})\n\n`;
          result.samples.forEach((sample, i) => {
            markdown += `**${i + 1}. ${sample.title}**\n`;
            markdown += `- Company: ${sample.company}\n`;
            markdown += `- Technologies: ${sample.technologies.join(', ') || 'None detected'}\n`;
            markdown += `- Experience: ${sample.experience}\n`;
            markdown += `- Quality Score: ${sample.qualityScore}/10\n`;
            markdown += `- Has Salary: ${sample.hasSalary ? '✓' : '✗'}\n\n`;
          });
        }

        // Raw API Data (first job only)
        if (result.rawApiData && result.rawApiData.length > 0) {
          markdown += `#### Raw API Data Sample\n\n`;
          markdown += `<details>\n<summary>Click to expand first raw API job</summary>\n\n`;
          markdown += `\`\`\`json\n${JSON.stringify(result.rawApiData[0], null, 2)}\n\`\`\`\n\n`;
          markdown += `</details>\n\n`;
        }

        // Converted Job Data (first job only)
        if (result.convertedJobs && result.convertedJobs.length > 0) {
          markdown += `#### Converted Job Sample\n\n`;
          markdown += `<details>\n<summary>Click to expand first converted job</summary>\n\n`;
          markdown += `\`\`\`json\n${JSON.stringify(result.convertedJobs[0], null, 2)}\n\`\`\`\n\n`;
          markdown += `</details>\n\n`;
        }
      }

      markdown += `---\n\n`;
    });

    // Test Criteria
    markdown += `## ✅ Test Pass Criteria\n\n`;
    markdown += `A source passes the test if ALL of the following conditions are met:\n\n`;
    markdown += `1. ✅ **API Fetch Success**: At least 1 DTO fetched from the API\n`;
    markdown += `2. ✅ **Mapper Success**: At least 1 valid RawJobData created\n`;
    markdown += `3. ✅ **Domain Transformation**: At least 1 Job entity created\n`;
    markdown += `4. ✅ **Tech Coverage**: > 50% of jobs have detected technologies\n`;
    markdown += `5. ✅ **Quality Score**: Average quality score > 5.0/10\n\n`;

    // Summary Footer
    markdown += `---\n\n`;
    markdown += `## 🎯 Final Summary\n\n`;
    markdown += `- **Total Sources Tested:** ${this.results.length}\n`;
    markdown += `- **Passed:** ${passed}\n`;
    markdown += `- **Failed:** ${failed}\n`;
    markdown += `- **Success Rate:** ${((passed / this.results.length) * 100).toFixed(1)}%\n\n`;

    if (passed === this.results.length) {
      markdown += `### 🎉 All tests passed! The mapper pipeline is working correctly.\n\n`;
    } else {
      markdown += `### ⚠️ Some tests failed. Please review the detailed results above.\n\n`;
    }

    markdown += `**Test Duration:** ${((Date.now() - this.startTime.getTime()) / 1000).toFixed(2)}s\n`;

    writeFileSync(`test-results-${timestamp}.md`, markdown);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const source = args[0]?.toLowerCase();
  const printRaw =
    args.includes('--print-raw') || args.includes('-v') || args.includes('--verbose');

  const runner = new MapperTestRunner(printRaw);

  try {
    if (source && source !== '--print-raw' && source !== '-v' && source !== '--verbose') {
      await runner.testSingleSource(source);
    } else {
      await runner.testAllSources();
    }
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Test runner crashed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
