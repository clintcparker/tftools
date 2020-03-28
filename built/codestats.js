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
var statsModule = function (tfsOpts) {
    var tfsUtils = require("./ADOUtilities")(tfsOpts);
    var buildModule = require("./buildModule")(tfsOpts);
    var fs = require("fs");
    var querystring = require('querystring');
    var util = require('util');
    var exec = util.promisify(require('child_process').exec);
    var path = require("path");
    var git = require("simple-git")();
    var parse = require('json2csv').parse;
    var asyncPool = require('tiny-async-pool');
    var expandHomeDir = require('expand-home-dir');
    function getBuildDefs(statsOpts) {
        return __awaiter(this, void 0, void 0, function () {
            var repos;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        expand(statsOpts);
                        return [4 /*yield*/, getFilesInDir(statsOpts.Directory)];
                    case 1:
                        repos = _a.sent();
                        return [2 /*return*/, getBuildDefsForRepos(repos, statsOpts.Directory)];
                }
            });
        });
    }
    function calcStats(statsOpts) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) { return __awaiter(_this, void 0, void 0, function () {
                        var dates, results;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    dates = statsOpts.dates;
                                    return [4 /*yield*/, asyncPool(6, dates, function (date) {
                                            var opts = Object.assign({}, statsOpts);
                                            opts.EndDate = new Date(date);
                                            return getCodeStatForDate(opts);
                                        })];
                                case 1:
                                    results = _a.sent();
                                    resolve(results);
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    }
    function getCodeStatForDate(opts) {
        var _this = this;
        return new Promise(function (resolve) { return __awaiter(_this, void 0, void 0, function () {
            var results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, calcStatsForDate(opts)];
                    case 1:
                        results = _a.sent();
                        resolve(results);
                        return [2 /*return*/];
                }
            });
        }); });
    }
    function getBuildDefsForRepos(repos, TOP_DIRECTORY) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) { return __awaiter(_this, void 0, void 0, function () {
                        var results;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, asyncPool(5, repos, function (repo) {
                                        return getBuildDefinitionForRepo(repo, TOP_DIRECTORY);
                                    })];
                                case 1:
                                    results = _a.sent();
                                    resolve(results);
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    }
    function getBuildDefinitionForRepo(repoName, Directory) {
        return __awaiter(this, void 0, void 0, function () {
            var gitConfigFile, remote, info;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        gitConfigFile = path.join(Directory, repoName, ".git", "config");
                        return [4 /*yield*/, getRemoteFromFile(gitConfigFile)];
                    case 1:
                        remote = _a.sent();
                        return [4 /*yield*/, getRepoInfoFromRemoteUrl(remote)];
                    case 2:
                        info = _a.sent();
                        return [2 /*return*/, buildModule.getBuildDefinitionForRepo(info)];
                }
            });
        });
    }
    function expand(incomingOpts) {
        for (var propName in incomingOpts) {
            var prop = incomingOpts[propName] + "";
            if ((prop + "").startsWith("~")) {
                var expanded = expandHomeDir(prop);
                incomingOpts[propName] = expanded;
            }
        }
    }
    function calcStatsForDate(statsOpts) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
                        var propName, prop, expanded, ROLLUP_BU, endDate, dateStr, TOP_DIRECTORY, outputDirectory, resultFile, getVSTSStats, getCLOC, getTests, repos, results, err_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    for (propName in statsOpts) {
                                        prop = statsOpts[propName] + "";
                                        if ((prop + "").startsWith("~")) {
                                            expanded = expandHomeDir(prop);
                                            statsOpts[propName] = expanded;
                                        }
                                    }
                                    ROLLUP_BU = path.basename(statsOpts.Directory);
                                    endDate = statsOpts.EndDate;
                                    dateStr = buildDateStringForGit(endDate);
                                    TOP_DIRECTORY = statsOpts.Directory;
                                    outputDirectory = path.join(statsOpts.outputDirectory, ROLLUP_BU + " " + dateStr);
                                    resultFile = ROLLUP_BU + "-" + buildDateString(endDate) + ".csv";
                                    getVSTSStats = statsOpts.VSTS;
                                    getCLOC = statsOpts.CLOC;
                                    getTests = statsOpts.Tests;
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 6, , 7]);
                                    if (!(getVSTSStats || getCLOC || getTests || statsOpts.build)) return [3 /*break*/, 5];
                                    return [4 /*yield*/, fs.mkdir(outputDirectory, function (err, data1) {
                                            return __awaiter(this, void 0, void 0, function () {
                                                return __generator(this, function (_a) {
                                                    console.log(err);
                                                    console.log(data1);
                                                    return [2 /*return*/];
                                                });
                                            });
                                        })];
                                case 2:
                                    _a.sent();
                                    return [4 /*yield*/, getFilesInDir(TOP_DIRECTORY)];
                                case 3:
                                    repos = _a.sent();
                                    return [4 /*yield*/, getStatsForRepos(repos, TOP_DIRECTORY, outputDirectory, dateStr, getCLOC, getVSTSStats, getTests, resultFile, statsOpts)];
                                case 4:
                                    results = _a.sent();
                                    //return results;
                                    resolve(results);
                                    _a.label = 5;
                                case 5: return [3 /*break*/, 7];
                                case 6:
                                    err_1 = _a.sent();
                                    console.log(err_1);
                                    reject(err_1);
                                    return [3 /*break*/, 7];
                                case 7: return [2 /*return*/];
                            }
                        });
                    }); })];
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
    function getStatsForRepos(repos, TOP_DIRECTORY, outputDirectory, dateStr, getCLOC, getVSTSStats, getTests, resultFile, statsOpts) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) { return __awaiter(_this, void 0, void 0, function () {
                        var results, _a, stdout, stderr, ls, _b, stdout, stderr, _c, stdout, stderr, _d, stdout, stderr, clocJSON, repositories, i, result, repo;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0: return [4 /*yield*/, asyncPool(6, repos, function (repo) {
                                        return getStatsForRepo(repo, TOP_DIRECTORY, outputDirectory, dateStr, getCLOC, getVSTSStats, getTests, Object.assign({}, statsOpts));
                                    })];
                                case 1:
                                    results = _e.sent();
                                    if (!getCLOC) return [3 /*break*/, 7];
                                    return [4 /*yield*/, exec("ls", { "cwd": "" + outputDirectory })];
                                case 2:
                                    _a = _e.sent(), stdout = _a.stdout, stderr = _a.stderr;
                                    ls = stdout.replace(/\n/g, " ");
                                    return [4 /*yield*/, exec("cloc --sum-reports --out=\"" + path.join(outputDirectory, "totals") + "\" " + ls, { "cwd": "" + outputDirectory })];
                                case 3:
                                    _b = _e.sent(), stdout = _b.stdout, stderr = _b.stderr;
                                    return [4 /*yield*/, exec("cloc --csv --sum-reports --out=\"" + path.join(outputDirectory, "totals-csv") + "\" " + ls, { "cwd": "" + outputDirectory })];
                                case 4:
                                    _c = _e.sent(), stdout = _c.stdout, stderr = _c.stderr;
                                    return [4 /*yield*/, exec("cloc --json --sum-reports " + ls, { "cwd": "" + outputDirectory })];
                                case 5:
                                    _d = _e.sent(), stdout = _d.stdout, stderr = _d.stderr;
                                    return [4 /*yield*/, JSON.parse("[" + stdout.replace(/\n\s*\n/g, ",") + "]")];
                                case 6:
                                    clocJSON = _e.sent();
                                    repositories = clocJSON[1];
                                    for (i in results) {
                                        result = results[i];
                                        repo = repositories[result.repo];
                                        if (repo) {
                                            result.nFiles = repo.nFiles;
                                            result.blank = repo.blank;
                                            result.comment = repo.comment;
                                            result.code = repo.code;
                                        }
                                    }
                                    _e.label = 7;
                                case 7: return [4 /*yield*/, fs.writeFile(path.join(outputDirectory, resultFile), parse(results), function (err) { return err ? console.error('CSV not written!', err) : console.log("CSV written!"); })];
                                case 8:
                                    _e.sent();
                                    resolve(results);
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    }
    function getStatsForRepo(repo, TOP_DIRECTORY, outputDirectory, dateStr, getCLOC, getVSTSStats, getTests, statsOpts) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (repo == ".DS_Store") {
                    return [2 /*return*/];
                }
                return [2 /*return*/, new Promise(function (resolve) { return __awaiter(_this, void 0, void 0, function () {
                        var repoResult, filename, branchName, hash, grep_tests, clocResults, gitConfigFile, remote, info, vstsStats, testCommand, _a, stdout, stderr;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    repoResult = {
                                        repo: repo,
                                    };
                                    filename = path.join(outputDirectory, repo);
                                    return [4 /*yield*/, git.cwd(path.join(TOP_DIRECTORY, repo))];
                                case 1:
                                    _b.sent();
                                    if (!statsOpts.pull) return [3 /*break*/, 3];
                                    return [4 /*yield*/, git.pull()];
                                case 2:
                                    _b.sent();
                                    _b.label = 3;
                                case 3: return [4 /*yield*/, git.status(function (err, status) {
                                        branchName = status.current;
                                    })];
                                case 4:
                                    _b.sent();
                                    return [4 /*yield*/, getHash(TOP_DIRECTORY, repo, dateStr)];
                                case 5:
                                    hash = _b.sent();
                                    grep_tests = 0;
                                    if (!statsOpts.build) return [3 /*break*/, 9];
                                    gitConfigFile = path.join(TOP_DIRECTORY, repo, ".git", "config");
                                    return [4 /*yield*/, getRemoteFromFile(gitConfigFile)];
                                case 6:
                                    remote = _b.sent();
                                    return [4 /*yield*/, getRepoInfoFromRemoteUrl(remote)];
                                case 7:
                                    info = _b.sent();
                                    return [4 /*yield*/, buildModule.queueBuildForRepo(info, hash, branchName)];
                                case 8:
                                    _b.sent();
                                    _b.label = 9;
                                case 9:
                                    if (!getCLOC) return [3 /*break*/, 11];
                                    return [4 /*yield*/, clocRepo(filename, path.join(TOP_DIRECTORY, repo), hash, statsOpts)];
                                case 10:
                                    clocResults = _b.sent();
                                    _b.label = 11;
                                case 11:
                                    if (!getVSTSStats) return [3 /*break*/, 13];
                                    return [4 /*yield*/, getVSTSStatsForRepo(TOP_DIRECTORY, repo, hash, branchName)];
                                case 12:
                                    vstsStats = _b.sent();
                                    _b.label = 13;
                                case 13:
                                    if (!getTests) return [3 /*break*/, 18];
                                    if (!(hash != "")) return [3 /*break*/, 18];
                                    return [4 /*yield*/, git.checkout("" + hash)];
                                case 14:
                                    _b.sent();
                                    testCommand = "grep -Eo -r -i \"\\s*\\[(Fact|TestMethod|Theory).*\" " + path.join(TOP_DIRECTORY, repo, "*") + " | wc -l";
                                    return [4 /*yield*/, exec(testCommand)];
                                case 15:
                                    _a = _b.sent(), stdout = _a.stdout, stderr = _a.stderr;
                                    return [4 /*yield*/, parseInt(stdout, 10)];
                                case 16:
                                    //console.log(stdout);
                                    grep_tests = _b.sent();
                                    //console.log(grep_tests);
                                    return [4 /*yield*/, git.checkout(branchName)];
                                case 17:
                                    //console.log(grep_tests);
                                    _b.sent();
                                    _b.label = 18;
                                case 18:
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
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    }
    function getVSTSStatsForRepo(TOP_DIRECTORY, repo, hash, branchName) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var coverage, tests;
            return __generator(this, function (_a) {
                coverage = {
                    branches_total: "",
                    branches_covered: "",
                    lines_total: "",
                    lines_covered: ""
                };
                tests = { passing: 0, failing: 0 };
                if (hash != "") {
                    return [2 /*return*/, new Promise(function (resolve) { return __awaiter(_this, void 0, void 0, function () {
                            var gitConfigFile, remote, info, project, buildInfo, build;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        gitConfigFile = path.join(TOP_DIRECTORY, repo, ".git", "config");
                                        return [4 /*yield*/, getRemoteFromFile(gitConfigFile)];
                                    case 1:
                                        remote = _a.sent();
                                        return [4 /*yield*/, getRepoInfoFromRemoteUrl(remote)];
                                    case 2:
                                        info = _a.sent();
                                        project = info.project;
                                        info.name = repo;
                                        return [4 /*yield*/, buildModule.getLatestBuildSource(info, hash, branchName)];
                                    case 3:
                                        buildInfo = _a.sent();
                                        build = buildInfo.id;
                                        if (!build) return [3 /*break*/, 6];
                                        return [4 /*yield*/, getTestsForBuild(build, project, buildInfo.uri)];
                                    case 4:
                                        tests = _a.sent();
                                        return [4 /*yield*/, getCoverageForBuild(build, project)];
                                    case 5:
                                        coverage = _a.sent();
                                        _a.label = 6;
                                    case 6:
                                        resolve({ tests: tests, coverage: coverage, buildInfo: buildInfo });
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                }
                else {
                    return [2 /*return*/, { tests: tests, coverage: coverage, buildInfo: { url: "no build" } }];
                }
                return [2 /*return*/];
            });
        });
    }
    function clocRepo(filename, dirPath, hash, statsOpts) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (hash != "") {
                    return [2 /*return*/, new Promise(function (resolve) { return __awaiter(_this, void 0, void 0, function () {
                            var cloc_command_include_lang, cloc_command_exclude_dir, cloc_command_out, clocCommandObj, clocCommandArr, propName, prop, expanded, cloc_command_args, cloc_command, _a, stdout, stderr;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        cloc_command_include_lang = {};
                                        cloc_command_exclude_dir = {};
                                        cloc_command_out = {
                                            "out": "\"" + filename + "\"",
                                        };
                                        if (statsOpts.langFilters) {
                                            cloc_command_include_lang = {
                                                "include-lang": "\"" + statsOpts.langFilters.join(",") + "\"",
                                            };
                                        }
                                        if (statsOpts.excludeDirs) {
                                            cloc_command_exclude_dir = {
                                                "exclude-dir": "\"" + statsOpts.excludeDirs.join(",") + "\"",
                                            };
                                        }
                                        clocCommandObj = {};
                                        Object.assign(clocCommandObj, cloc_command_out, cloc_command_include_lang, cloc_command_exclude_dir);
                                        clocCommandArr = [];
                                        for (propName in clocCommandObj) {
                                            prop = clocCommandObj[propName] + "";
                                            clocCommandArr.push("--" + propName + "=" + prop);
                                            if ((prop + "").startsWith("~")) {
                                                expanded = expandHomeDir(prop);
                                                clocCommandObj[propName] = expanded;
                                            }
                                        }
                                        cloc_command_args = clocCommandArr.join("  ");
                                        cloc_command = "cloc " + cloc_command_args + " " + hash;
                                        return [4 /*yield*/, exec(cloc_command, { "cwd": "" + dirPath })];
                                    case 1:
                                        _a = _b.sent(), stdout = _a.stdout, stderr = _a.stderr;
                                        resolve(stdout);
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                }
                return [2 /*return*/];
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
    function getHash(TOP_DIRECTORY, repo, dateStr) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var logOpts;
            return __generator(this, function (_a) {
                logOpts = { "--max-count": "1", "--before": "\"" + dateStr + "\"" };
                return [2 /*return*/, new Promise(function (resolve) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, git.cwd(path.join(TOP_DIRECTORY, repo)).log(logOpts, function (err, logs) {
                                        var hash = "";
                                        //"21ecc43d801828678e97396239df25050fc9902e"   data2.latest.hash
                                        //console.log(logs.latest.hash);
                                        if (logs.latest) {
                                            hash = logs.latest.hash;
                                        }
                                        resolve(hash);
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
    function isValidBuild(build) {
        var isGated = build.definition.name.toLowerCase().includes("gated");
        var isSonar = build.definition.name.toLowerCase().includes("sonar");
        var isGood = build.result.toLowerCase().includes("succeeded");
        return isGated || isSonar;
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
        calcStats: calcStats,
        getBuildDefs: getBuildDefs
    };
};
module.exports = statsModule;
