var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var buildModule = function (tfsOpts) {
    var tfsUtils = require("./ADOUtilities")(tfsOpts);
    var fs = require("fs");
    var querystring = require('querystring');
    var util = require('util');
    var path = require("path");
    var git = require("simple-git")();
    var parse = require('json2csv').parse;
    var https = require("https");
    var asyncPool = require("tiny-async-pool");
    function queueBuildForDate(TOP_DIRECTORY, dateStr, repo) {
        return __awaiter(this, void 0, void 0, function () {
            var gitConfigFile, remote, repoInfo, branchName, logOpts, hash, buildId, repoResult;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        gitConfigFile = path.join(TOP_DIRECTORY, repo, ".git", "config");
                        return [4 /*yield*/, getRemoteFromFile(gitConfigFile)];
                    case 1:
                        remote = _a.sent();
                        return [4 /*yield*/, getRepoInfoFromRemoteUrl(remote)];
                    case 2:
                        repoInfo = _a.sent();
                        return [4 /*yield*/, git.cwd(path.join(TOP_DIRECTORY, repo))];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, git.status(function (err, status) {
                                branchName = status.current;
                            })];
                    case 4:
                        _a.sent();
                        logOpts = { "--max-count": "1", "--before": "\"" + dateStr + "\"" };
                        hash = "";
                        return [4 /*yield*/, git.log(logOpts, function (err, logs) {
                                //"21ecc43d801828678e97396239df25050fc9902e"   data2.latest.hash
                                //console.log(logs.latest.hash);
                                if (logs.latest) {
                                    hash = logs.latest.hash;
                                }
                            })];
                    case 5:
                        _a.sent();
                        if (!hash) return [3 /*break*/, 7];
                        return [4 /*yield*/, queueBuildForRepo(repoInfo, hash, branchName)];
                    case 6:
                        buildId = _a.sent();
                        repoResult = {
                            buildId: buildId,
                        };
                        _a.label = 7;
                    case 7: return [2 /*return*/, repoResult];
                }
            });
        });
    }
    function getFilesInDir(TOP_DIRECTORY) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, fs.readdir(TOP_DIRECTORY, function (err, repos) {
                                        return __awaiter(this, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                resolve(repos.filter(function (x) { return x != ".DS_Store"; }));
                                                return [2 /*return*/];
                                            });
                                        });
                                    })];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    }
    function queueBuilds(buildOpts) {
        return __awaiter(this, void 0, void 0, function () {
            var propName, prop, expanded, results, endDate, dateStr, TOP_DIRECTORY, repos, results_1, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        //for each property in opts
                        // if property contains/starts with ~
                        // expand it and replace
                        for (propName in buildOpts) {
                            prop = buildOpts[propName] + "";
                            if ((prop + "").startsWith("~")) {
                                expanded = expandHomeDir(prop);
                                buildOpts[propName] = expanded;
                            }
                        }
                        results = [];
                        endDate = buildOpts.endDate;
                        dateStr = buildDateStringForGit(endDate);
                        TOP_DIRECTORY = buildOpts.Directory;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, getFilesInDir(TOP_DIRECTORY)];
                    case 2:
                        repos = _a.sent();
                        return [4 /*yield*/, asyncPool(1, repos, function (repo) {
                                return queueBuildForDate(TOP_DIRECTORY, dateStr, repo);
                            })];
                    case 3:
                        results_1 = _a.sent();
                        console.table(results_1);
                        return [3 /*break*/, 5];
                    case 4:
                        err_1 = _a.sent();
                        console.log(err_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    function queueBuild(repoInfo, hash, def, branch) {
        return __awaiter(this, void 0, void 0, function () {
            var path, body, options;
            return __generator(this, function (_a) {
                path = "/" + repoInfo.project + tfsOpts.BUILD_API_PATH;
                body = JSON.stringify({
                    "queue": { "id": def.queue.id },
                    "definition": { "id": def.id },
                    "project": { "id": "" + repoInfo.project },
                    //"sourceBranch":`refs/heads/${branch}`,
                    "sourceVersion": "" + hash,
                    "reason": 1,
                    "demands": [],
                    "parameters": "{\"system.debug\":\"false\",\"BuildConfiguration\":\"release\",\"BuildPlatform\":\"any cpu\"}"
                });
                options = {
                    host: tfsOpts.ADO_HOST,
                    port: 443,
                    path: path,
                    rejectUnauthorized: false,
                    method: 'POST',
                };
                options.headers = tfsUtils.buildHeaders(tfsOpts.PAT, options.host);
                options.headers["Content-Type"] = 'application/json';
                options.headers["Content-Length"] = Buffer.byteLength(body);
                options.url = "" + options.host + options.path;
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var req = https.request(options, function (res) {
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
                    })];
            });
        });
    }
    function queueBuildForRepo(repoInfo, hash, branch) {
        return __awaiter(this, void 0, void 0, function () {
            var buildDef, buildId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getBuildDefinitionForRepo(repoInfo)];
                    case 1:
                        buildDef = _a.sent();
                        return [4 /*yield*/, queueBuild(repoInfo, hash, buildDef, branch)];
                    case 2:
                        buildId = _a.sent();
                        return [2 /*return*/, buildId];
                }
            });
        });
    }
    //#region helpers
    function getRemoteFromFile(gitConfigFile) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, fs.readFile(gitConfigFile, function (err, data) {
                                        return __awaiter(this, void 0, void 0, function () {
                                            var pattern, str, match, remote;
                                            return __generator(this, function (_a) {
                                                pattern = /remote.*[\r\n\s]*\w+[\s=]*(?<url>.*)[\r\n\s]+/;
                                                pattern.dotAll = true;
                                                str = data.toString();
                                                match = str.match(pattern);
                                                remote = match[1];
                                                resolve(remote);
                                                return [2 /*return*/];
                                            });
                                        });
                                    })];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    }
    function getRepoInfoFromRemoteUrl(remoteUrl) {
        return __awaiter(this, void 0, void 0, function () {
            var val, repo, id, project;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, tfsUtils.getRepos()];
                    case 1:
                        val = _a.sent();
                        repo = val.find(function (y) { return y.remoteUrl == remoteUrl; });
                        id = repo.id;
                        project = repo.project.id;
                        return [2 /*return*/, { id: id, project: project }];
                }
            });
        });
    }
    function getBuildDefs(repositoryId, project) {
        return __awaiter(this, void 0, void 0, function () {
            var queryParameters, path, url, defResponse;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryParameters = {
                            "$top": "15",
                            //"resultFilter" : "succeeded",
                            //"resultFilter" : "partiallySucceeded",
                            "repositoryId": repositoryId,
                            "repositoryType": "tfsgit",
                            "builtAfter": buildDateString(addDays(new Date(Date.now()), -40)),
                        };
                        path = "/" + project + tfsOpts.DEFINITIONS_API_PATH + "&" + querystring.stringify(queryParameters);
                        url = "" + tfsOpts.ADO_HOST + path;
                        return [4 /*yield*/, tfsUtils.ADORequest(path)];
                    case 1:
                        defResponse = _a.sent();
                        return [2 /*return*/, defResponse.value];
                }
            });
        });
    }
    function getBuildDefinitionForRepo(repo) {
        return __awaiter(this, void 0, void 0, function () {
            var buildDefs, gated, sonar, buildDef;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getBuildDefs(repo.id, repo.project)];
                    case 1:
                        buildDefs = _a.sent();
                        gated = buildDefs.find(function (x) { return x.name.toLowerCase().includes("gated"); });
                        sonar = buildDefs.find(function (x) { return x.name.toLowerCase().includes("sonar"); });
                        buildDef = buildDefs[0];
                        if (gated) {
                            return [2 /*return*/, gated];
                        }
                        if (sonar) {
                            return [2 /*return*/, sonar];
                        }
                        return [2 /*return*/, buildDef];
                }
            });
        });
    }
    function getLatestBuildSource(repo, hash, branch) {
        return __awaiter(this, void 0, void 0, function () {
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
            var buildDef, queryParameters, path, url, buildResponse, buildData, buildArr, id, uri;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getBuildDefinitionForRepo(repo)];
                    case 1:
                        buildDef = _a.sent();
                        queryParameters = {
                            "$top": "15",
                            //"resultFilter" : "succeeded",
                            //"resultFilter" : "partiallySucceeded",
                            "repositoryId": repo.id,
                            "queryOrder": "finishTimeDescending",
                            "repositoryType": "tfsgit",
                            //"reasonFilter":"pullRequest",
                            "sourceBranch": "refs/heads/" + branch,
                            "sourceVersion": "" + hash,
                        };
                        if (buildDef) {
                            queryParameters.definitions = buildDef.id;
                        }
                        path = "/" + repo.project + tfsOpts.BUILD_API_PATH + "&" + querystring.stringify(queryParameters);
                        url = "" + tfsOpts.ADO_HOST + path;
                        return [4 /*yield*/, tfsUtils.ADORequest(path)];
                    case 2:
                        buildResponse = _a.sent();
                        buildArr = buildResponse.value;
                        if (buildResponse.count > 0) {
                            buildData = buildArr.find(isValidBuild);
                            if (buildData == undefined) {
                                buildData = buildResponse.value[0];
                            }
                        }
                        if (buildData == undefined) {
                            debugger;
                        }
                        id = buildData ? buildData.id : "";
                        uri = buildData ? buildData.uri : "";
                        return [2 /*return*/, { id: id, url: url, uri: uri }];
                }
            });
        });
    }
    function getLatestBuildForRepo(repo, endDate) {
        return __awaiter(this, void 0, void 0, function () {
            var buildDef, queryParameters, path, url, buildResponse, buildData, buildArr, id, uri;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getBuildDefinitionForRepo(repo)];
                    case 1:
                        buildDef = _a.sent();
                        queryParameters = {
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
                        path = "/" + repo.project + tfsOpts.BUILD_API_PATH + "&" + querystring.stringify(queryParameters);
                        url = "" + tfsOpts.ADO_HOST + path;
                        return [4 /*yield*/, tfsUtils.ADORequest(path)];
                    case 2:
                        buildResponse = _a.sent();
                        buildArr = buildResponse.value;
                        if (buildResponse.count > 0) {
                            buildData = buildArr.find(isValidBuild);
                            if (buildData == undefined) {
                                buildData = buildResponse.value[0];
                            }
                        }
                        if (buildData == undefined) {
                            debugger;
                        }
                        id = buildData ? buildData.id : "";
                        uri = buildData ? buildData.uri : "";
                        return [2 /*return*/, { id: id, url: url, uri: uri }];
                }
            });
        });
    }
    //https://mindbody.visualstudio.com/19477e8d-94b2-4461-9dfc-2f54fa23767d/_apis/test/CodeCoverage?buildId=331398&api-version=5.0-preview.1
    function getCoverageForBuild(buildId, project) {
        return __awaiter(this, void 0, void 0, function () {
            var queryParameters, path, coverageResponse, coverage, coverageInfo;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryParameters = {
                            "buildId": buildId
                        };
                        path = "/" + project + tfsOpts.COVERAGE_API_PATH + "&" + querystring.stringify(queryParameters);
                        return [4 /*yield*/, tfsUtils.ADORequest(path)];
                    case 1:
                        coverageResponse = _a.sent();
                        coverage = coverageResponse.coverageData[0];
                        coverageInfo = getCoverageInfo(coverage);
                        return [2 /*return*/, coverageInfo];
                }
            });
        });
    }
    //https://mindbody.visualstudio.com/19477e8d-94b2-4461-9dfc-2f54fa23767d/_apis/test/runs?minLastUpdatedDate=06-10-2019&maxLastUpdatedDate=06-15-2019&api-version=5.0&buildIds=331398
    function getTestsForBuild(buildId, project, uri) {
        return __awaiter(this, void 0, void 0, function () {
            var queryParameters, path, testRunResponse, testRuns, testRunData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryParameters = {
                            "buildUri": uri,
                        };
                        path = "/" + project + tfsOpts.TEST_API_PATH + "&" + querystring.stringify(queryParameters);
                        return [4 /*yield*/, tfsUtils.ADORequest(path)];
                    case 1:
                        testRunResponse = _a.sent();
                        testRuns = testRunResponse.value;
                        if (testRuns && testRuns.length > 0) {
                            testRunData = getTestRunData(testRuns);
                            return [2 /*return*/, testRunData];
                        }
                        else {
                            return [2 /*return*/, { passing: 0, failing: 0 }];
                        }
                        return [2 /*return*/];
                }
            });
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
        var enUS = "en-US";
        var MM = date.toLocaleDateString(enUS, { month: '2-digit' });
        var DD = date.toLocaleDateString(enUS, { day: '2-digit' });
        var YYYY = date.toLocaleDateString(enUS, { year: 'numeric' });
        return MM + "-" + DD + "-" + YYYY;
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
            var branchElem = coverage.coverageStats.find(function (x) { return x.label == "Branches" || x.label == "Blocks"; });
            var linesElem = coverage.coverageStats.find(function (x) { return x.label == "Lines"; });
            covData.branches_covered = branchElem.covered;
            covData.branches_total = branchElem.total;
            covData.lines_covered = linesElem.covered;
            covData.lines_total = linesElem.total;
        }
        return covData;
    }
    function buildDateStringForGit(date) {
        var enUS = "en-US";
        var Mon = date.toLocaleDateString(enUS, { month: 'short' });
        var DD = date.toLocaleDateString(enUS, { day: 'numeric' });
        var YYYY = date.toLocaleDateString(enUS, { year: 'numeric' });
        return Mon + " " + DD + " " + YYYY;
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
module.exports = buildModule;
