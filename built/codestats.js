var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function statsModule(tfsOpts) {
    import tm = require("./ADOUtilities");
    let tfsUtils = tm(tfsOpts);
    import bm = require("./buildModule");
    let buildModule = bm(tfsOpts);
    import fs = require("fs");
    import querystring = require('querystring');
    import util = require('util');
    let exec = util.promisify(require('child_process').exec);
    import path = require("path");
    import gitt = require("simple-git");
    let git = gitt();
    //import { parse } = require('json2csv');
    import asyncPool = require('tiny-async-pool');
    import expandHomeDir = require('expand-home-dir');
    function getBuildDefs(statsOpts) {
        return __awaiter(this, void 0, void 0, function* () {
            expand(statsOpts);
            var repos = yield getFilesInDir(statsOpts.Directory);
            return getBuildDefsForRepos(repos, statsOpts.Directory);
        });
    }
    function calcStats(statsOpts) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                let dates = statsOpts.dates;
                let results = yield asyncPool(6, dates, date => {
                    let opts = Object.assign({}, statsOpts);
                    opts.EndDate = new Date(date);
                    return getCodeStatForDate(opts);
                });
                resolve(results);
            }));
        });
    }
    function getCodeStatForDate(opts) {
        return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
            let results = yield calcStatsForDate(opts);
            resolve(results);
        }));
    }
    function getBuildDefsForRepos(repos, TOP_DIRECTORY) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                let results = yield asyncPool(5, repos, repo => {
                    return getBuildDefinitionForRepo(repo, TOP_DIRECTORY);
                });
                resolve(results);
            }));
        });
    }
    function getBuildDefinitionForRepo(repoName, Directory) {
        return __awaiter(this, void 0, void 0, function* () {
            let gitConfigFile = path.join(Directory, repoName, ".git", "config");
            //console.log(gitConfigFile);
            let remote = yield getRemoteFromFile(gitConfigFile);
            let info = yield getRepoInfoFromRemoteUrl(remote);
            return buildModule.getBuildDefinitionForRepo(info);
        });
    }
    function expand(incomingOpts) {
        for (var propName in incomingOpts) {
            let prop = incomingOpts[propName] + "";
            if ((prop + "").startsWith("~")) {
                let expanded = expandHomeDir(prop);
                incomingOpts[propName] = expanded;
            }
        }
    }
    function calcStatsForDate(statsOpts) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                for (var propName in statsOpts) {
                    let prop = statsOpts[propName] + "";
                    if ((prop + "").startsWith("~")) {
                        let expanded = expandHomeDir(prop);
                        statsOpts[propName] = expanded;
                    }
                }
                const ROLLUP_BU = path.basename(statsOpts.Directory);
                var endDate = statsOpts.EndDate;
                var dateStr = buildDateStringForGit(endDate);
                var TOP_DIRECTORY = statsOpts.Directory;
                var outputDirectory = path.join(statsOpts.outputDirectory, `${ROLLUP_BU} ${dateStr}`);
                var resultFile = `${ROLLUP_BU}-${buildDateString(endDate)}.csv`;
                var getVSTSStats = statsOpts.VSTS;
                var getCLOC = statsOpts.CLOC;
                var getTests = statsOpts.Tests;
                try {
                    if (getVSTSStats || getCLOC || getTests || statsOpts.build) {
                        yield fs.mkdir(outputDirectory, function (err, data1) {
                            return __awaiter(this, void 0, void 0, function* () {
                                console.log(err);
                                console.log(data1);
                            });
                        });
                        var repos = yield getFilesInDir(TOP_DIRECTORY);
                        let results = yield getStatsForRepos(repos, TOP_DIRECTORY, outputDirectory, dateStr, getCLOC, getVSTSStats, getTests, resultFile, statsOpts);
                        //return results;
                        resolve(results);
                    }
                }
                catch (err) {
                    console.log(err);
                    reject(err);
                }
            }));
        });
    }
    function getFilesInDir(TOP_DIRECTORY) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                yield fs.readdir(TOP_DIRECTORY, function (err, repos) {
                    return __awaiter(this, void 0, void 0, function* () {
                        resolve(repos.filter(x => x != ".DS_Store"));
                    });
                });
            }));
        });
    }
    function getStatsForRepos(repos, TOP_DIRECTORY, outputDirectory, dateStr, getCLOC, getVSTSStats, getTests, resultFile, statsOpts) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                let results = yield asyncPool(6, repos, repo => {
                    return getStatsForRepo(repo, TOP_DIRECTORY, outputDirectory, dateStr, getCLOC, getVSTSStats, getTests, Object.assign({}, statsOpts));
                });
                if (getCLOC) {
                    var { stdout, stderr } = yield exec(`ls`, { "cwd": `${outputDirectory}` });
                    var ls = stdout.replace(/\n/g, " ");
                    var { stdout, stderr } = yield exec(`cloc --sum-reports --out="${path.join(outputDirectory, "totals")}" ${ls}`, { "cwd": `${outputDirectory}` });
                    var { stdout, stderr } = yield exec(`cloc --csv --sum-reports --out="${path.join(outputDirectory, "totals-csv")}" ${ls}`, { "cwd": `${outputDirectory}` });
                    var { stdout, stderr } = yield exec(`cloc --json --sum-reports ${ls}`, { "cwd": `${outputDirectory}` });
                    var clocJSON = yield JSON.parse("[" + stdout.replace(/\n\s*\n/g, ",") + "]");
                    var repositories = clocJSON[1];
                    for (var i in results) {
                        let result = results[i];
                        let repo = repositories[result.repo];
                        if (repo) {
                            result.nFiles = repo.nFiles;
                            result.blank = repo.blank;
                            result.comment = repo.comment;
                            result.code = repo.code;
                        }
                    }
                }
                yield fs.writeFile(path.join(outputDirectory, resultFile), parse(results), (err) => err ? console.error('CSV not written!', err) : console.log(`CSV written!`));
                resolve(results);
            }));
        });
    }
    function getStatsForRepo(repo, TOP_DIRECTORY, outputDirectory, dateStr, getCLOC, getVSTSStats, getTests, statsOpts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (repo == ".DS_Store") {
                return;
            }
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                var repoResult = {
                    repo: repo,
                };
                var filename = path.join(outputDirectory, repo);
                yield git.cwd(path.join(TOP_DIRECTORY, repo));
                //console.log(gitConfigFile);
                if (statsOpts.pull) {
                    yield git.pull();
                }
                var branchName;
                yield git.status(function (err, status) {
                    branchName = status.current;
                });
                let hash = yield getHash(TOP_DIRECTORY, repo, dateStr);
                let grep_tests = 0;
                let clocResults;
                if (statsOpts.build) {
                    let gitConfigFile = path.join(TOP_DIRECTORY, repo, ".git", "config");
                    //console.log(gitConfigFile);
                    let remote = yield getRemoteFromFile(gitConfigFile);
                    let info = yield getRepoInfoFromRemoteUrl(remote);
                    yield buildModule.queueBuildForRepo(info, hash, branchName);
                }
                if (getCLOC) {
                    clocResults = yield clocRepo(filename, path.join(TOP_DIRECTORY, repo), hash, statsOpts);
                }
                if (getVSTSStats) {
                    var vstsStats = yield getVSTSStatsForRepo(TOP_DIRECTORY, repo, hash, branchName);
                }
                if (getTests) {
                    if (hash != "") {
                        yield git.checkout(`${hash}`);
                        var testCommand = `grep -Eo -r -i "\\s*\\[(Fact|TestMethod|Theory).*" ${path.join(TOP_DIRECTORY, repo, "*")} | wc -l`;
                        var { stdout, stderr } = yield exec(testCommand);
                        //console.log(stdout);
                        grep_tests = yield parseInt(stdout, 10);
                        //console.log(grep_tests);
                        yield git.checkout(branchName);
                    }
                }
                if (vstsStats == undefined) {
                    //console.log(`${repo} : weird tests`)
                }
                if (getVSTSStats) {
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
            }));
        });
    }
    function getVSTSStatsForRepo(TOP_DIRECTORY, repo, hash, branchName) {
        return __awaiter(this, void 0, void 0, function* () {
            let coverage = {
                branches_total: "",
                branches_covered: "",
                lines_total: "",
                lines_covered: ""
            };
            let tests = { passing: 0, failing: 0 };
            if (hash != "") {
                return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                    let gitConfigFile = path.join(TOP_DIRECTORY, repo, ".git", "config");
                    //console.log(gitConfigFile);
                    let remote = yield getRemoteFromFile(gitConfigFile);
                    let info = yield getRepoInfoFromRemoteUrl(remote);
                    let project = info.project;
                    info.name = repo;
                    let buildInfo = yield buildModule.getLatestBuildSource(info, hash, branchName);
                    //var buildInfo = await getLatestBuildForRepo(info, addDays(endDate,-7));
                    let build = buildInfo.id;
                    if (build) {
                        tests = yield getTestsForBuild(build, project, buildInfo.uri);
                        coverage = yield getCoverageForBuild(build, project);
                    }
                    resolve({ tests: tests, coverage: coverage, buildInfo: buildInfo });
                }));
            }
            else {
                return { tests: tests, coverage: coverage, buildInfo: { url: "no build" } };
            }
        });
    }
    function clocRepo(filename, dirPath, hash, statsOpts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (hash != "") {
                return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                    //var cloc_command_args = `cloc --out="${filename}"  --include-lang="C#,Razor,ASP,ASP.NET,HTML,CSS,LESS,PowerShell,JavaScript,TypeScript" ${path.join(TOP_DIRECTORY,repo)}`
                    let cloc_command_include_lang = {};
                    let cloc_command_exclude_dir = {};
                    let cloc_command_out = {
                        "out": `"${filename}"`,
                    };
                    if (statsOpts.langFilters) {
                        cloc_command_include_lang = {
                            "include-lang": `"${statsOpts.langFilters.join(",")}"`,
                        };
                    }
                    if (statsOpts.excludeDirs) {
                        cloc_command_exclude_dir = {
                            "exclude-dir": `"${statsOpts.excludeDirs.join(",")}"`,
                        };
                    }
                    let clocCommandObj = {};
                    Object.assign(clocCommandObj, cloc_command_out, cloc_command_include_lang, cloc_command_exclude_dir);
                    let clocCommandArr = [];
                    for (var propName in clocCommandObj) {
                        let prop = clocCommandObj[propName] + "";
                        clocCommandArr.push(`--${propName}=${prop}`);
                        if ((prop + "").startsWith("~")) {
                            let expanded = expandHomeDir(prop);
                            clocCommandObj[propName] = expanded;
                        }
                    }
                    let cloc_command_args = clocCommandArr.join("  ");
                    let cloc_command = `cloc ${cloc_command_args} ${hash}`;
                    var { stdout, stderr } = yield exec(cloc_command, { "cwd": `${dirPath}` });
                    resolve(stdout);
                }));
            }
        });
    }
    //#region helpers
    function getRemoteFromFile(gitConfigFile) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                yield fs.readFile(gitConfigFile, function (err, data) {
                    return __awaiter(this, void 0, void 0, function* () {
                        var pattern = /remote.*[\r\n\s]*\w+[\s=]*(?<url>.*)[\r\n\s]+/;
                        pattern.dotAll = true;
                        var str = data.toString();
                        var match = str.match(pattern);
                        var remote = match[1];
                        resolve(remote);
                    });
                });
            }));
        });
    }
    function getHash(TOP_DIRECTORY, repo, dateStr) {
        return __awaiter(this, void 0, void 0, function* () {
            const logOpts = { "--max-count": "1", "--before": `"${dateStr}"` };
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                yield git.cwd(path.join(TOP_DIRECTORY, repo)).log(logOpts, function (err, logs) {
                    let hash = "";
                    //"21ecc43d801828678e97396239df25050fc9902e"   data2.latest.hash
                    //console.log(logs.latest.hash);
                    if (logs.latest) {
                        hash = logs.latest.hash;
                    }
                    resolve(hash);
                });
            }));
        });
    }
    function getRepoInfoFromRemoteUrl(remoteUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            var val = yield tfsUtils.getRepos();
            var repo = val.find(y => y.remoteUrl == remoteUrl);
            var id = repo.id;
            var project = repo.project.id;
            return { id: id, project: project };
        });
    }
    function isValidBuild(build) {
        var isGated = build.definition.name.toLowerCase().includes("gated");
        var isSonar = build.definition.name.toLowerCase().includes("sonar");
        var isGood = build.result.toLowerCase().includes("succeeded");
        return isGated || isSonar;
    }
    //https://mindbody.visualstudio.com/19477e8d-94b2-4461-9dfc-2f54fa23767d/_apis/test/CodeCoverage?buildId=331398&api-version=5.0-preview.1
    function getCoverageForBuild(buildId, project) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryParameters = {
                "buildId": buildId
            };
            var path = `/${project}${tfsOpts.COVERAGE_API_PATH}&${querystring.stringify(queryParameters)}`;
            var coverageResponse = yield tfsUtils.ADORequest(path);
            var coverage = coverageResponse.coverageData[0];
            var coverageInfo = getCoverageInfo(coverage);
            return coverageInfo;
        });
    }
    //https://mindbody.visualstudio.com/19477e8d-94b2-4461-9dfc-2f54fa23767d/_apis/test/runs?minLastUpdatedDate=06-10-2019&maxLastUpdatedDate=06-15-2019&api-version=5.0&buildIds=331398
    function getTestsForBuild(buildId, project, uri) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryParameters = {
                "buildUri": uri,
            };
            var path = `/${project}${tfsOpts.TEST_API_PATH}&${querystring.stringify(queryParameters)}`;
            var testRunResponse = yield tfsUtils.ADORequest(path);
            var testRuns = testRunResponse.value;
            if (testRuns && testRuns.length > 0) {
                var testRunData = getTestRunData(testRuns);
                return testRunData;
            }
            else {
                return { passing: 0, failing: 0 };
            }
        });
    }
    function getTestRunData(testRuns) {
        if (testRuns.length == 1) {
            return getPassingAndFailing(testRuns[0]);
        }
        return testRuns.reduce(testReducer);
    }
    function getPassingAndFailing(x) {
        var passing = x.passedTests ? x.passedTests : 0;
        var failing = x.unanalyzedTests ? x.unanalyzedTests : 0;
        var skipped = x.notApplicableTests ? x.notApplicableTests : 0;
        return { passing: passing, failing: failing, skipped: skipped };
    }
    function testReducer(totals, x) {
        var retTotals = {};
        if (!totals.passing) {
            retTotals = getPassingAndFailing(totals);
        }
        else {
            retTotals = totals;
        }
        xTotals = getPassingAndFailing(x);
        retTotals.passing += xTotals.passing;
        retTotals.failing += xTotals.failing;
        return retTotals;
    }
    function buildDateString(date) {
        const enUS = "en-US";
        var MM = date.toLocaleDateString(enUS, { month: '2-digit' });
        var DD = date.toLocaleDateString(enUS, { day: '2-digit' });
        var YYYY = date.toLocaleDateString(enUS, { year: 'numeric' });
        return `${MM}-${DD}-${YYYY}`;
    }
    function addDays(date, days) {
        var result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }
    function getCoverageInfo(coverage) {
        var covData = {
            branches_total: "",
            branches_covered: "",
            lines_total: "",
            lines_covered: ""
        };
        if (coverage && coverage.coverageStats) {
            var branchElem = coverage.coverageStats.find(x => x.label == "Branches" || x.label == "Blocks");
            var linesElem = coverage.coverageStats.find(x => x.label == "Lines");
            covData.branches_covered = branchElem.covered;
            covData.branches_total = branchElem.total;
            covData.lines_covered = linesElem.covered;
            covData.lines_total = linesElem.total;
        }
        return covData;
    }
    function buildDateStringForGit(date) {
        const enUS = "en-US";
        var Mon = date.toLocaleDateString(enUS, { month: 'short' });
        var DD = date.toLocaleDateString(enUS, { day: 'numeric' });
        var YYYY = date.toLocaleDateString(enUS, { year: 'numeric' });
        return `${Mon} ${DD} ${YYYY}`;
    }
    //#endregion helpers
    return {
        calcStats: calcStats,
        getBuildDefs: getBuildDefs
    };
}
;
