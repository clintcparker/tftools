import * as fs from 'fs';
import * as querystring from 'querystring';
import * as path from 'path';
import simpleGit, { SimpleGit, LogResult, StatusResult } from 'simple-git';
import { parse } from 'json2csv';
import * as https from 'https';
import asyncPool from 'tiny-async-pool';
import expandHomeDir from 'expand-home-dir';
import tfsUtilsModule, { TfsOptions } from './ADOUtilities';
import { BuildOptions, Repository, TestRun, TestRunData } from './shared-types';

interface RepoInfo {
    id: string;
    project: string;
}

interface BuildDefinition {
    id: string;
    name: string;
    queue: {
        id: string;
    };
    [key: string]: any;
}

interface BuildData {
    id: string;
    uri: string;
    definition: {
        name: string;
    };
    result: string;
    sourceVersion: string;
    _links: {
        web: {
            href: string;
        };
    };
    [key: string]: any;
}

interface BuildResponse {
    count: number;
    value: BuildData[];
}

interface BuildResult {
    buildId?: any;
}

interface CoverageStats {
    label: string;
    covered: number;
    total: number;
}

interface Coverage {
    coverageStats: CoverageStats[];
}

interface CoverageInfo {
    branches_total: string | number;
    branches_covered: string | number;
    lines_total: string | number;
    lines_covered: string | number;
}


const buildModule = function(tfsOpts: TfsOptions) {
    const tfsUtils = tfsUtilsModule(tfsOpts);

    async function queueBuildForDate(TOP_DIRECTORY: string, dateStr: string, repo: string): Promise<BuildResult | undefined> {
        const gitConfigFile = path.join(TOP_DIRECTORY, repo, ".git", "config");
        const remote = await getRemoteFromFile(gitConfigFile);
        const repoInfo = await getRepoInfoFromRemoteUrl(remote);
        const gitInstance = simpleGit();
        await gitInstance.cwd(path.join(TOP_DIRECTORY, repo));

        let branchName: string = '';
        await gitInstance.status(function(err: Error | null, status: StatusResult) {
            branchName = status.current || '';
        });

        const logOpts: any = { "--max-count": "1", "--before": `"${dateStr}"` };
        let hash = "";
        await gitInstance.log(logOpts, function(err: Error | null, logs: LogResult) {
            if (logs.latest) {
                hash = logs.latest.hash;
            }
        });

        if (hash) {
            const buildId = await queueBuildForRepo(repoInfo, hash, branchName);
            const repoResult: BuildResult = {
                buildId: buildId,
            };
            return repoResult;
        }
        return undefined;
    }

    async function getFilesInDir(TOP_DIRECTORY: string): Promise<string[]> {
        return new Promise(async resolve => {
            await fs.readdir(TOP_DIRECTORY, async function(err, repos) {
                resolve(repos.filter(x => x !== ".DS_Store"));
            });
        });
    }

    async function queueBuilds(buildOpts: BuildOptions): Promise<void> {
        // For each property in opts
        // if property contains/starts with ~
        // expand it and replace
        for (const propName in buildOpts) {
            const prop = buildOpts[propName] + "";
            if ((prop + "").startsWith("~")) {
                const expanded = expandHomeDir(prop);
                buildOpts[propName] = expanded;
            }
        }

        const endDate = buildOpts.endDate;
        const dateStr = buildDateStringForGit(endDate);
        const TOP_DIRECTORY = buildOpts.Directory;

        try {
            const repos = await getFilesInDir(TOP_DIRECTORY);
            const results = await asyncPool(1, repos, repo => {
                return queueBuildForDate(TOP_DIRECTORY, dateStr, repo);
            });
            console.table(results);
        } catch (err) {
            console.log(err);
        }
    }

    async function queueBuild(repoInfo: RepoInfo, hash: string, def: BuildDefinition, branch: string): Promise<any> {
        const apiPath = `/${repoInfo.project}${(tfsOpts as any).BUILD_API_PATH}`;
        const body = JSON.stringify({
            "queue": { "id": def.queue.id },
            "definition": { "id": def.id },
            "project": { "id": `${repoInfo.project}` },
            "sourceVersion": `${hash}`,
            "reason": 1,
            "demands": [],
            "parameters": "{\"system.debug\":\"false\",\"BuildConfiguration\":\"release\",\"BuildPlatform\":\"any cpu\"}"
        });

        const options: https.RequestOptions = {
            host: tfsOpts.ADO_HOST,
            port: 443,
            path: apiPath,
            rejectUnauthorized: tfsOpts.rejectUnauthorized !== undefined ? tfsOpts.rejectUnauthorized : true,
            method: 'POST',
        };

        const headers = tfsUtils.buildHeaders(tfsOpts.PAT, options.host as string);
        (headers as any)["Content-Type"] = 'application/json';
        (headers as any)["Content-Length"] = Buffer.byteLength(body);
        options.headers = headers as any;

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let message = "";
                res.on("end", function() {
                    resolve(JSON.parse(message));
                });
                res.on('data', function(chunk) {
                    message += chunk;
                });
            });
            req.write(body);
            req.end();
        });
    }

    async function queueBuildForRepo(repoInfo: RepoInfo, hash: string, branch: string): Promise<any> {
        const buildDef = await getBuildDefinitionForRepo(repoInfo);
        const buildId = await queueBuild(repoInfo, hash, buildDef, branch);
        return buildId;
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

    async function getBuildDefs(repositoryId: string, project: string): Promise<BuildDefinition[]> {
        const queryParameters: any = {
            "$top": "15",
            "repositoryId": repositoryId,
            "repositoryType": "tfsgit",
            "builtAfter": buildDateString(addDays(new Date(Date.now()), -40)),
        };
        const apiPath = `/${project}${(tfsOpts as any).DEFINITIONS_API_PATH}&${querystring.stringify(queryParameters)}`;
        const defResponse = await tfsUtils.ADORequest(apiPath);
        return defResponse.value;
    }

    async function getBuildDefinitionForRepo(repo: RepoInfo): Promise<BuildDefinition> {
        const buildDefs = await getBuildDefs(repo.id, repo.project);
        const gated = buildDefs.find(x => x.name.toLowerCase().includes("gated"));
        const sonar = buildDefs.find(x => x.name.toLowerCase().includes("sonar"));
        const buildDef = buildDefs[0];

        if (gated) {
            return gated;
        }
        if (sonar) {
            return sonar;
        }
        return buildDef;
    }

    async function getLatestBuildSource(repo: RepoInfo, hash: string, branch: string): Promise<{ id: string; url: string; uri: string }> {
        function isValidBuild(build: BuildData): boolean {
            try {
                const isGated = build.definition.name.toLowerCase().includes("gated");
                const isSonar = build.definition.name.toLowerCase().includes("sonar");
                const isGood = build.result.toLowerCase().includes("succeeded");
                return (isGated || isSonar) && isGood && (build.sourceVersion === hash);
            } catch (err) {
                return false;
            }
        }

        const buildDef = await getBuildDefinitionForRepo(repo);
        const queryParameters: any = {
            "$top": "15",
            "repositoryId": repo.id,
            "queryOrder": "finishTimeDescending",
            "repositoryType": "tfsgit",
            "sourceBranch": `refs/heads/${branch}`,
            "sourceVersion": `${hash}`,
        };

        if (buildDef) {
            queryParameters.definitions = buildDef.id;
        }

        const apiPath = `/${repo.project}${(tfsOpts as any).BUILD_API_PATH}&${querystring.stringify(queryParameters)}`;
        const buildResponse: BuildResponse = await tfsUtils.ADORequest(apiPath);
        let buildData: BuildData | undefined;
        const buildArr = buildResponse.value;

        if (buildResponse.count > 0) {
            buildData = buildArr.find(isValidBuild);

            if (buildData === undefined) {
                buildData = buildResponse.value[0];
            }
        }

        if (buildData === undefined) {
            console.error('No build data found');
        }

        const id = buildData ? buildData.id : "";
        const uri = buildData ? buildData.uri : "";
        const url = buildData ? buildData._links.web.href : "";
        return { id: id, url: url, uri: uri };
    }

    async function getLatestBuildForRepo(repo: RepoInfo, endDate: Date): Promise<{ id: string; url: string; uri: string }> {
        function isValidBuild(build: BuildData): boolean {
            try {
                const isGated = build.definition.name.toLowerCase().includes("gated");
                const isSonar = build.definition.name.toLowerCase().includes("sonar");
                const isGood = build.result.toLowerCase().includes("succeeded");
                return (isGated || isSonar) && isGood;
            } catch (err) {
                return false;
            }
        }

        const buildDef = await getBuildDefinitionForRepo(repo);
        const queryParameters: any = {
            "$top": "15",
            "repositoryId": repo.id,
            "queryOrder": "finishTimeDescending",
            "repositoryType": "tfsgit",
            "minTime": buildDateString(endDate)
        };

        if (buildDef) {
            queryParameters.definitions = buildDef.id;
        }

        const apiPath = `/${repo.project}${(tfsOpts as any).BUILD_API_PATH}&${querystring.stringify(queryParameters)}`;
        const buildResponse: BuildResponse = await tfsUtils.ADORequest(apiPath);
        let buildData: BuildData | undefined;
        const buildArr = buildResponse.value;

        if (buildResponse.count > 0) {
            buildData = buildArr.find(isValidBuild);

            if (buildData === undefined) {
                buildData = buildResponse.value[0];
            }
        }

        if (buildData === undefined) {
            console.error('No build data found');
        }

        const id = buildData ? buildData.id : "";
        const uri = buildData ? buildData.uri : "";
        const url = buildData ? buildData._links.web.href : "";
        return { id: id, url: url, uri: uri };
    }

    async function getCoverageForBuild(buildId: string, project: string): Promise<CoverageInfo> {
        const queryParameters = {
            "buildId": buildId
        };
        const apiPath = `/${project}${(tfsOpts as any).COVERAGE_API_PATH}&${querystring.stringify(queryParameters)}`;
        const coverageResponse = await tfsUtils.ADORequest(apiPath);
        const coverage = coverageResponse.coverageData[0];
        const coverageInfo = getCoverageInfo(coverage);
        return coverageInfo;
    }

    async function getTestsForBuild(buildId: string, project: string, uri: string): Promise<TestRunData> {
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

    function getTestRunData(testRuns: TestRun[]): TestRunData {
        if (testRuns.length === 1) {
            return getPassingAndFailing(testRuns[0]);
        }
        return testRuns.reduce(testReducer, { passing: 0, failing: 0, skipped: 0 });
    }

    function getPassingAndFailing(x: TestRun): TestRunData {
        const passing = x.passedTests ? x.passedTests : 0;
        const failing = x.unanalyzedTests ? x.unanalyzedTests : 0;
        const skipped = x.notApplicableTests ? x.notApplicableTests : 0;
        return { passing: passing, failing: failing, skipped: skipped };
    }

    function testReducer(totals: TestRunData, x: TestRun): TestRunData {
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

    function getCoverageInfo(coverage: Coverage): CoverageInfo {
        const covData: CoverageInfo = {
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
        queueBuilds: queueBuilds,
        getBuildDefinitionForRepo: getBuildDefinitionForRepo,
        getLatestBuildForRepo: getLatestBuildForRepo,
        getLatestBuildSource: getLatestBuildSource,
        queueBuildForRepo: queueBuildForRepo
    };
};

export default buildModule;
