var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export function buildModule(tfsOpts) {
    import tfu = require("./ADOUtilities");
    let tfsUtils = tfu(tfsOpts);
    import fs = require("fs");
    import querystring = require('querystring');
    import util = require('util');
    import path = require("path");
    import * as gitt from "simple-git";
    let git = gitt();
    import { parse } from 'json2csv';
    import https = require("https");
    import asyncPool = require("tiny-async-pool");
    function queueBuildForDate(TOP_DIRECTORY, dateStr, repo) {
        return __awaiter(this, void 0, void 0, function* () {
            var gitConfigFile = path.join(TOP_DIRECTORY, repo, ".git", "config");
            var remote = yield getRemoteFromFile(gitConfigFile);
            var repoInfo = yield getRepoInfoFromRemoteUrl(remote);
            yield git.cwd(path.join(TOP_DIRECTORY, repo));
            //console.log(gitConfigFile);
            //await git.pull();
            var branchName;
            yield git.status(function (err, status) {
                branchName = status.current;
            });
            var logOpts = { "--max-count": "1", "--before": `"${dateStr}"` };
            var hash = "";
            yield git.log(logOpts, function (err, logs) {
                //"21ecc43d801828678e97396239df25050fc9902e"   data2.latest.hash
                //console.log(logs.latest.hash);
                if (logs.latest) {
                    hash = logs.latest.hash;
                }
            });
            if (hash) {
                var buildId = yield queueBuildForRepo(repoInfo, hash, branchName);
                var repoResult = {
                    buildId: buildId,
                };
            }
            return repoResult;
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
    function queueBuilds(buildOpts) {
        return __awaiter(this, void 0, void 0, function* () {
            //for each property in opts
            // if property contains/starts with ~
            // expand it and replace
            for (var propName in buildOpts) {
                let prop = buildOpts[propName] + "";
                if ((prop + "").startsWith("~")) {
                    let expanded = expandHomeDir(prop);
                    buildOpts[propName] = expanded;
                }
            }
            const results = [];
            var endDate = buildOpts.endDate;
            var dateStr = buildDateStringForGit(endDate);
            var TOP_DIRECTORY = buildOpts.Directory;
            try {
                var repos = yield getFilesInDir(TOP_DIRECTORY);
                let results = yield asyncPool(1, repos, repo => {
                    return queueBuildForDate(TOP_DIRECTORY, dateStr, repo);
                });
                console.table(results);
            }
            catch (err) {
                console.log(err);
            }
        });
    }
    function queueBuild(repoInfo, hash, def, branch) {
        return __awaiter(this, void 0, void 0, function* () {
            var path = `/${repoInfo.project}${tfsOpts.BUILD_API_PATH}`;
            var body = JSON.stringify({
                "queue": { "id": def.queue.id },
                "definition": { "id": def.id },
                "project": { "id": `${repoInfo.project}` },
                //"sourceBranch":`refs/heads/${branch}`,
                "sourceVersion": `${hash}`,
                "reason": 1,
                "demands": [],
                "parameters": "{\"system.debug\":\"false\",\"BuildConfiguration\":\"release\",\"BuildPlatform\":\"any cpu\"}"
            });
            var options = {
                host: tfsOpts.ADO_HOST,
                port: 443,
                path: path,
                rejectUnauthorized: false,
                method: 'POST',
            };
            options.headers = tfsUtils.buildHeaders(tfsOpts.PAT, options.host);
            options.headers["Content-Type"] = 'application/json';
            options.headers["Content-Length"] = Buffer.byteLength(body);
            options.url = `${options.host}${options.path}`;
            return new Promise((resolve, reject) => {
                var req = https.request(options, (res) => {
                    var message = "";
                    res.on("end", function () {
                        //console.log('ended');
                        resolve(JSON.parse(message));
                    });
                    //res.setEncoding('utf8');
                    res.on('data', function (chunk) {
                        //console.log('Response: ' + chunk);
                        message += chunk;
                    });
                });
                req.write(body);
                req.end();
            });
        });
    }
    function queueBuildForRepo(repoInfo, hash, branch) {
        return __awaiter(this, void 0, void 0, function* () {
            var buildDef = yield getBuildDefinitionForRepo(repoInfo);
            var buildId = yield queueBuild(repoInfo, hash, buildDef, branch);
            return buildId;
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
    function getRepoInfoFromRemoteUrl(remoteUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            var val = yield tfsUtils.getRepos();
            var repo = val.find(y => y.remoteUrl == remoteUrl);
            var id = repo.id;
            var project = repo.project.id;
            return { id: id, project: project };
        });
    }
    function getBuildDefs(repositoryId, project) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryParameters = {
                "$top": "15",
                //"resultFilter" : "succeeded",
                //"resultFilter" : "partiallySucceeded",
                "repositoryId": repositoryId,
                "repositoryType": "tfsgit",
                "builtAfter": buildDateString(addDays(new Date(Date.now()), -40)),
            };
            var path = `/${project}${tfsOpts.DEFINITIONS_API_PATH}&${querystring.stringify(queryParameters)}`;
            var url = `${tfsOpts.ADO_HOST}${path}`;
            var defResponse = yield tfsUtils.ADORequest(path);
            return defResponse.value;
        });
    }
    function getBuildDefinitionForRepo(repo) {
        return __awaiter(this, void 0, void 0, function* () {
            var buildDefs = yield getBuildDefs(repo.id, repo.project);
            var gated = buildDefs.find(x => x.name.toLowerCase().includes("gated"));
            var sonar = buildDefs.find(x => x.name.toLowerCase().includes("sonar"));
            var buildDef = buildDefs[0];
            if (gated) {
                return gated;
            }
            if (sonar) {
                return sonar;
            }
            return buildDef;
        });
    }
    function getLatestBuildSource(repo, hash, branch) {
        return __awaiter(this, void 0, void 0, function* () {
            function isValidBuild(build) {
                try {
                    var isGated = build.definition.name.toLowerCase().includes("gated");
                    var isSonar = build.definition.name.toLowerCase().includes("sonar");
                    var isGood = build.result.toLowerCase().includes("succeeded");
                    return (isGated || isSonar) && isGood && (build.sourceVersion == hash);
                }
                catch (err) {
                    return false;
                }
            }
            // var buildDefs = await getBuildDefs(repo.id,repo.project, endDate)
            // var gated = buildDefs.find(x=>x.name.includes("gated"));
            // var sonar = buildDefs.find(x=>x.name.includes("sonar"));
            var buildDef = yield getBuildDefinitionForRepo(repo);
            // if(gated
            //     buildDef = gated;
            // }
            // if(sonar){
            //     buildDef = sonar;
            // }
            const queryParameters = {
                "$top": "15",
                //"resultFilter" : "succeeded",
                //"resultFilter" : "partiallySucceeded",
                "repositoryId": repo.id,
                "queryOrder": "finishTimeDescending",
                "repositoryType": "tfsgit",
                //"reasonFilter":"pullRequest",
                "sourceBranch": `refs/heads/${branch}`,
                "sourceVersion": `${hash}`,
            };
            if (buildDef) {
                queryParameters.definitions = buildDef.id;
            }
            var path = `/${repo.project}${tfsOpts.BUILD_API_PATH}&${querystring.stringify(queryParameters)}`;
            var url = `${tfsOpts.ADO_HOST}${path}`;
            var buildResponse = yield tfsUtils.ADORequest(path);
            var buildData;
            var buildArr = buildResponse.value;
            if (buildResponse.count > 0) {
                buildData = buildArr.find(isValidBuild);
                if (buildData == undefined) {
                    buildData = buildResponse.value[0];
                }
            }
            if (buildData == undefined) {
                debugger;
            }
            var id = buildData ? buildData.id : "";
            var uri = buildData ? buildData.uri : "";
            return { id: id, url: url, uri: uri };
        });
    }
    function getLatestBuildForRepo(repo, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            // var buildDefs = await getBuildDefs(repo.id,repo.project, endDate)
            // var gated = buildDefs.find(x=>x.name.includes("gated"));
            // var sonar = buildDefs.find(x=>x.name.includes("sonar"));
            var buildDef = yield getBuildDefinitionForRepo(repo);
            // if(gated){
            //     buildDef = gated;
            // }
            // if(sonar){
            //     buildDef = sonar;
            // }
            const queryParameters = {
                "$top": "15",
                //"resultFilter" : "succeeded",
                //"resultFilter" : "partiallySucceeded",
                "repositoryId": repo.id,
                "queryOrder": "finishTimeDescending",
                "repositoryType": "tfsgit",
                //"reasonFilter":"pullRequest",
                "minTime": buildDateString(endDate)
            };
            if (buildDef) {
                queryParameters.definitions = buildDef.id;
            }
            var path = `/${repo.project}${tfsOpts.BUILD_API_PATH}&${querystring.stringify(queryParameters)}`;
            var url = `${tfsOpts.ADO_HOST}${path}`;
            var buildResponse = yield tfsUtils.ADORequest(path);
            var buildData;
            var buildArr = buildResponse.value;
            if (buildResponse.count > 0) {
                buildData = buildArr.find(isValidBuild);
                if (buildData == undefined) {
                    buildData = buildResponse.value[0];
                }
            }
            if (buildData == undefined) {
                debugger;
            }
            var id = buildData ? buildData.id : "";
            var uri = buildData ? buildData.uri : "";
            return { id: id, url: url, uri: uri };
        });
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
        queueBuilds: queueBuilds,
        getBuildDefinitionForRepo: getBuildDefinitionForRepo,
        getLatestBuildForRepo: getLatestBuildForRepo,
        getLatestBuildSource: getLatestBuildSource,
        queueBuildForRepo: queueBuildForRepo
    };
}
;
//export = buildModule;r
