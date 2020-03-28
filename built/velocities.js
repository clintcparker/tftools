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
var velocitiesModule = function (tfsOpts) {
    var ITERATIONS_PATH = "/_odata/v3.0-preview/Iterations";
    var TEAMS_PATH = "/_odata/v3.0-preview/Teams";
    var PROCESSES_PATH = "/_odata/v3.0-preview/Processes";
    var WORKITEMS_PATH = "/_odata/v3.0-preview/WorkItems";
    var WORKITEM_SNAPSHOT_PATH = "/_odata/v3.0-preview/WorkItemSnapshot";
    var PROCESS_CONFIG_PATH = "/_apis/work/processconfiguration?api-version=5.0-preview.1";
    var pathModule = require("path");
    var fs = require('fs');
    var parse = require('json2csv').parse;
    var querystring = require("querystring");
    var asyncPool = require("tiny-async-pool");
    var keepGoingTeams;
    var keepGoingIterations;
    var lastTeam;
    var lastPath;
    var FIELDS = [
        {
            label: "Team",
            value: "teamName",
            default: "NULL"
        },
        {
            label: "Iteration Path",
            value: "IterationPath",
            default: 'NULL'
        },
        "StartDate",
        "EndDate",
        {
            label: "Planned",
            value: "planned",
            default: 0
        },
        {
            label: "Completed",
            value: "completed",
            default: 0
        },
        {
            label: "Completed Late",
            value: "late",
            default: 0
        },
        {
            label: "Incomplete",
            value: "incomplete",
            default: 0
        },
        {
            label: "Total",
            value: "total",
            default: 0
        },
    ];
    var tfsUtils = require('./ADOUtilities')(tfsOpts);
    function getVelocities(incomingVelocityOpts) {
        return __awaiter(this, void 0, void 0, function () {
            var velocityOpts, propName, prop, expanded, teams, a, last, _a, results, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        velocityOptsDefaults = {
                            include: [],
                            exclude: [],
                            effortWord: "Effort",
                            aggregate: "sum",
                            extraPlannedDays: 0,
                            lateAfterDays: 0,
                            overWrite: false
                        };
                        velocityOpts = Object.assign({}, velocityOptsDefaults, incomingVelocityOpts);
                        for (propName in velocityOpts) {
                            prop = velocityOpts[propName] + "";
                            if ((prop + "").startsWith("~")) {
                                expanded = expandHomeDir(prop);
                                velocityOpts[propName] = expanded;
                            }
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 12, 13, 14]);
                        console.time('Overall');
                        return [4 /*yield*/, getTeamsForProject(velocityOpts.projectId)];
                    case 2:
                        teams = _b.sent();
                        keepGoingTeams = true;
                        keepGoingIterations = true;
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 7]);
                        return [4 /*yield*/, fs.readFileSync(velocityOpts.outFile)];
                    case 4:
                        a = _b.sent();
                        if (a) {
                            last = a.toString().split("\n").reverse()[0].split(",");
                            lastTeam = last[0];
                            lastPath = last[1];
                            if (lastTeam == "\"NULL\"") {
                                keepGoingTeams = false;
                                keepGoingIterations = false;
                            }
                        }
                        return [3 /*break*/, 7];
                    case 5:
                        _a = _b.sent();
                        return [4 /*yield*/, fs.writeFileSync(velocityOpts.outFile, parse({}, { header: true, fields: FIELDS }), function (err) { return err ? console.error(velocityOpts.outFile + " not written!", err) : console.log(velocityOpts.outFile + " written!"); })];
                    case 6:
                        _b.sent();
                        keepGoingTeams = false;
                        keepGoingIterations = false;
                        return [3 /*break*/, 7];
                    case 7:
                        if (!velocityOpts.overWrite) return [3 /*break*/, 9];
                        return [4 /*yield*/, fs.writeFileSync(velocityOpts.outFile, parse({}, { header: true, fields: FIELDS }), function (err) { return err ? console.error(velocityOpts.outFile + " not written!", err) : console.log(velocityOpts.outFile + " written!"); })];
                    case 8:
                        _b.sent();
                        keepGoingTeams = false;
                        keepGoingIterations = false;
                        _b.label = 9;
                    case 9:
                        if (velocityOpts.exclude && velocityOpts.exclude.length) {
                            teams = teams.filter(function (x) { return !velocityOpts.exclude.includes(x.TeamName); });
                        }
                        if (velocityOpts.include && velocityOpts.include.length) {
                            teams = teams.filter(function (x) { return velocityOpts.include.includes(x.TeamName); });
                        }
                        return [4 /*yield*/, setEffortType(velocityOpts)];
                    case 10:
                        _b.sent();
                        return [4 /*yield*/, asyncPool(1, teams, function (team) {
                                return getTeamIterationStats(team, velocityOpts.count, velocityOpts);
                            })];
                    case 11:
                        results = _b.sent();
                        console.timeLog('Overall');
                        return [2 /*return*/, results];
                    case 12:
                        error_1 = _b.sent();
                        console.log(error_1);
                        return [3 /*break*/, 14];
                    case 13: return [7 /*endfinally*/];
                    case 14: return [2 /*return*/];
                }
            });
        });
    }
    function getTeamIterationStats(team, count, velocityOpts) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                console.log("starting " + team.TeamName);
                console.time(team.TeamName);
                return [2 /*return*/, new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
                        var backlogWorkItemTypes, iterations, teamIterationResults, _i, iterations_1, iteration, iterationStats, error_2;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 8, , 9]);
                                    return [4 /*yield*/, getWorkItemTypes(team.ProjectSK, team.TeamId, velocityOpts)];
                                case 1:
                                    backlogWorkItemTypes = _a.sent();
                                    return [4 /*yield*/, getIterationsForTeam(team.ProjectSK, team.TeamId, count, velocityOpts)];
                                case 2:
                                    iterations = _a.sent();
                                    teamIterationResults = [];
                                    _i = 0, iterations_1 = iterations;
                                    _a.label = 3;
                                case 3:
                                    if (!(_i < iterations_1.length)) return [3 /*break*/, 7];
                                    iteration = iterations_1[_i];
                                    if ("\"" + iteration.IterationPath + "\"" == lastPath && keepGoingIterations) {
                                        keepGoingIterations = false;
                                        return [3 /*break*/, 6];
                                    }
                                    if (keepGoingIterations) {
                                        return [3 /*break*/, 6];
                                    }
                                    return [4 /*yield*/, getSingleTeamIterationStats(team, iteration, backlogWorkItemTypes, velocityOpts)];
                                case 4:
                                    iterationStats = _a.sent();
                                    teamIterationResults.push(iterationStats);
                                    return [4 /*yield*/, fs.appendFile(velocityOpts.outFile, "\n" + ("" + parse(iterationStats, { header: false, fields: FIELDS })), function (err) { return err ? console.error('CSV not appended!', err) : ({}); })];
                                case 5:
                                    _a.sent();
                                    _a.label = 6;
                                case 6:
                                    _i++;
                                    return [3 /*break*/, 3];
                                case 7:
                                    console.timeEnd(team.TeamName);
                                    resolve(teamIterationResults);
                                    return [3 /*break*/, 9];
                                case 8:
                                    error_2 = _a.sent();
                                    reject(error_2);
                                    return [3 /*break*/, 9];
                                case 9: return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    }
    function getSingleTeamIterationStats(team, iteration, backlogWorkItemTypes, velocityOpts) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
                        var workItems, workItemsCompletedLate, workItemsPlanned, err_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 4, , 5]);
                                    return [4 /*yield*/, getWorkItems(team.TeamId, backlogWorkItemTypes, iteration, velocityOpts)];
                                case 1:
                                    workItems = _a.sent();
                                    return [4 /*yield*/, getWorkItemsCompletedLate(team.TeamId, backlogWorkItemTypes, iteration, velocityOpts)];
                                case 2:
                                    workItemsCompletedLate = _a.sent();
                                    iteration.late = workItemsCompletedLate;
                                    return [4 /*yield*/, getWorkItemsPlanned(team.TeamId, backlogWorkItemTypes, iteration, velocityOpts)];
                                case 3:
                                    workItemsPlanned = _a.sent();
                                    iteration.planned = workItemsPlanned;
                                    iteration.incomplete = workItems.incomplete;
                                    iteration.completed = workItems.completed - workItemsCompletedLate;
                                    iteration.teamName = team.TeamName;
                                    iteration.total = workItems.completed;
                                    resolve(iteration);
                                    return [3 /*break*/, 5];
                                case 4:
                                    err_1 = _a.sent();
                                    reject(err_1);
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    }
    function getIterationsForTeam(projectId, teamId, count) {
        return __awaiter(this, void 0, void 0, function () {
            var queryParameters, path, rawIterations;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryParameters = {
                            "$filter": "Teams/any(t:t/TeamSK eq " + teamId + ") and StartDate lt now()",
                            "$orderby": "IsEnded,StartDate desc,EndDate desc,IterationName",
                            "$select": "IterationSK,IterationName,StartDate,EndDate,IsEnded,IterationPath",
                            "$top": "" + count
                        };
                        path = "/" + projectId + ITERATIONS_PATH + "?" + querystring.stringify(queryParameters);
                        return [4 /*yield*/, tfsUtils.analyticsRequest(path)];
                    case 1:
                        rawIterations = _a.sent();
                        return [2 /*return*/, rawIterations.value];
                }
            });
        });
    }
    function getTeamsForProject(projectId) {
        return __awaiter(this, void 0, void 0, function () {
            var path, teams;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        path = "/" + projectId + TEAMS_PATH;
                        return [4 /*yield*/, tfsUtils.analyticsRequest(path)];
                    case 1:
                        teams = _a.sent();
                        return [2 /*return*/, teams.value];
                }
            });
        });
    }
    function getWorkItemTypes(projectId, teamId) {
        return __awaiter(this, void 0, void 0, function () {
            var queryParameters, path, rawTypes, backlogItems;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryParameters = {
                            "$apply": "filter(TeamSK eq " + teamId + " and  ProjectSK eq " + projectId + ")\n                    /\n                    groupby((BacklogCategoryReferenceName, WorkItemType, IsBugType, BacklogName))"
                        };
                        path = PROCESSES_PATH + "?" + querystring.stringify(queryParameters);
                        return [4 /*yield*/, tfsUtils.analyticsRequest(path)];
                    case 1:
                        rawTypes = _a.sent();
                        backlogItems = rawTypes.value.filter(function (x) { return x.BacklogName == "Backlog items"; });
                        return [2 /*return*/, backlogItems];
                }
            });
        });
    }
    function setEffortType(velocityOpts) {
        return __awaiter(this, void 0, void 0, function () {
            var path, processInfo, effortWord;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        path = pathModule.join("/", velocityOpts.projectId, PROCESS_CONFIG_PATH);
                        return [4 /*yield*/, tfsUtils.ADORequest(path)];
                    case 1:
                        processInfo = _a.sent();
                        effortWord = processInfo.typeFields.Effort.referenceName.split('.').pop();
                        velocityOpts.effortWord = effortWord;
                        return [2 /*return*/];
                }
            });
        });
    }
    function getWorkItems(teamId, backlogTypes, iteration, velocityOpts) {
        return __awaiter(this, void 0, void 0, function () {
            var workItemLine, queryParameters, path, rawWorkItems, workItems, completed, incomplete, completedElem, incompleteElem;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        workItemLine = buildWorkItemLine(backlogTypes);
                        queryParameters = {
                            "$apply": "filter(Teams/any(t:t/TeamSK eq " + teamId + ") \n                    " + workItemLine + "\n                    and (IterationSK eq " + iteration.IterationSK + ") and StateCategory ne null) \n                    /\n                    groupby((StateCategory, IterationSK),aggregate(" + velocityOpts.effortWord + " with sum as AggregationResult))"
                        };
                        path = "/" + velocityOpts.projectId + WORKITEMS_PATH + "?" + querystring.stringify(queryParameters);
                        return [4 /*yield*/, tfsUtils.analyticsRequest(path)];
                    case 1:
                        rawWorkItems = _a.sent();
                        workItems = rawWorkItems.value;
                        completed = 0;
                        incomplete = 0;
                        if (workItems && workItems.length > 0) {
                            completedElem = workItems.find(function (x) { return x.StateCategory == "Completed"; });
                            if (completedElem) {
                                completed = completedElem.AggregationResult ? completedElem.AggregationResult : 0; //this is the total completed. Note th lack of a date in the query
                            }
                            incompleteElem = workItems.find(function (x) { return x.StateCategory == "InProgress"; });
                            if (incompleteElem) {
                                incomplete = incompleteElem.AggregationResult ? incompleteElem.AggregationResult : 0;
                            }
                        }
                        return [2 /*return*/, { completed: completed, incomplete: incomplete }];
                }
            });
        });
    }
    function buildWorkItemLine(backlogTypes) {
        if (backlogTypes.length) {
            var workItemFilters = backlogTypes.map(function (x) { return " WorkItemType eq '" + x.WorkItemType + "' "; });
            var workItemFilter = workItemFilters.join(" or ");
            return workItemFilters.length > 0 ? "\n            and (" + workItemFilter + ") \n            " : "";
        }
        return "";
    }
    function getWorkItemsCompletedLate(teamId, backlogTypes, iteration, velocityOpts) {
        return __awaiter(this, void 0, void 0, function () {
            var endDate, workItemLine, queryParameters, path, rawWorkItems, workItems, late;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        endDate = velocityOpts.lateAfterDays >= 0 ? tfsUtils.buildDateStringForAnalytics(iteration.EndDate, velocityOpts.lateAfterDays) : "Iteration/EndDate";
                        workItemLine = buildWorkItemLine(backlogTypes);
                        queryParameters = {
                            "$apply": "filter(Teams/any(t:t/TeamSK eq " + teamId + ") \n                    " + workItemLine + "\n                    and StateCategory eq 'Completed' \n                    and (IterationSK eq " + iteration.IterationSK + ") \n                    and CompletedDate gt " + endDate + ") \n                    /\n                    groupby((StateCategory, IterationSK),aggregate(" + velocityOpts.effortWord + " with sum as AggregationResult))"
                        };
                        path = "/" + velocityOpts.projectId + WORKITEMS_PATH + "?" + querystring.stringify(queryParameters);
                        return [4 /*yield*/, tfsUtils.analyticsRequest(path)];
                    case 1:
                        rawWorkItems = _a.sent();
                        workItems = rawWorkItems.value;
                        late = 0;
                        if (workItems && workItems[0]) {
                            late = workItems[0].AggregationResult ? workItems[0].AggregationResult : 0;
                        }
                        return [2 /*return*/, late];
                }
            });
        });
    }
    function getWorkItemsPlanned(teamId, backlogTypes, iteration, velocityOpts) {
        return __awaiter(this, void 0, void 0, function () {
            var iterationStart, workItemLine, queryParameters, path, rawWorkItems, workItems, planned;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        iterationStart = tfsUtils.buildDateStringForADO(iteration.StartDate, velocityOpts.extraPlannedDays);
                        workItemLine = buildWorkItemLine(backlogTypes);
                        queryParameters = {
                            "$apply": "filter(Teams/any(t:t/TeamSK eq  " + teamId + ") \n            " + workItemLine + "\n            and (RevisedDateSK eq null or RevisedDateSK gt " + iterationStart + ") \n            and (\n                    (\n                        (\n                            (IterationSK eq " + iteration.IterationSK + " and DateSK eq " + iterationStart + ")) \n                            and (IterationSK eq " + iteration.IterationSK + ") and (DateSK eq " + iterationStart + "))) \n                            and StateCategory ne null)\n                            /\n                            groupby((IterationSK),aggregate(" + velocityOpts.effortWord + " with sum as AggregationResult))"
                        };
                        path = "/" + velocityOpts.projectId + WORKITEM_SNAPSHOT_PATH + "?" + querystring.stringify(queryParameters);
                        return [4 /*yield*/, tfsUtils.analyticsRequest(path)];
                    case 1:
                        rawWorkItems = _a.sent();
                        workItems = rawWorkItems.value;
                        planned = 0;
                        if (workItems && workItems[0]) {
                            planned = workItems[0].AggregationResult;
                        }
                        return [2 /*return*/, planned];
                }
            });
        });
    }
    return {
        velocities: getVelocities,
        velocityFields: FIELDS.map(function (x) { if (x.label) {
            return x.value;
        } return x; })
    };
};
module.exports = velocitiesModule;
