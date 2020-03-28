"use strict";
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
var tfsUtilsModule = function (tfsOpts) {
    var request = require('retry-request', {
        request: require('request')
    });
    //#endregion node modules
    var https = require('https');
    var querystring = require('querystring');
    var REPO_API_PATH = "/_apis/git/repositories?api-version=5.0";
    var BUILD_API_PATH = "/_apis/build/builds?api-version=5.0";
    var DEFINITIONS_API_PATH = "/_apis/build/definitions?api-version=5.0";
    var COVERAGE_API_PATH = "/_apis/test/CodeCoverage?api-version=5.0-preview.1";
    var TEST_API_PATH = "/_apis/test/runs?api-version=5.0";
    var ITERATIONS_PATH = "/_odata/v3.0-preview/Iterations";
    var TEAMS_PATH = "/_odata/v3.0-preview/Teams";
    var PROCESSES_PATH = "/_odata/v3.0-preview/Processes";
    var WORKITEMS_PATH = "/_odata/v3.0-preview/WorkItems";
    var WORKITEM_SNAPSHOT_PATH = "/_odata/v3.0-preview/WorkItemSnapshot";
    var lastBackOff = 0;
    var backOffs = {};
    function buildHeaders(PAT, host) {
        var h = host.replace(/http(s)*:(\/)+/, "");
        return {
            'Authorization': 'Basic ' + Buffer.from("" + ':' + PAT).toString('base64'),
            'Accept': "application/json,text/html",
            'Host': "" + h,
            'Upgrade-Insecure-Requests': '1'
        };
    }
    function retryFunction(incomingHttpMessage) {
        var bad = incomingHttpMessage.statusMessage !== 'OK';
        var backOff = 0;
        var lastBackOff = backOffs[incomingHttpMessage.host] ? backOffs[incomingHttpMessage.host] : 0;
        if (lastBackOff != 0 || bad) {
            backOff = lastBackOff != 0 ? (Date.now() - lastBackOff) / 1000 : 0;
            console.log(incomingHttpMessage.statusCode + "   +" + backOff + "s");
        }
        if (bad) {
            lastBackOff = Date.now();
            //console.log(incomingHttpMessage);
        }
        else {
            lastBackOff = 0;
        }
        backOffs[incomingHttpMessage.host] = lastBackOff;
        return bad;
    }
    function ADORequest(path) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var options, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        options = {
                            host: tfsOpts.ADO_HOST,
                            port: 443,
                            path: path,
                            rejectUnauthorized: false,
                        };
                        _a = options;
                        return [4 /*yield*/, buildHeaders(tfsOpts.PAT, options.host)];
                    case 1:
                        _a.headers = _b.sent();
                        options.url = "" + options.host + options.path;
                        return [2 /*return*/, new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
                                var opts;
                                return __generator(this, function (_a) {
                                    opts = {
                                        shouldRetryFn: retryFunction,
                                        retries: 10
                                    };
                                    //request(options,opts,requestCallback(resolve,reject))
                                    request(options, opts, function (error, response, body) {
                                        if (error) {
                                            reject(path + "  " + error);
                                            return;
                                        }
                                        if (response.statusCode >= 400) {
                                            reject(path + "  " + body);
                                            return;
                                        }
                                        var data = JSON.parse(body);
                                        resolve(data);
                                    });
                                    return [2 /*return*/];
                                });
                            }); })];
                }
            });
        });
    }
    function requestCallback(resolve, reject) {
        function requestCallbackInner(error, response, body) {
            if (error) {
                reject(path + "  " + error);
                return;
            }
            if (response.statusCode >= 400) {
                reject(path + "  " + body);
                return;
            }
            var data = JSON.parse(body);
            resolve(data);
        }
        ;
        return requestCallbackInner;
    }
    var analyticsLastBackOff = 0;
    function analyticsRequest(path) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var options;
            return __generator(this, function (_a) {
                options = {
                    host: tfsOpts.ANALYTICS_HOST,
                    port: 443,
                    path: path,
                    rejectUnauthorized: false,
                };
                options.headers = buildHeaders(tfsOpts.PAT, options.host);
                options.url = "" + options.host + options.path;
                return [2 /*return*/, new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
                        var opts;
                        return __generator(this, function (_a) {
                            opts = {
                                shouldRetryFn: retryFunction,
                                retries: 10
                            };
                            //request(options,opts,requestCallback(resolve,reject))
                            request(options, opts, function (error, response, body) {
                                if (error) {
                                    reject(path + "  " + error);
                                    return;
                                }
                                if (response.statusCode >= 400) {
                                    reject(path + "  " + body);
                                    return;
                                }
                                var data = JSON.parse(body);
                                resolve(data);
                            });
                            return [2 /*return*/];
                        });
                    }); })];
            });
        });
    }
    function getRepos() {
        return __awaiter(this, void 0, void 0, function () {
            var rawRepos;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, ADORequest(REPO_API_PATH)];
                    case 1:
                        rawRepos = _a.sent();
                        return [2 /*return*/, rawRepos.value];
                }
            });
        });
    }
    function buildDateStringForADO(dateStr, plusDays) {
        var date = addDays(new Date(dateStr), plusDays);
        var enUS = "en-US";
        var MM = ("" + (date.getUTCMonth() + 1)).padStart(2, 0);
        var DD = ("" + date.getUTCDate()).padStart(2, 0);
        var YYYY = date.getUTCFullYear();
        return "" + YYYY + MM + DD;
    }
    function buildDateStringForAnalytics(dateStr, plusDays) {
        var timePart = dateStr.replace(/\d{4}-\d{2}-\d{2}T/, "T");
        var dateIn = new Date(dateStr);
        var date = addDays(dateIn, plusDays);
        var ISOString = date.toISOString();
        var stringForAnalytics = ISOString.replace(/T.*$/, "");
        return "" + stringForAnalytics + timePart;
    }
    function queueBuild(projectId, repoId, hash) {
        return __awaiter(this, void 0, void 0, function () {
            var queryParameters, proj, path, body, options;
            return __generator(this, function (_a) {
                queryParameters = {};
                proj = "0fa9dfee-f92d-4a1b-9d77-071a4f54265a";
                path = "/" + proj + tfsOpts.BUILD_API_PATH + "&" + querystring.stringify(queryParameters);
                body = JSON.stringify({
                    definition: {
                        id: 1468,
                    },
                    repository: { id: '65fa7b83-5c9b-4fb9-9046-4aae31e67882' },
                    sourceVersion: "5977f3f5b897bd8069b0c9af1372fe064104b3f5"
                });
                options = {
                    host: tfsOpts.ADO_HOST,
                    port: 443,
                    path: path,
                    rejectUnauthorized: false,
                    method: 'POST',
                };
                options.headers = buildHeaders(tfsOpts.PAT, options.host);
                options.headers["Content-Type"] = 'application/json';
                options.headers["Content-Length"] = Buffer.byteLength(body);
                options.url = "" + options.host + options.path;
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var req = https.request(options, function (res) {
                            res.on("end", function () {
                                console.log('ended');
                                resolve(res);
                            });
                            //res.setEncoding('utf8');
                            res.on('data', function (chunk) {
                                console.log('Response: ' + chunk);
                            });
                        });
                        req.write(body);
                        req.end();
                    })];
            });
        });
    }
    function addDays(date, days) {
        var result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }
    return {
        ADORequest: ADORequest,
        analyticsRequest: analyticsRequest,
        buildDateStringForADO: buildDateStringForADO,
        buildDateStringForAnalytics: buildDateStringForAnalytics,
        getRepos: getRepos,
        queueBuild: queueBuild,
        buildHeaders: buildHeaders,
        addDays: addDays
    };
};
module.exports = tfsUtilsModule;
