const buildModule = function(tfsOpts) {
    const tfsUtils = require("./ADOUtilities")(tfsOpts);
    const fs = require("fs");
    const querystring = require('querystring');
    const util = require('util');
    const path = require("path");
    const git = require("simple-git")();
    const { parse } = require('json2csv');
    const https = require("https");
    const asyncPool  = require("tiny-async-pool");


    async function queueBuildForDate(TOP_DIRECTORY,dateStr,repo){
        var gitConfigFile = path.join(TOP_DIRECTORY,repo,".git","config");
        var remote = await getRemoteFromFile(gitConfigFile);
        var repoInfo = await getRepoInfoFromRemoteUrl(remote);
        await git.cwd(path.join(TOP_DIRECTORY,repo));
        //console.log(gitConfigFile);
        //await git.pull();
        var branchName;
        await git.status(function(err,status){
            branchName = status.current;
        });
        var logOpts = {"--max-count":"1", "--before":`"${dateStr}"`};
        var hash = "";
        await git.log(logOpts, function(err, logs){
            //"21ecc43d801828678e97396239df25050fc9902e"   data2.latest.hash
            //console.log(logs.latest.hash);
            if(logs.latest){
                hash = logs.latest.hash;
            }
        });
        if(hash){
            var buildId = await queueBuildForRepo(repoInfo,hash, branchName);
            var repoResult = {
                buildId: buildId,
            };
        }
        return  repoResult;
    }

    async function getFilesInDir(TOP_DIRECTORY){
        return new Promise(async resolve => {
            await fs.readdir(TOP_DIRECTORY, async function(err,repos){
                resolve(repos.filter(x=>x!=".DS_Store"));
            });
        });
    }

    async function queueBuilds(buildOpts) {
        //for each property in opts
        // if property contains/starts with ~
        // expand it and replace
        for (var propName in buildOpts) {
            let prop = buildOpts[propName] + "";
            if ((prop + "").startsWith("~")){
                let expanded = expandHomeDir(prop);
                buildOpts[propName] = expanded;
            }
        }
        const results = [];
        var endDate = buildOpts.endDate;
        var dateStr = buildDateStringForGit(endDate);
        var TOP_DIRECTORY = buildOpts.Directory;



        try {
            var repos =  await getFilesInDir(TOP_DIRECTORY);
            let results = await asyncPool(1, repos, repo => {
                return queueBuildForDate(TOP_DIRECTORY,dateStr,repo);
            });
            console.table(results);
        }
        catch (err){
            console.log(err);
        }
    }

    async function queueBuild(repoInfo, hash, def,branch) {
        var path= `/${repoInfo.project}${tfsOpts.BUILD_API_PATH}`;
        var body = JSON.stringify(
            {
                "queue": {"id":def.queue.id},
                "definition": {"id":def.id},
                "project": {"id":`${repoInfo.project}`},
                //"sourceBranch":`refs/heads/${branch}`,
                "sourceVersion":`${hash}`,
                "reason":1,
                "demands":[],
                "parameters":"{\"system.debug\":\"false\",\"BuildConfiguration\":\"release\",\"BuildPlatform\":\"any cpu\"}"
            }
        );
        var options = {
            host: tfsOpts.ADO_HOST,
            port: 443,
            path: path,
            rejectUnauthorized:false,
            method: 'POST',
        };
        options.headers=tfsUtils.buildHeaders(tfsOpts.PAT,options.host);
        options.headers["Content-Type"]='application/json';
        options.headers["Content-Length"]=Buffer.byteLength(body);
        options.url = `${options.host}${options.path}`;
        return new Promise ((resolve,reject)=>{
            var req = https.request(options,(res)=>{
                var message="";
                res.on("end",function(){
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
    }

    async function queueBuildForRepo(repoInfo,hash,branch){
        var buildDef = await getBuildDefinitionForRepo(repoInfo);
        var buildId = await queueBuild(repoInfo,hash,buildDef,branch);
        return buildId;
    }

    //#region helpers
    async function getRemoteFromFile(gitConfigFile){
        return new Promise( async resolve => {
            await fs.readFile(gitConfigFile, async function (err, data){
                var pattern = /remote.*[\r\n\s]*\w+[\s=]*(?<url>.*)[\r\n\s]+/;
                pattern.dotAll = true;
                var str = data.toString();
                var match = str.match(pattern);
                var remote = match[1];
                resolve(remote);
            });
        });
    }

    async function getRepoInfoFromRemoteUrl(remoteUrl){
        var val = await tfsUtils.getRepos();
        var repo = val.find(y=>y.remoteUrl == remoteUrl);
        var id = repo.id;
        var project = repo.project.id;
        return {id:id,project:project};
    }

    async function getBuildDefs(repositoryId,project)
    {
        const queryParameters = {
            "$top" : "15",
            //"resultFilter" : "succeeded",
            //"resultFilter" : "partiallySucceeded",
            "repositoryId" : repositoryId,
            "repositoryType" : "tfsgit",
            "builtAfter" :  buildDateString(addDays(new Date(Date.now()),-40)),
        };
        var path= `/${project}${tfsOpts.DEFINITIONS_API_PATH}&${querystring.stringify(queryParameters)}`;
        var url = `${tfsOpts.ADO_HOST}${path}`;
        var defResponse = await tfsUtils.ADORequest(path);
        return defResponse.value;
    }

    async function getBuildDefinitionForRepo(repo){
        var buildDefs = await getBuildDefs(repo.id,repo.project);
        var gated = buildDefs.find(x=>x.name.toLowerCase().includes("gated"));
        var sonar = buildDefs.find(x=>x.name.toLowerCase().includes("sonar"));
        var buildDef = buildDefs[0];
        if(gated){
            return gated;
        }
        if(sonar){
            return sonar;
        }
        return buildDef;
    }

    async function getLatestBuildSource(repo, hash, branch){
        function isValidBuild(build){
            try{
                var isGated = build.definition.name.toLowerCase().includes("gated");
                var isSonar = build.definition.name.toLowerCase().includes("sonar");
                var isGood = build.result.toLowerCase().includes("succeeded");
                return (isGated || isSonar) && isGood  && (build.sourceVersion == hash);
            } catch (err){
                return false;
            }
        }
        // var buildDefs = await getBuildDefs(repo.id,repo.project, endDate)
        // var gated = buildDefs.find(x=>x.name.includes("gated"));
        // var sonar = buildDefs.find(x=>x.name.includes("sonar"));
        var buildDef = await getBuildDefinitionForRepo(repo);
        // if(gated
        //     buildDef = gated;
        // }
        // if(sonar){
        //     buildDef = sonar;
        // }
        const queryParameters = {
            "$top" : "15",
            //"resultFilter" : "succeeded",
            //"resultFilter" : "partiallySucceeded",
            "repositoryId" : repo.id,
            "queryOrder":"finishTimeDescending",
            "repositoryType" : "tfsgit",
            //"reasonFilter":"pullRequest",
            "sourceBranch":`refs/heads/${branch}`,
            "sourceVersion":`${hash}`,
        };
        if(buildDef){
            queryParameters.definitions = buildDef.id;
        }
        var path= `/${repo.project}${tfsOpts.BUILD_API_PATH}&${querystring.stringify(queryParameters)}`;
        var url = `${tfsOpts.ADO_HOST}${path}`;
        var buildResponse = await tfsUtils.ADORequest(path);
        var buildData;
        var buildArr = buildResponse.value;
        if(buildResponse.count > 0){
            buildData = buildArr.find(isValidBuild);

            if(buildData == undefined)
            {
                buildData = buildResponse.value[0];
            }
        }
        if(buildData == undefined)
        {
            debugger;
        }
        var id = buildData ? buildData.id: "";
        var uri = buildData ? buildData.uri:"";
        return {id:id,url:url,uri:uri};
    }


    async function getLatestBuildForRepo(repo, endDate){
        // var buildDefs = await getBuildDefs(repo.id,repo.project, endDate)
        // var gated = buildDefs.find(x=>x.name.includes("gated"));
        // var sonar = buildDefs.find(x=>x.name.includes("sonar"));
        var buildDef = await getBuildDefinitionForRepo(repo);
        // if(gated){
        //     buildDef = gated;
        // }
        // if(sonar){
        //     buildDef = sonar;
        // }
        const queryParameters = {
            "$top" : "15",
            //"resultFilter" : "succeeded",
            //"resultFilter" : "partiallySucceeded",
            "repositoryId" : repo.id,
            "queryOrder":"finishTimeDescending",
            "repositoryType" : "tfsgit",
            //"reasonFilter":"pullRequest",
            "minTime" : buildDateString(endDate)
        };
        if(buildDef){
            queryParameters.definitions = buildDef.id;
        }
        var path= `/${repo.project}${tfsOpts.BUILD_API_PATH}&${querystring.stringify(queryParameters)}`;
        var url = `${tfsOpts.ADO_HOST}${path}`;
        var buildResponse = await tfsUtils.ADORequest(path);
        var buildData;
        var buildArr = buildResponse.value;
        if(buildResponse.count > 0){
            buildData = buildArr.find(isValidBuild);

            if(buildData == undefined)
            {
                buildData = buildResponse.value[0];
            }
        }
        if(buildData == undefined)
        {
            debugger;
        }
        var id = buildData ? buildData.id: "";
        var uri = buildData ? buildData.uri:"";
        return {id:id,url:url,uri:uri};
    }

    

    //https://mindbody.visualstudio.com/19477e8d-94b2-4461-9dfc-2f54fa23767d/_apis/test/CodeCoverage?buildId=331398&api-version=5.0-preview.1

    async function getCoverageForBuild(buildId, project){
        const queryParameters = {
            "buildId" : buildId
        };
        var path = `/${project}${tfsOpts.COVERAGE_API_PATH}&${querystring.stringify(queryParameters)}`;
        var coverageResponse = await tfsUtils.ADORequest(path);
        var coverage =coverageResponse.coverageData[0];
        var coverageInfo = getCoverageInfo(coverage);
        return coverageInfo;
    }

    //https://mindbody.visualstudio.com/19477e8d-94b2-4461-9dfc-2f54fa23767d/_apis/test/runs?minLastUpdatedDate=06-10-2019&maxLastUpdatedDate=06-15-2019&api-version=5.0&buildIds=331398

    async function getTestsForBuild(buildId, project,uri){
        const queryParameters = {
            "buildUri" : uri,   
        };
        var path = `/${project}${tfsOpts.TEST_API_PATH}&${querystring.stringify(queryParameters)}`;
        var testRunResponse = await tfsUtils.ADORequest(path);
        var testRuns =testRunResponse.value;
        if (testRuns && testRuns.length > 0){
            var testRunData = getTestRunData(testRuns);
            return testRunData;
        } else {
            return {passing:0,failing:0};
        }
    }


    function getTestRunData(testRuns) {
        if (testRuns.length == 1){
            return getPassingAndFailing(testRuns[0]);
        }
        return testRuns.reduce(testReducer);
    }

    function getPassingAndFailing(x){
        var passing = x.passedTests ? x.passedTests:0;
        var failing = x.unanalyzedTests ?x.unanalyzedTests:0;
        var skipped = x.notApplicableTests?x.notApplicableTests:0;
        return {passing:passing,failing:failing, skipped:skipped};
    }

    function testReducer(totals, x) {
        var retTotals = {};
        if (!totals.passing)
        {
            retTotals = getPassingAndFailing(totals);
        }else{
            retTotals = totals;
        }
        xTotals = getPassingAndFailing(x);
        retTotals.passing += xTotals.passing;
        retTotals.failing += xTotals.failing;
        return retTotals;
    }

    function buildDateString(date){
        const enUS = "en-US";
        var MM = date.toLocaleDateString(enUS, {month:'2-digit'});
        var DD = date.toLocaleDateString(enUS, {day:'2-digit'});
        var YYYY = date.toLocaleDateString(enUS, {year:'numeric'});
        return `${MM}-${DD}-${YYYY}`;
    }

    function addDays(date, days) {
        var result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    function getCoverageInfo(coverage){
        var covData = {
            branches_total : "",
            branches_covered : "",
            lines_total : "",
            lines_covered : ""
        };
        if (coverage && coverage.coverageStats){
            var branchElem = coverage.coverageStats.find(x=>x.label == "Branches" || x.label == "Blocks");
            var linesElem = coverage.coverageStats.find(x=>x.label == "Lines");
            covData.branches_covered = branchElem.covered;
            covData.branches_total = branchElem.total;
            covData.lines_covered = linesElem.covered;
            covData.lines_total = linesElem.total;
        }
        return covData;
    }

    function buildDateStringForGit(date){
        const enUS = "en-US";
        var Mon = date.toLocaleDateString(enUS, {month:'short'});
        var DD = date.toLocaleDateString(enUS, {day:'numeric'});
        var YYYY = date.toLocaleDateString(enUS, {year:'numeric'});
        return `${Mon} ${DD} ${YYYY}`;
    }
    //#endregion helpers

    return {
        queueBuilds:queueBuilds,
        getBuildDefinitionForRepo:getBuildDefinitionForRepo,
        getLatestBuildForRepo:getLatestBuildForRepo,
        getLatestBuildSource:getLatestBuildSource,
        queueBuildForRepo:queueBuildForRepo
    };
};
module.exports = buildModule;