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
//#region node modules
var fs = require("fs");
var git = require("simple-git")();
var request = require('retry-request', {
    request: require('request')
});
var path = require("path");
var rimraf = require("rimraf");
var asyncPool = require("tiny-async-pool");
var initializerModule = function (tfsOpts) {
    //#endregion node modules
    var tfsUtils = require('./ADOUtilities')(tfsOpts);
    function initialize(opts) {
        return __awaiter(this, void 0, void 0, function () {
            var propName, prop, expanded, repoList, pattern_1, ADORepos, filtered, removals, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        //for each property in opts
                        // if property contains/starts with ~
                        // expand it and replace
                        for (propName in opts) {
                            prop = opts[propName] + "";
                            if ((prop + "").startsWith("~")) {
                                expanded = expandHomeDir(prop);
                                opts[propName] = expanded;
                            }
                        }
                        repoList = opts.repo_list;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, fs.mkdir(opts.TOP_DIRECTORY, function (err) {
                                console.log(err);
                            })];
                    case 2:
                        _a.sent();
                        pattern_1 = /([rR]elease|[Ee]nvironment)/;
                        return [4 /*yield*/, tfsUtils.getRepos()];
                    case 3:
                        ADORepos = _a.sent();
                        filtered = ADORepos.filter(function (x) { return repoList.some(function (y) { return x.name == y && !x.remoteUrl.match(pattern_1); }); });
                        git.cwd(opts.TOP_DIRECTORY + "/");
                        return [4 /*yield*/, asyncPool(1, filtered, function (repo) {
                                return rmAndClone(path.join(opts.TOP_DIRECTORY, repo.name), repo.remoteUrl);
                            })];
                    case 4:
                        removals = _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        err_1 = _a.sent();
                        console.log(err_1);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/, true];
                }
            });
        });
    }
    ;
    return { initialize: initialize };
};
function rmAndClone(dirPath, remote) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, rimraf(dirPath, function (err) {
                                    return __awaiter(this, void 0, void 0, function () {
                                        var _a;
                                        return __generator(this, function (_b) {
                                            switch (_b.label) {
                                                case 0:
                                                    _a = resolve;
                                                    return [4 /*yield*/, git.clone(remote)];
                                                case 1:
                                                    _a.apply(void 0, [_b.sent()]);
                                                    return [2 /*return*/];
                                            }
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
module.exports = initializerModule;
