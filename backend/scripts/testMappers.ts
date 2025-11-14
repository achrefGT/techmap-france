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
      // ✅ Use pre-detected technologies if available (e.g., from Adzuna)
      // Otherwise detect from description (e.g., France Travail, Remotive)
      const technologies =
        raw.technologies && raw.technologies.length > 0
          ? raw.technologies
          : techDetector.detect(raw.description);

      // Skip jobs with no technologies
      if (technologies.length === 0) {
        continue;
      }

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
        technologies, // ✅ Use the technologies from above
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

    // Handle empty jobs array
    if (jobs.length === 0) {
      return {
        jobs: [],
        avgQuality: 0,
        techStats: { success: false, avgTechCount: 0, coverage: 0 },
        expDistribution: { junior: 0, mid: 0, senior: 0, lead: 0, unknown: 0 },
      };
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
