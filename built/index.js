module.exports = function (opts) {
    expandHomeDir = require('expand-home-dir');
    var tfsOpts = {
        REPO_API_PATH: "/_apis/git/repositories?api-version=5.0",
        BUILD_API_PATH: "/_apis/build/builds?api-version=5.0",
        DEFINITIONS_API_PATH: "/_apis/build/definitions?api-version=5.0",
        COVERAGE_API_PATH: "/_apis/test/CodeCoverage?api-version=5.0-preview.1",
        TEST_API_PATH: "/_apis/test/runs?api-version=5.0",
    };
    if (opts) {
        Object.assign(tfsOpts, opts);
    }
    if (tfsOpts.ADO_HOST == undefined) {
        var ADO_HOST_MESSAGE = "The ADO_HOST property is required!\n        Ex: https://dev.azure.com/093231b1-334c-4cfc-abd8-882b7085\n        Ex: https://customsubdomain.visualstudio.com\n        \n        \n        ref: https://docs.microsoft.com/en-us/rest/api/azure/devops/\n        ";
        console.error(ADO_HOST_MESSAGE);
        return;
    }
    if (tfsOpts.PAT == undefined) {
        var PAT_MESSAGE = "The PAT property is required!\n        Ex: qaldqr4se5gs5g5h6limdfe53z6sbk2ipsylu776kahrotpevrmtatq\n\n        ref: https://docs.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/pats\n        ";
        console.error(PAT_MESSAGE);
        return;
    }
    if (tfsOpts.ANALYTICS_HOST == undefined) {
        var ANALYTICS_URL = new URL(tfsOpts.ADO_HOST);
        var hostArray = ANALYTICS_URL.origin.split(".");
        var tld = hostArray.pop();
        var domain = hostArray.pop();
        hostArray.push("analytics");
        hostArray.push(domain);
        hostArray.push(tld);
        var host = hostArray.join(".");
        tfsOpts.ANALYTICS_HOST = host;
    }
    //for each property in opts
    // if property contains/starts with ~
    // expand it and replace
    for (var propName in tfsOpts) {
        var prop = tfsOpts[propName] + "";
        if ((prop + "").startsWith("~")) {
            var expanded = expandHomeDir(prop);
            tfsOpts[propName] = expanded;
        }
    }
    var statsModule = require('./codestats')(tfsOpts);
    var initializerModule = require('./repo_initializer')(tfsOpts);
    var velocitiesModule = require('./velocities')(tfsOpts);
    var utilsModule = require('./ADOUtilities')(tfsOpts);
    var buildModule = require('./buildModule')(tfsOpts);
    var defaultLangs = {
        dotnet: ["C#", "Razor", "ASP", "ASP.NET", "HTML", "CSS", "LESS", "PowerShell", "JavaScript", "TypeScript"],
        android: ["Kotlin", "Java", "XML", "Gradle"],
        ios: ["Objective C", "XML", "C/C++ Header"]
    };
    return {
        codeStats: statsModule.calcStats,
        initializeRepos: initializerModule.initialize,
        velocities: velocitiesModule.velocities,
        builds: buildModule.queueBuilds,
        definitions: statsModule.getBuildDefs,
        defaultLangs: defaultLangs,
        velocityFields: velocitiesModule.velocityFields
    };
};
