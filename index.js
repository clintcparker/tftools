module.exports = function(opts){
    expandHomeDir = require('expand-home-dir');
    var tfsOpts = {
        REPO_API_PATH       : "/_apis/git/repositories?api-version=5.0",
        BUILD_API_PATH      : "/_apis/build/builds?api-version=5.0",
        DEFINITIONS_API_PATH: "/_apis/build/definitions?api-version=5.0",
        COVERAGE_API_PATH   : "/_apis/test/CodeCoverage?api-version=5.0-preview.1",
        TEST_API_PATH       : "/_apis/test/runs?api-version=5.0",
    };
    if(opts){
        Object.assign(tfsOpts,opts);
    }
    if(tfsOpts.ADO_HOST == undefined)
    {
        const ADO_HOST_MESSAGE = `The ADO_HOST property is required!
        Ex: https://dev.azure.com/093231b1-334c-4cfc-abd8-882b7085
        Ex: https://customsubdomain.visualstudio.com
        
        
        ref: https://docs.microsoft.com/en-us/rest/api/azure/devops/
        `;
        console.error(ADO_HOST_MESSAGE);
        return;
    }
    if(tfsOpts.PAT == undefined)
    {
        const PAT_MESSAGE = `The PAT property is required!
        Ex: qaldqr4se5gs5g5h6limdfe53z6sbk2ipsylu776kahrotpevrmtatq

        ref: https://docs.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/pats
        `;
        console.error(PAT_MESSAGE);
        return;
    }

    if(tfsOpts.ANALYTICS_HOST == undefined){
        var ANALYTICS_URL = new URL(tfsOpts.ADO_HOST);
        ANALYTICS_URL.host="analytics."+ANALYTICS_URL.host;
        tfsOpts.ANALYTICS_HOST = ANALYTICS_URL.href;
    }

    //for each property in opts
    // if property contains/starts with ~
    // expand it and replace
    for (var propName in tfsOpts) {
        let prop = tfsOpts[propName] + "";
        if ((prop + "").startsWith("~")){
            let expanded = expandHomeDir(prop);
            tfsOpts[propName] = expanded;
        }
    }
        

    const statsModule        = require('./codestats')(tfsOpts);
    const initializerModule = require('./repo_initializer')(tfsOpts);
    const velocitiesModule  = require('./velocities')(tfsOpts);
    const utilsModule  = require('./ADOUtilities')(tfsOpts);
    const buildModule  = require('./buildModule')(tfsOpts);

    const defaultLangs = {
        dotnet : ["C#","Razor","ASP","ASP.NET","HTML","CSS","LESS","PowerShell","JavaScript","TypeScript"],
        android : ["Kotlin","Java","XML","Gradle"],
        ios : ["Objective C","XML","C/C++ Header"]
    };

    return {
        codeStats       : statsModule.calcStats,
        initializeRepos : initializerModule.initialize,
        velocities      : velocitiesModule.velocities,
        builds          : buildModule.queueBuilds,
        definitions     : statsModule.getBuildDefs,
        defaultLangs    : defaultLangs,
        velocityFields  : velocitiesModule.velocityFields
    };
};