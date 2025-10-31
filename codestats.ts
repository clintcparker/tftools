import * as fs from 'fs';
import * as querystring from 'querystring';
import * as util from 'util';
import { exec as execCallback } from 'child_process';
import * as path from 'path';
import simpleGit, { SimpleGit, StatusResult, LogResult } from 'simple-git';
import { parse } from 'json2csv';
import asyncPool from 'tiny-async-pool';
import expandHomeDir from 'expand-home-dir';
import tfsUtilsModule, { TfsOptions } from './ADOUtilities';
import buildModuleFactory from './buildModule';
import { StatsOptions, Repository, TestRun } from './shared-types';

const exec = util.promisify(execCallback);

interface RepoInfo {
    id: string;
    project: string;
    name?: string;
}

interface RepoResult {
    repo: string;
    tests_passing?: number;
    tests_failing?: number;
    branches_total?: string | number;
    branches_covered?: string | number;
    lines_total?: string | number;
    lines_covered?: string | number;
    build?: string;
    nFiles?: number;
    blank?: number;
    comment?: number;
    code?: number;
    grep_tests?: number;
}

interface Coverage {
    branches_total: string | number;
    branches_covered: string | number;
    lines_total: string | number;
    lines_covered: string | number;
}

interface Tests {
    passing: number;
    failing: number;
    skipped?: number;
}

interface BuildInfo {
    id: string;
    url: string;
    uri: string;
}

interface VSTSStats {
    tests: Tests;
    coverage: Coverage;
    buildInfo: BuildInfo;
}

interface CoverageStats {
    label: string;
    covered: number;
    total: number;
}

interface CoverageData {
    coverageStats: CoverageStats[];
}

const statsModule = function(tfsOpts: TfsOptions) {
    const tfsUtils = tfsUtilsModule(tfsOpts);
    const buildModule = buildModuleFactory(tfsOpts);

    async function getBuildDefs(statsOpts: StatsOptions): Promise<any[]> {
        expand(statsOpts);
        const repos = await getFilesInDir(statsOpts.Directory);
        return getBuildDefsForRepos(repos, statsOpts.Directory);
    }

    async function calcStats(statsOpts: StatsOptions): Promise<any[]> {
        return new Promise(async resolve => {
            const dates = statsOpts.dates || [];
            const results = await asyncPool(6, dates, date => {
                const opts = Object.assign({}, statsOpts);
                opts.EndDate = new Date(date);
                return getCodeStatForDate(opts);
            });
            resolve(results);
        });
    }

    function getCodeStatForDate(opts: StatsOptions): Promise<any> {
        return new Promise(async resolve => {
            const results = await calcStatsForDate(opts);
            resolve(results);
        });
    }

    async function getBuildDefsForRepos(repos: string[], TOP_DIRECTORY: string): Promise<any[]> {
        return new Promise(async resolve => {
            const results = await asyncPool(5, repos, repo => {
                return getBuildDefinitionForRepo(repo, TOP_DIRECTORY);
            });
            resolve(results);
        });
    }

    async function getBuildDefinitionForRepo(repoName: string, Directory: string): Promise<any> {
        const gitConfigFile = path.join(Directory, repoName, ".git", "config");
        const remote = await getRemoteFromFile(gitConfigFile);
        const info = await getRepoInfoFromRemoteUrl(remote);
        return buildModule.getBuildDefinitionForRepo(info);
    }

    function expand(incomingOpts: StatsOptions): void {
        for (const propName in incomingOpts) {
            const prop = incomingOpts[propName] + "";
            if ((prop + "").startsWith("~")) {
                const expanded = expandHomeDir(prop);
                incomingOpts[propName] = expanded;
            }
        }
    }

    async function calcStatsForDate(statsOpts: StatsOptions): Promise<RepoResult[]> {
        return new Promise(async (resolve, reject) => {
            for (const propName in statsOpts) {
                const prop = statsOpts[propName] + "";
                if ((prop + "").startsWith("~")) {
                    const expanded = expandHomeDir(prop);
                    statsOpts[propName] = expanded;
                }
            }

            const ROLLUP_BU = path.basename(statsOpts.Directory);
            const endDate = statsOpts.EndDate;
            const dateStr = buildDateStringForGit(endDate);
            const TOP_DIRECTORY = statsOpts.Directory;
            const outputDirectory = path.join(statsOpts.outputDirectory, `${ROLLUP_BU} ${dateStr}`);
            const resultFile = `${ROLLUP_BU}-${buildDateString(endDate)}.csv`;

            const getVSTSStats = statsOpts.VSTS;
            const getCLOC = statsOpts.CLOC;
            const getTests = statsOpts.Tests;

            try {
                if (getVSTSStats || getCLOC || getTests || statsOpts.build) {
                    await fs.promises.mkdir(outputDirectory).catch((err) => {
                        console.log(err);
                    });

                    const repos = await getFilesInDir(TOP_DIRECTORY);
                    const results = await getStatsForRepos(
                        repos,
                        TOP_DIRECTORY,
                        outputDirectory,
                        dateStr,
                        getCLOC || false,
                        getVSTSStats || false,
                        getTests || false,
                        resultFile,
                        statsOpts
                    );

                    resolve(results);
                }
            } catch (err) {
                console.log(err);
                reject(err);
            }
        });
    }

    async function getFilesInDir(TOP_DIRECTORY: string): Promise<string[]> {
        return new Promise(async resolve => {
            await fs.readdir(TOP_DIRECTORY, async function(err, repos) {
                resolve(repos.filter(x => x !== ".DS_Store"));
            });
        });
    }

    async function getStatsForRepos(
        repos: string[],
        TOP_DIRECTORY: string,
        outputDirectory: string,
        dateStr: string,
        getCLOC: boolean,
        getVSTSStats: boolean,
        getTests: boolean,
        resultFile: string,
        statsOpts: StatsOptions
    ): Promise<RepoResult[]> {
        return new Promise(async resolve => {
            let results: RepoResult[] = await asyncPool(6, repos, repo => {
                return getStatsForRepo(repo, TOP_DIRECTORY, outputDirectory, dateStr, getCLOC, getVSTSStats, getTests, Object.assign({}, statsOpts));
            });

            if (getCLOC) {
                const { stdout, stderr } = await exec(`ls`, { "cwd": `${outputDirectory}` });
                // Sanitize ls output to prevent command injection
                const ls = stdout.split(/\r?\n/).filter(f => f.trim() !== '').map(f => {
                    // Only allow alphanumeric, dash, underscore, and dot for filenames
                    return f.replace(/[^a-zA-Z0-9._-]/g, '');
                }).join(" ");
                await exec(`cloc --sum-reports --out="${path.join(outputDirectory, "totals")}" ${ls}`, { "cwd": `${outputDirectory}` });
                await exec(`cloc --csv --sum-reports --out="${path.join(outputDirectory, "totals-csv")}" ${ls}`, { "cwd": `${outputDirectory}` });
                const { stdout: jsonStdout } = await exec(`cloc --json --sum-reports ${ls}`, { "cwd": `${outputDirectory}` });
                const clocJSON = await JSON.parse("[" + jsonStdout.replace(/\n\s*\n/g, ",") + "]");
                const repositories = clocJSON[1];

                for (const i in results) {
                    const result = results[i];
                    const repo = repositories[result.repo];
                    if (repo) {
                        result.nFiles = repo.nFiles;
                        result.blank = repo.blank;
                        result.comment = repo.comment;
                        result.code = repo.code;
                    }
                }
            }

            await fs.promises.writeFile(
                path.join(outputDirectory, resultFile),
                parse(results)
            );

            resolve(results);
        });
    }

    async function getStatsForRepo(
        repo: string,
        TOP_DIRECTORY: string,
        outputDirectory: string,
        dateStr: string,
        getCLOC: boolean,
        getVSTSStats: boolean,
        getTests: boolean,
        statsOpts: StatsOptions
    ): Promise<RepoResult> {
        if (repo === ".DS_Store") {
            return { repo: repo };
        }

        return new Promise(async resolve => {
            const repoResult: RepoResult = {
                repo: repo,
            };

            const filename = path.join(outputDirectory, repo);
            const gitInstance = simpleGit();
            await gitInstance.cwd(path.join(TOP_DIRECTORY, repo));

            if (statsOpts.pull) {
                await gitInstance.pull();
            }

            let branchName: string = '';
            await gitInstance.status(function(err: Error | null, status: StatusResult) {
                branchName = status.current || '';
            });

            const hash = await getHash(TOP_DIRECTORY, repo, dateStr, gitInstance);
            let grep_tests = 0;
            let clocResults: string | undefined;

            if (statsOpts.build) {
                const gitConfigFile = path.join(TOP_DIRECTORY, repo, ".git", "config");
                const remote = await getRemoteFromFile(gitConfigFile);
                const info = await getRepoInfoFromRemoteUrl(remote);
                await buildModule.queueBuildForRepo(info, hash, branchName);
            }

            if (getCLOC) {
                clocResults = await clocRepo(filename, path.join(TOP_DIRECTORY, repo), hash, statsOpts);
            }

            let vstsStats: VSTSStats | undefined;
            if (getVSTSStats) {
                vstsStats = await getVSTSStatsForRepo(TOP_DIRECTORY, repo, hash, branchName);
            }

            if (getTests) {
                if (hash !== "") {
                    await gitInstance.checkout(`${hash}`);
                    const testCommand = `grep -Eo -r -i "\\s*\\[(Fact|TestMethod|Theory).*" . | wc -l`;
                    const { stdout, stderr } = await exec(testCommand, { "cwd": path.join(TOP_DIRECTORY, repo) });
                    grep_tests = await parseInt(stdout, 10);
                    await gitInstance.checkout(branchName);
                }
            }

            if (vstsStats === undefined) {
                // console.log(`${repo} : weird tests`)
            }

            if (getVSTSStats && vstsStats) {
                repoResult.tests_passing = vstsStats.tests.passing;
                repoResult.tests_failing = vstsStats.tests.failing;
                repoResult.branches_total = vstsStats.coverage.branches_total;
                repoResult.branches_covered = vstsStats.coverage.branches_covered;
                repoResult.lines_total = vstsStats.coverage.lines_total;
                repoResult.lines_covered = vstsStats.coverage.lines_covered;
                repoResult.build = vstsStats.buildInfo.url;
            }

            if (getCLOC) {
                repoResult.nFiles = 0;
                repoResult.blank = 0;
                repoResult.comment = 0;
                repoResult.code = 0;
            }

            if (getTests) {
                repoResult.grep_tests = grep_tests;
            }

            resolve(repoResult);
        });
    }

    async function getVSTSStatsForRepo(
        TOP_DIRECTORY: string,
        repo: string,
        hash: string,
        branchName: string
    ): Promise<VSTSStats> {
        const coverage: Coverage = {
            branches_total: "",
            branches_covered: "",
            lines_total: "",
            lines_covered: ""
        };
        const tests: Tests = { passing: 0, failing: 0 };

        if (hash !== "") {
            return new Promise(async resolve => {
                const gitConfigFile = path.join(TOP_DIRECTORY, repo, ".git", "config");
                const remote = await getRemoteFromFile(gitConfigFile);
                const info = await getRepoInfoFromRemoteUrl(remote);
                const project = info.project;
                info.name = repo;
                const buildInfo = await buildModule.getLatestBuildSource(info, hash, branchName);
                const build = buildInfo.id;

                let finalTests = tests;
                let finalCoverage = coverage;

                if (build) {
                    finalTests = await getTestsForBuild(build, project, buildInfo.uri);
                    finalCoverage = await getCoverageForBuild(build, project);
                }

                resolve({ tests: finalTests, coverage: finalCoverage, buildInfo: buildInfo });
            });
        } else {
            return { tests: tests, coverage: coverage, buildInfo: { id: "", url: "no build", uri: "" } };
        }
    }

    async function clocRepo(filename: string, dirPath: string, hash: string, statsOpts: StatsOptions): Promise<string | undefined> {
        if (hash !== "") {
            return new Promise(async resolve => {
                const cloc_command_include_lang: any = {};
                const cloc_command_exclude_dir: any = {};
                const cloc_command_out = {
                    "out": `"${filename}"`,
                };

                if (statsOpts.langFilters) {
                    cloc_command_include_lang["include-lang"] = `"${statsOpts.langFilters.join(",")}"`;
                }

                if (statsOpts.excludeDirs) {
                    cloc_command_exclude_dir["exclude-dir"] = `"${statsOpts.excludeDirs.join(",")}"`;
                }

                const clocCommandObj: any = {};
                Object.assign(clocCommandObj, cloc_command_out, cloc_command_include_lang, cloc_command_exclude_dir);
                const clocCommandArr: string[] = [];

                for (const propName in clocCommandObj) {
                    const prop = clocCommandObj[propName] + "";
                    clocCommandArr.push(`--${propName}=${prop}`);
                    if ((prop + "").startsWith("~")) {
                        const expanded = expandHomeDir(prop);
                        clocCommandObj[propName] = expanded;
                    }
                }

                const cloc_command_args = clocCommandArr.join("  ");

                // Sanitize hash to prevent command injection - only allow hex characters
                const sanitizedHash = hash.replace(/[^a-f0-9]/gi, '');
                const cloc_command = `cloc ${cloc_command_args} ${sanitizedHash}`;

                const { stdout, stderr } = await exec(cloc_command, { "cwd": `${dirPath}` });
                resolve(stdout);
            });
        }
        return undefined;
    }

    //#region helpers
    async function getRemoteFromFile(gitConfigFile: string): Promise<string> {
        return new Promise(async resolve => {
            await fs.readFile(gitConfigFile, async function(err, data) {
                const pattern = /remote.*[\r\n\s]*\w+[\s=]*(?<url>.*)[\r\n\s]+/;
                (pattern as any).dotAll = true;
                const str = data.toString();
                const match = str.match(pattern);
                const remote = match ? match[1] : '';
                resolve(remote);
            });
        });
    }

    async function getHash(TOP_DIRECTORY: string, repo: string, dateStr: string, gitInstance: SimpleGit): Promise<string> {
        const logOpts: any = { "--max-count": "1", "--before": `"${dateStr}"` };
        if (!gitInstance) {
            gitInstance = simpleGit();
        }

        return new Promise(async resolve => {
            await gitInstance.cwd(path.join(TOP_DIRECTORY, repo)).log(logOpts, function(err: Error | null, logs: LogResult) {
                let hash = "";
                if (logs.latest) {
                    hash = logs.latest.hash;
                }
                resolve(hash);
            });
        });
    }

    async function getRepoInfoFromRemoteUrl(remoteUrl: string): Promise<RepoInfo> {
        const val: Repository[] = await tfsUtils.getRepos();
        const repo = val.find(y => y.remoteUrl === remoteUrl);
        if (!repo) {
            throw new Error(`Repository not found for remote URL: ${remoteUrl}`);
        }
        const id = repo.id;
        const project = repo.project.id;
        return { id: id, project: project };
    }

    function isValidBuild(build: any): boolean {
        const isGated = build.definition.name.toLowerCase().includes("gated");
        const isSonar = build.definition.name.toLowerCase().includes("sonar");
        const isGood = build.result.toLowerCase().includes("succeeded");
        return isGated || isSonar;
    }

    async function getCoverageForBuild(buildId: string, project: string): Promise<Coverage> {
        const queryParameters = {
            "buildId": buildId
        };
        const apiPath = `/${project}${(tfsOpts as any).COVERAGE_API_PATH}&${querystring.stringify(queryParameters)}`;
        const coverageResponse = await tfsUtils.ADORequest(apiPath);
        const coverage = coverageResponse.coverageData[0];
        const coverageInfo = getCoverageInfo(coverage);
        return coverageInfo;
    }

    async function getTestsForBuild(buildId: string, project: string, uri: string): Promise<Tests> {
        const queryParameters = {
            "buildUri": uri,
        };
        const apiPath = `/${project}${(tfsOpts as any).TEST_API_PATH}&${querystring.stringify(queryParameters)}`;
        const testRunResponse = await tfsUtils.ADORequest(apiPath);
        const testRuns = testRunResponse.value;

        if (testRuns && testRuns.length > 0) {
            const testRunData = getTestRunData(testRuns);
            return testRunData;
        } else {
            return { passing: 0, failing: 0 };
        }
    }

    function getTestRunData(testRuns: TestRun[]): Tests {
        if (testRuns.length === 1) {
            return getPassingAndFailing(testRuns[0]);
        }
        return testRuns.reduce(testReducer, { passing: 0, failing: 0, skipped: 0 });
    }

    function getPassingAndFailing(x: TestRun): Tests {
        const passing = x.passedTests ? x.passedTests : 0;
        const failing = x.unanalyzedTests ? x.unanalyzedTests : 0;
        const skipped = x.notApplicableTests ? x.notApplicableTests : 0;
        return { passing: passing, failing: failing, skipped: skipped };
    }

    function testReducer(totals: Tests, x: TestRun): Tests {
        const xTotals = getPassingAndFailing(x);
        totals.passing += xTotals.passing;
        totals.failing += xTotals.failing;
        return totals;
    }

    function buildDateString(date: Date): string {
        const enUS = "en-US";
        const MM = date.toLocaleDateString(enUS, { month: '2-digit' });
        const DD = date.toLocaleDateString(enUS, { day: '2-digit' });
        const YYYY = date.toLocaleDateString(enUS, { year: 'numeric' });
        return `${MM}-${DD}-${YYYY}`;
    }

    function addDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    function getCoverageInfo(coverage: CoverageData): Coverage {
        const covData: Coverage = {
            branches_total: "",
            branches_covered: "",
            lines_total: "",
            lines_covered: ""
        };

        if (coverage && coverage.coverageStats) {
            const branchElem = coverage.coverageStats.find(x => x.label === "Branches" || x.label === "Blocks");
            const linesElem = coverage.coverageStats.find(x => x.label === "Lines");

            if (branchElem) {
                covData.branches_covered = branchElem.covered;
                covData.branches_total = branchElem.total;
            }
            if (linesElem) {
                covData.lines_covered = linesElem.covered;
                covData.lines_total = linesElem.total;
            }
        }
        return covData;
    }

    function buildDateStringForGit(date: Date): string {
        const enUS = "en-US";
        const Mon = date.toLocaleDateString(enUS, { month: 'short' });
        const DD = date.toLocaleDateString(enUS, { day: 'numeric' });
        const YYYY = date.toLocaleDateString(enUS, { year: 'numeric' });
        return `${Mon} ${DD} ${YYYY}`;
    }
    //#endregion helpers

    return {
        calcStats: calcStats,
        getBuildDefs: getBuildDefs
    };
};

export default statsModule;
