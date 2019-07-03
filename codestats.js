const statsModule = function(tfsOpts) {
    const tfsUtils = require("./ADOUtilities")(tfsOpts);
    const buildModule = require("./buildModule")(tfsOpts);
    const fs = require("fs");
    const querystring = require('querystring');
    const util = require('util');
    const exec = util.promisify(require('child_process').exec);
    const path = require("path");
    const git = require("simple-git")();
    const { parse } = require('json2csv');
    const asyncPool = require('tiny-async-pool')
    const expandHomeDir = require('expand-home-dir')

    async function getBuildDefs(statsOpts){
        expand(statsOpts);
        var repos = await getFilesInDir(statsOpts.Directory);
        return  getBuildDefsForRepos(repos,statsOpts.Directory)
    }

    async function calcStats(statsOpts){
        return new Promise(async resolve => {
            let dates = statsOpts.dates;
            let results = await asyncPool(1, dates, date => {
                let opts = Object.assign({},statsOpts);
                opts.EndDate = new Date(date);
                return  getCodeStatForDate(opts);
            });
            resolve(results);
        });
    }

    function getCodeStatForDate(opts){
        return new Promise(async resolve => {
            let  results =  await  calcStatsForDate(opts)
            resolve(results);
        });
    }

    async function getBuildDefsForRepos(repos,TOP_DIRECTORY){
        return new Promise(async resolve => {
            let results = await asyncPool(5, repos, repo => {
                return getBuildDefinitionForRepo(repo,TOP_DIRECTORY)
            });
            resolve(results);
        });
    }

    async function  getBuildDefinitionForRepo(repoName, Directory){
        let gitConfigFile = path.join(Directory,repoName,".git","config");
        //console.log(gitConfigFile);
        let remote = await getRemoteFromFile(gitConfigFile);
        let info = await getRepoInfoFromRemoteUrl(remote);
        return  buildModule.getBuildDefinitionForRepo(info)
    }

    function expand(incomingOpts){
        for (var propName in incomingOpts) {
            let prop = incomingOpts[propName] + "";
            if ((prop + "").startsWith("~")){
                let expanded = expandHomeDir(prop);
                incomingOpts[propName] = expanded;
            }
        }
    }



    async function calcStatsForDate(statsOpts) {
        return new Promise(async (resolve,reject) => {
            for (var propName in statsOpts) {
                let prop = statsOpts[propName] + "";
                if ((prop + "").startsWith("~")){
                    let expanded = expandHomeDir(prop);
                    statsOpts[propName] = expanded;
                }
            }
            const ROLLUP_BU = path.basename(statsOpts.Directory);
            var endDate = statsOpts.EndDate;
            var dateStr = buildDateStringForGit(endDate);
            var TOP_DIRECTORY = statsOpts.Directory
            var outputDirectory = path.join(statsOpts.outputDirectory,`${ROLLUP_BU} ${dateStr}`)
            var resultFile = `${ROLLUP_BU}-${buildDateString(endDate)}.csv`

            var getVSTSStats = statsOpts.VSTS;
            var getCLOC = statsOpts.CLOC;
            var getTests = statsOpts.Tests;


            try {
                if (getVSTSStats || getCLOC || getTests){
                    await fs.mkdir(outputDirectory, async function(err, data1){
                        console.log(err);
                        console.log(data1);

                    });
                    var repos = await getFilesInDir(TOP_DIRECTORY);
                    let results = await getStatsForRepos(repos,TOP_DIRECTORY,outputDirectory,dateStr,getCLOC,getVSTSStats,getTests,resultFile,statsOpts)
                    //return results;
                    resolve(results);
                }
            }
            catch (err){
                console.log(err);
                reject(err)
            }
        });
    }

    async function getFilesInDir(TOP_DIRECTORY){
        return new Promise(async resolve => {
            await fs.readdir(TOP_DIRECTORY, async function(err,repos){
                
                resolve(repos.filter(x=>x!=".DS_Store"));
            })
        });
    }


    async function getStatsForRepos(repos,TOP_DIRECTORY,outputDirectory,dateStr,getCLOC,getVSTSStats,getTests,resultFile,statsOpts){
        return new Promise(async resolve => {
            let results = await asyncPool(1, repos, repo => {
                return getStatsForRepo(repo, TOP_DIRECTORY,outputDirectory,dateStr,getCLOC,getVSTSStats,getTests,Object.assign({},statsOpts))
            });

            if (getCLOC)
            {
                var {stdout, stderr} = await exec(`ls`,{"cwd":`${outputDirectory}`})
                var ls = stdout.replace(/\n/g, " ");
                var {stdout, stderr} = await exec(`cloc --sum-reports --out="${path.join(outputDirectory,"totals")}" ${ls}`,{"cwd":`${outputDirectory}`});
                var {stdout, stderr} = await exec(`cloc --csv --sum-reports --out="${path.join(outputDirectory,"totals-csv")}" ${ls}`,{"cwd":`${outputDirectory}`});
                var {stdout, stderr} = await exec(`cloc --json --sum-reports ${ls}`,{"cwd":`${outputDirectory}`});
                var clocJSON = await JSON.parse("["+stdout.replace(/\n\s*\n/g, ",")+"]");
                var repositories = clocJSON[1];

                for (var i in results){
                    let result = results[i]
                    let repo = repositories[result.repo];
                    if (repo){
                        result.nFiles = repo.nFiles;
                        result.blank = repo.blank;
                        result.comment = repo.comment;
                        result.code = repo.code; 
                    }
                }
            }
            await fs.writeFile(
                path.join(outputDirectory,resultFile),
                parse(results),
                (err) => err ? console.error('CSV not written!' , err) : console.log(`CSV written!`)
            );
            resolve(results);
        })
    }
    

    async function getStatsForRepo(repo, TOP_DIRECTORY,outputDirectory,dateStr,getCLOC,getVSTSStats,getTests,statsOpts){
        if(repo == ".DS_Store"){
            return;
        }
        return new Promise( async resolve => {
            var repoResult = {
                repo: repo,
            }
            
            var filename = path.join(outputDirectory,repo);
            await git.cwd(path.join(TOP_DIRECTORY,repo));
            //console.log(gitConfigFile);
            if(statsOpts.pull){
                await git.pull();
            }
            var branchName;
            await git.status(function(err,status){
                branchName = status.current;
            });
            let hash = await getHash(TOP_DIRECTORY,repo,dateStr)
            let grep_tests = 0;
            let clocResults;
            if(getCLOC)
            {
                clocResults= await clocRepo(filename,path.join(TOP_DIRECTORY,repo),hash,statsOpts);
            }
            if(getVSTSStats){
                var vstsStats = await getVSTSStatsForRepo(TOP_DIRECTORY,repo,hash,branchName)
            }
                
            if(getTests){
                if(hash != ""){
                    await git.checkout(`${hash}`);
                    var testCommand = `grep -Eo -r -i "\\s*\\[(Fact|TestMethod|Theory).*" ${path.join(TOP_DIRECTORY,repo,"*")} | wc -l`
                    var { stdout, stderr } = await exec(testCommand);
                    //console.log(stdout);
                    grep_tests = await parseInt(stdout,10)
                    //console.log(grep_tests);
                    await git.checkout(branchName);
                }
            }
            
            if(vstsStats  ==  undefined){
                //console.log(`${repo} : weird tests`)
            }

            if(getVSTSStats){
                repoResult.tests_passing =  vstsStats.tests.passing;
                repoResult.tests_failing =  vstsStats.tests.failing;
                repoResult.branches_total =  vstsStats.coverage.branches_total;
                repoResult.branches_covered =  vstsStats.coverage.branches_covered;
                repoResult.lines_total = vstsStats.coverage.lines_total;
                repoResult.lines_covered = vstsStats.coverage.lines_covered;
                repoResult.build =  vstsStats.buildInfo.url;
            }
            if(getCLOC){
                repoResult.nFiles  =  0;
                repoResult.blank = 0;
                repoResult.comment = 0;
                repoResult.code = 0;
            }
            if(getTests){
                repoResult.grep_tests = grep_tests;
            }
                

            resolve(repoResult);
        });
    }

    async function getVSTSStatsForRepo(TOP_DIRECTORY,repo,hash,branchName){
        let coverage = {
            branches_total : "",
            branches_covered : "",
            lines_total : "",
            lines_covered : ""
        };
        let tests = {passing:0,failing:0};
        if(hash != ""){
            return new Promise( async resolve => {
                
                let gitConfigFile = path.join(TOP_DIRECTORY,repo,".git","config");
                //console.log(gitConfigFile);
                let remote = await getRemoteFromFile(gitConfigFile);
                let info = await getRepoInfoFromRemoteUrl(remote);
                let project = info.project;
                let buildInfo = await buildModule.getLatestBuildSource(info,hash, branchName)
                //var buildInfo = await getLatestBuildForRepo(info, addDays(endDate,-7));
                let build = buildInfo.id;
                if(build) {
                    tests = await getTestsForBuild(build, project, buildInfo.uri);
                    coverage = await getCoverageForBuild(build, project);
                }
                resolve ({tests:tests,coverage:coverage,buildInfo:buildInfo});
            });
        } else {
            return {tests:tests,coverage:coverage,buildInfo:{url:"no build"}}
        }
    }

    async function clocRepo(filename,dirPath,hash,statsOpts){
        if(hash != ""){
            return new Promise( async resolve => {
                //var cloc_command_args = `cloc --out="${filename}"  --include-lang="C#,Razor,ASP,ASP.NET,HTML,CSS,LESS,PowerShell,JavaScript,TypeScript" ${path.join(TOP_DIRECTORY,repo)}`

                let cloc_command_args = `cloc --out="${filename}"  --include-lang="C#,Razor,ASP,ASP.NET,HTML,CSS,LESS,PowerShell,JavaScript,TypeScript" ${hash}`
                if (statsOpts.android){
                    
                    //cloc_command_args = `cloc --out="${filename}"  --include-lang="Kotlin,Java,XML,Gradle" ${hash}`
                    cloc_command_args = `cloc --out="${filename}"  ${hash}`
                }
                if (statsOpts.langFilters)
                {
                    cloc_command_args = `cloc --out="${filename}" --include-lang="${statsOpts.langFilters.join(",")}" ${hash}`
                }
                var { stdout, stderr } = await exec(cloc_command_args,{"cwd":`${dirPath}`});
                resolve (stdout);
            });
        }
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

    async function getHash(TOP_DIRECTORY,repo,dateStr){
        const logOpts = {"--max-count":"1", "--before":`"${dateStr}"`}
        return new Promise( async resolve => {
            await git.cwd(path.join(TOP_DIRECTORY,repo)).log(logOpts, function(err, logs){
                let hash ="";
                //"21ecc43d801828678e97396239df25050fc9902e"   data2.latest.hash
                //console.log(logs.latest.hash);
                if(logs.latest){
                    hash = logs.latest.hash;
                }

                resolve(hash);
            })
        })
    }

    async function getRepoInfoFromRemoteUrl(remoteUrl){
        var val = await tfsUtils.getRepos();
        var repo = val.find(y=>y.remoteUrl == remoteUrl);
        var id = repo.id;
        var project = repo.project.id;
        return {id:id,project:project};
    }


    function isValidBuild(build){
        var isGated = build.definition.name.toLowerCase().includes("gated");
        var isSonar = build.definition.name.toLowerCase().includes("sonar");
        var isGood = build.result.toLowerCase().includes("succeeded");
        return isGated || isSonar;
    }

    //https://mindbody.visualstudio.com/19477e8d-94b2-4461-9dfc-2f54fa23767d/_apis/test/CodeCoverage?buildId=331398&api-version=5.0-preview.1

    async function getCoverageForBuild(buildId, project){
        const queryParameters = {
            "buildId" : buildId
        }
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
        var path = `/${project}${tfsOpts.TEST_API_PATH}&${querystring.stringify(queryParameters)}`
        var testRunResponse = await tfsUtils.ADORequest(path)
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
        calcStats:calcStats,
        getBuildDefs:getBuildDefs
    }
}
module.exports = statsModule;