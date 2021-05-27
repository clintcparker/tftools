"use strict";
const tfsUtilsModule = function(tfsOpts) {
    const request = require('retry-request', {
        request: require('request')
    });
    //#endregion node modules
    const https = require('https');
    const querystring = require('querystring');

    const REPO_API_PATH = "/_apis/git/repositories?api-version=5.0";
    const BUILD_API_PATH = "/_apis/build/builds?api-version=5.0";
    const DEFINITIONS_API_PATH = "/_apis/build/definitions?api-version=5.0";
    const COVERAGE_API_PATH = "/_apis/test/CodeCoverage?api-version=5.0-preview.1";
    const TEST_API_PATH = "/_apis/test/runs?api-version=5.0";
    const ITERATIONS_PATH = "/_odata/v3.0-preview/Iterations";
    const TEAMS_PATH = "/_odata/v3.0-preview/Teams";
    const PROCESSES_PATH = "/_odata/v3.0-preview/Processes";
    const WORKITEMS_PATH = "/_odata/v3.0-preview/WorkItems";
    const WORKITEM_SNAPSHOT_PATH = "/_odata/v3.0-preview/WorkItemSnapshot";

    var lastBackOff =0;
    var backOffs = {};
    function buildHeaders(PAT,host){
        var h = host.replace(/http(s)*:(\/)+/,"");
        return {
            'Authorization': 'Basic ' + Buffer.from("" + ':' + PAT).toString('base64'),
            'Accept' : "application/json,text/html",
            'Host': `${h}`,
            'Upgrade-Insecure-Requests': '1'
        };   
    }

    function retryFunction(incomingHttpMessage){
        var bad = incomingHttpMessage.statusMessage !== 'OK';
        var backOff = 0;
        var lastBackOff = backOffs[incomingHttpMessage.host] ? backOffs[incomingHttpMessage.host] : 0;
        if(lastBackOff != 0 || bad){
            backOff = lastBackOff != 0 ? (Date.now() - lastBackOff)/1000 : 0;
            console.log(`${incomingHttpMessage.statusCode}   +${backOff}s`);
        }
        if(bad) {
            lastBackOff = Date.now();
            //console.log(incomingHttpMessage);
        }else{
            lastBackOff = 0;
        }
        backOffs[incomingHttpMessage.host] = lastBackOff;
        return bad;
    }

    async function ADORequest(path)
    {
        const options = {
            host: tfsOpts.ADO_HOST,
            port: 443,
            path: path,
            rejectUnauthorized:false, 

        };
        var headerhost = new URL(options.host).host;
        options.headers=await buildHeaders(tfsOpts.PAT,headerhost/*options.host*/);
        options.url = `${options.host}${options.path}`;

        return new Promise( async(resolve,reject) => {
            var opts = {
                shouldRetryFn: retryFunction,
                retries: 10
            };
            //request(options,opts,requestCallback(resolve,reject))
            request(options,opts,function(error, response, body){
                if(error){
                    reject(`${path}  ${error}`);
                    return;
                }
                if(response.statusCode>=400)
                {
                    reject(`${path}  ${body}`);
                    return;
                }
                var data = JSON.parse(body);
                resolve(data);
            });
        });
    }

    function requestCallback(resolve,reject){
        function requestCallbackInner(error, response, body){
            if(error){
                reject(`${path}  ${error}`);
                return;
            }
            if(response.statusCode>=400)
            {
                reject(`${path}  ${body}`);
                return;
            }
            var data = JSON.parse(body);
            resolve(data);
        };
        return requestCallbackInner;
    }

    var analyticsLastBackOff =0;

    async function analyticsRequest(path)
    {
        const options = {
            host: tfsOpts.ANALYTICS_HOST,
            port: 443,
            path: path,
            rejectUnauthorized:false,
        };
        var headerhost = new URL(options.host).host;
        options.headers=buildHeaders(tfsOpts.PAT,headerhost);
        options.url = `${options.host}${options.path}`;

        return new Promise( async(resolve,reject) => {
            var opts = {
                shouldRetryFn: retryFunction,
                retries: 10
            };
            //request(options,opts,requestCallback(resolve,reject))
            request(options,opts,function(error, response, body){
                if(error){
                    reject(`${path}  ${error}`);
                    return;
                }
                if(response.statusCode>=400)
                {
                    reject(`${path}  ${body}`);
                    return;
                }
                var data = JSON.parse(body);
                resolve(data);
            });
        });
    }

    async function getRepos(){
        var rawRepos = await ADORequest(REPO_API_PATH);
        return rawRepos.value;
    }

    function buildDateStringForADO(dateStr,plusDays){
        var date = addDays(new Date(dateStr),plusDays);
        const enUS = "en-US";
        var MM =  `${date.getUTCMonth()+1}`.padStart(2,0);
        var DD = `${date.getUTCDate()}`.padStart(2,0);
        var YYYY = date.getUTCFullYear();
        return `${YYYY}${MM}${DD}`;
    }

    function buildDateStringForAnalytics(dateStr,plusDays){
        let timePart = dateStr.replace(/\d{4}-\d{2}-\d{2}T/,"T");
        let dateIn = new Date(dateStr);
        var date = addDays(dateIn,plusDays);
        let ISOString = date.toISOString();
        let stringForAnalytics = ISOString.replace(/T.*$/,"");
        return `${stringForAnalytics}${timePart}`;
    }


    async function queueBuild(projectId, repoId, hash){

        var queryParameters = {
            // "$top" : "15",
            // //"resultFilter" : "succeeded",
            // //"resultFilter" : "partiallySucceeded",
            // "repositoryId" : repo.id,
            // "queryOrder":"finishTimeDescending",
            // "repositoryType" : "tfsgit",
            // //"reasonFilter":"pullRequest",
            // "minTime" : buildDateString(endDate)
        };
        var proj = "0fa9dfee-f92d-4a1b-9d77-071a4f54265a";
        var path= `/${proj}${tfsOpts.BUILD_API_PATH}&${querystring.stringify(queryParameters)}`;
        //for merchant data importer
        var body = JSON.stringify({
            definition:{
                id:1468,
            },
            repository:{id:'65fa7b83-5c9b-4fb9-9046-4aae31e67882'},
            sourceVersion:"5977f3f5b897bd8069b0c9af1372fe064104b3f5"
        });
        // const options = {
        //     hostname: 'www.google.com',
        //     port: 80,
        //     path: '/upload',
        //     method: 'POST',
        //     headers: {
        //       'Content-Type': 'application/json',
        //       'Content-Length': Buffer.byteLength(body)
        //     }
        //   };

        var options = {
            host: tfsOpts.ADO_HOST,
            port: 443,
            path: path,
            rejectUnauthorized:false,
            method: 'POST',
        };
        options.headers=buildHeaders(tfsOpts.PAT,options.host);
        options.headers["Content-Type"]='application/json';
        options.headers["Content-Length"]=Buffer.byteLength(body);
        options.url = `${options.host}${options.path}`;
        return new Promise ((resolve,reject)=>{
            var req = https.request(options,(res)=>{
                res.on("end",function(){
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
        });
    }


    function addDays(date, days) {
        var result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }
    


    return {
        ADORequest:ADORequest,
        analyticsRequest:analyticsRequest,
        buildDateStringForADO:buildDateStringForADO,
        buildDateStringForAnalytics:buildDateStringForAnalytics,
        getRepos:getRepos,
        queueBuild:queueBuild,
        buildHeaders: buildHeaders,
        addDays:addDays
    };
};



module.exports = tfsUtilsModule;