"use strict";
const tfsUtilsModule = function(tfsOpts) {
    const request = require('retry-request', {
        request: require('request')
    });
    //#endregion node modules
    const https = require('https');
    const querystring = require('querystring')

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
        var h = host.replace(/http(s)*:(\/)+/,"")
        return {
            'Authorization': 'Basic ' + Buffer.from("" + ':' + PAT).toString('base64'),
            'Accept' : "application/json,text/html",
            'Host': `${h}`,
            'Upgrade-Insecure-Requests': '1'
        }   
    }

    function retryFunction(incomingHttpMessage){
        var bad = incomingHttpMessage.statusMessage !== 'OK'
        var backOff = 0;
        var lastBackOff = backOffs[incomingHttpMessage.host] ? backOffs[incomingHttpMessage.host] : 0
        if(lastBackOff != 0 || bad){
            backOff = lastBackOff != 0 ? (Date.now() - lastBackOff)/1000 : 0;
            console.log(`${incomingHttpMessage.statusCode}   +${backOff}s`);
        }
        if(bad) {
            lastBackOff = Date.now();
            console.log(incomingHttpMessage);
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
        options.headers=await buildHeaders(tfsOpts.PAT,options.host);
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
                    return
                }
                if(response.statusCode>=400)
                {
                    reject(`${path}  ${body}`);
                    return
                }
                var data = JSON.parse(body)
                resolve(data);
            })
        });
    }

    function requestCallback(resolve,reject){
        function requestCallbackInner(error, response, body){
            if(error){
                reject(`${path}  ${error}`);
                return
            }
            if(response.statusCode>=400)
            {
                reject(`${path}  ${body}`);
                return
            }
            var data = JSON.parse(body)
            resolve(data);
        };
        return requestCallbackInner
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
        options.headers=buildHeaders(tfsOpts.PAT,options.host);
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
                    return
                }
                if(response.statusCode>=400)
                {
                    reject(`${path}  ${body}`);
                    return
                }
                var data = JSON.parse(body)
                resolve(data);
            })
        });
    }

    async function getRepos(){
        var rawRepos = await ADORequest(REPO_API_PATH);
        return rawRepos.value;
    }

    function buildDateStringForADO(dateStr,plusDays){
        var date = addDays(new Date(dateStr),plusDays);
        const enUS = "en-US";
        var MM = date.toLocaleDateString(enUS, {month:'2-digit'});
        var DD = date.toLocaleDateString(enUS, {day:'2-digit'});
        var YYYY = date.toLocaleDateString(enUS, {year:'numeric'});
        return `${YYYY}${MM}${DD}`;
    }

    async function queueBuild(projectId, repoId, hash){

//example vaild request: {"queue":{"id":754},"definition":{"id":1468},"project":{"id":"0fa9dfee-f92d-4a1b-9d77-071a4f54265a"},"sourceBranch":"refs/heads/master","sourceVersion":"","reason":1,"demands":[],"parameters":"{\"system.debug\":\"false\",\"BuildConfiguration\":\"release\",\"BuildPlatform\":\"any cpu\"}"}

// Host: mindbody.visualstudio.com
// User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:67.0) Gecko/20100101 Firefox/67.0
// Accept: application/json;api-version=5.0-preview.4;excludeUrls=true
// Accept-Language: en-US,en;q=0.5
// Accept-Encoding: gzip, deflate, br
// Referer: https://mindbody.visualstudio.com/mb/_build?definitionId=1468&view=buildsHistory
// Content-Type: application/json
// X-VSS-ReauthenticationAction: Suppress
// X-TFS-Session: 42682943-d22e-4ad0-a55f-17b04b11e7de
// X-Requested-With: XMLHttpRequest
// Content-Length: 288
// Connection: keep-alive
// Cookie: VstsSession=%7B%22PersistentSessionId%22%3A%22c29bc734-2565-4770-966b-89ecaf3014b3%22%2C%22PendingAuthenticationSessionId%22%3A%2200000000-0000-0000-0000-000000000000%22%2C%22CurrentAuthenticationSessionId%22%3A%22c2164041-e62b-492d-9794-890ef18fee40%22%7D; FedAuth=77u/PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48U2VjdXJpdHlDb250ZXh0VG9rZW4gcDE6SWQ9Il8zMTVmMTRjMS1lODAxLTQzOTMtYWU3Ny00N2NiOTZhNGE5NmQtRkJCRTAyQTc5NzlEMDM3MDkzMDY4MUY4NTNCODBEOEQiIHhtbG5zOnAxPSJodHRwOi8vZG9jcy5vYXNpcy1vcGVuLm9yZy93c3MvMjAwNC8wMS9vYXNpcy0yMDA0MDEtd3NzLXdzc2VjdXJpdHktdXRpbGl0eS0xLjAueHNkIiB4bWxucz0iaHR0cDovL2RvY3Mub2FzaXMtb3Blbi5vcmcvd3Mtc3gvd3Mtc2VjdXJlY29udmVyc2F0aW9uLzIwMDUxMiI+PElkZW50aWZpZXI+dXJuOnV1aWQ6MDk3ODYyZGMtNDkyZS00ZGU3LWFjMjItZjFhZTIxNTkxMTQyPC9JZGVudGlmaWVyPjxDb29raWUgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwNi8wNS9zZWN1cml0eSI+MFlkQ1daWk9tSTRBQVFBQU5rL1dyYnIzWkRCZy9WZm1uZVJVWjVtcDlYdTh6b1R4eW40MUtvN3dWZ1c1YzEvNWlTdk43YkJtdWdNSnhpZFFTeTl6YmM1bkYvdXZaRStLY2NDQWxNMWgwR2hpUkprRnllVVlzWE8wVWRaMkUyUndxNUVmZDc3ajFtWlRLUEVRdEFZVjFiMVpPUVFhQ2F5YkIrRkJpdHZIdngvd0hrQ1QwdlcvY1FyV2ljVHdaOXk2RndkeGVHa1pZWUxtNTJQTkF5OW9kdzdEUVRVOTUxbzFSL2g3RlN2Z05qeGpJOGdDNElaTk5IK292MWwrRitBSUlya0ZyS2xqa2lUTmhrVmpxV0t4TnBHVkJqZkZyTHJCZDBuYkxxVlVhQllQQ2Y1SVo1ekJjWDJ1eU51NFlxNDR1VWsvYS9rZnhkL2kycXJjclFVMUUzeUQwL0RYeHpPeSsrUHV2Q2N1Q1MwTjZVRzhyU3pIeXc5Q1NFU21tcWV2ejI4QUM0ajV1dHJhLzdwREFBRUFBQ0tVa0g0a3dicGIveU5pVTVCRlcvUTFhbzVXVXFyR3NEeGdKUk5ZbC9pRFd0SWs0ekRaVkttZENERHczdFpsN1gzY2tjUmZCRTRFOElwM29rSCt0SmFudkphZklRR3ZPTmhjcDdoVUlWTjRtQmtUL1JmRVBsUGszR00vaEVwenBmbFhBTmNRZXhUNUU3bXdWWFFhTytITGpLZFhEMzA2U0RGbnkyWHp1QmNIcmw2NkJ3WU44UldVUXdlUWp5ZWYwYVp5aGQwS244SjZDQzQvMWR4cFlZRW11VDJQNk9sc3lGcFAzRWRlbGRjVWlTS2xyUitXNHJOd2RxTEhETzRKaVRMbkNZQUkyMTBPdnZjRG9MWGdrNDNvY01FOFgvVmd3SjF2MGF4by9lYWl6NXVvTWVNRmZXZVZBdTFrWVVTQVRzZEtGc2xVcFpQSXpxYk56eDZmajcxZ0JBQUFzand1MDNWU1B4ai9SdVFTRC9MMm5OdzNDQUhrdWF2N3JSOUY1WTQwMDlJWFhmWDFCMjRRS3hWN0lwM0tqM2ZQcVpteFAvVTZSVGtyRzREQmJGWE5GZmNTeFpiS3ozMmtPdnllNDdiekhQVkFrbG5YTFFTeTlQWWFhOXg5enNwQ1h2bjRiYUMwaHZXQTNWT3pxVmh3dUhhNGVwbXNJc2I2ZEJBMmJIdnhmcUxLYTQ3bDFZeFZnWjdxYkdtNXkwREYyS0Y1bnFtSXVMcGhpZzFwLzVmaVV6a0ZaanJ1blZGRXR0NU43UnlHaTlRaHQ2N0x6Y1FBYjc1N2Z6aFNBNEJLbTFha3I2eVZjVTB1OG9LSXhITFRMeWtsc1pJbzUwNEk0a1ZmaHVNRUUxMzNqUE0vbUUr; FedAuth1=UWVIaU5GSnVGcDBPZGliZVpQaTlyM1E4NmNLcjhCZWF3MG85aG5CbjZEYjZYTGtrZ2o2UGhRTFExQTNGRkw2K3ovNnJhbzhVRFpmVGI5RjVuRDV5UmRIWW9Id21uVUVTQXZKQzR5dHdnc3JBWWo2ajBEV2N4cUV1cEFKMVdwL1l3QjM0SWhodE90Vmw1aVN0OGtRcHh1Y3hSS0JPbTZGeVpkQ2UzR0did3VMcDBRbCtadnpwK3Zydk9saldBTjQ4cC9XejV6K2JUSkhGQ3k3akRnK09PSGZCYW4vYnpzZGNPM0pEKzNwUkM0K2IyR2RnOC9SZ2VGN0Z5RTRMUktWcjh5anlRYU4zVGl1Y2pCNFRWSm13eVpFb1NkN0Vpays3S2tyMnhBeEtnMmh2MU5GZ2VOMTZqOUhlUEFwT0hwZkFBemptT24xSmNiQ0dKaGVFZHVsMjVSMmJTbzEvSTB6aE9sdnVLQWlsZU55ZTFtMXgzb0RtQ2tIdlJtVEx5NE13ZGZwNWt6bDc1Y0NJYTMrK1VCMk9ZT3k1bDVJT05JeHVKMVQvMnRaL3czUFRHU1dOQlNiOVBrdVZBN2dPOFBTNytGRHRVZWkxNytlZ1RDRjRGMk52YzVTMjhSYk9NYUltOGhPMHNLUThEYmpJd01GSjMxNDNYRVlXdkljcFA1MmcrdGg3V1dURWdia3JvS1V5VVUwLy9Ud2QySlpkdXNLcHBCYTM1a3JEOVNwSDJSQ3VYdU9GV2hhdnc4YkEwalFqRzNEQVRoN1VtaTVyd3pyenlraG93cE1QaEtCOTR2S2RnY2cwMkhmZCs2K0F2VlZheHVzM1RwdHZZdS9CZUc0cFVObzZ1OGNqaTh2UEJzMkNmUm9kOXg0NEpBU28xbEtMSWd1ZzZqNDN4WWdBZnpZK21oR3hBYVJNZEhoczZxa2sydDgzRnlVcklXc3NxU2NxWTg5cEM3ZE1lUjZ6aUxvTVQreWNwRHNxdGc0RUpDRWdiUGdyOHRzczFUMGxWUTlCQnR0YVhFK3BlNW1FclBBSmtoMWhNa2tPbm82ak5oU3hlbEg3blpOT2VIbTY2ZkdVRThlTHZZeVcwdElZN2dIdHRkd0FyRFBSdzhYcXJUSWZvaXNrUWZxNit0bml2NDNrVkxRbDJERzVPVUhMRXNzZlpGYWN5bnpJTlJQaE9iVHpTTUJ5TmFMejMxQnYvUXRUZWU1STJjd2svRitJZ2hGSzdaOG9WVHVqZWVvS3VqQkVmbE9mSTN5eDFvK3YyR29Kdng5a29SMGU5TERrOW03Y3ZaT0d3K2djMFpaSk5DNW5ucldjbjlqLy9SVXhRcG5HMFVXQ0xMSTdKNmtPZWVkRFZMNWljMDRRN0ZRNm9kWnM2NmlLaDZkQk40bVhUMWpQd3VNRVN6ZmpPY3o2RlY5aUJzcld2eHFRamNZcGhaaTBnNXd0RGhsVm5DZ3NpSE9XL3hqT3pEVTJOMUlVNXBmK3F5VkdJalMwREhOazJZUEZBVXlaTE8wVE8wZTBid2RQNGZlRVlyVXFtcDk3NkRXZFVCMld0TExUVjVqa1RObUtQRXc9PTwvQ29va2llPjwvU2VjdXJpdHlDb250ZXh0VG9rZW4+; _ga=GA1.2.883933582.1552500742; SpsAuthenticatedUser=DisplayName=Clint%20Parker&aad=False; __RequestVerificationToken=it02JE413uemWT_qIIx-NY5folSpsrC-iKkLuMKuY1NjmLKlQC3i3Fhw8nOR92XbIdxVBOo2bj7qy529u8dtO2GB1OY1; __RequestVerificationToken2655814e0-8b9f-47fb-a4a8-1f41304b618e=it02JE413uemWT_qIIx-NY5folSpsrC-iKkLuMKuY1NjmLKlQC3i3Fhw8nOR92XbIdxVBOo2bj7qy529u8dtO2GB1OY1; _gid=GA1.2.492007921.1561572872
// Pragma: no-cache
// Cache-Control: no-cache
// TE: Trailers

//sent agaim:
//{"queue":{"id":754},"definition":{"id":1468},"project":{"id":"0fa9dfee-f92d-4a1b-9d77-071a4f54265a"},"sourceBranch":"refs/heads/master","sourceVersion":"","reason":1,"demands":[],"parameters":"{\"system.debug\":\"false\",\"BuildConfiguration\":\"release\",\"BuildPlatform\":\"any cpu\"}"}

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
        var proj = "0fa9dfee-f92d-4a1b-9d77-071a4f54265a"
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
        options.headers["Content-Type"]='application/json'
        options.headers["Content-Length"]=Buffer.byteLength(body)
        options.url = `${options.host}${options.path}`;
        return new Promise ((resolve,reject)=>{
            var req = https.request(options,(res)=>{
                res.on("end",function(){
                    console.log('ended');
                    resolve(res);
                })
                //res.setEncoding('utf8');
                res.on('data', function (chunk) {
                    console.log('Response: ' + chunk);
                });

            })
            req.write(body);
            req.end();
        })
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
        getRepos:getRepos,
        queueBuild:queueBuild,
        buildHeaders: buildHeaders,
        addDays:addDays
    };
}



module.exports = tfsUtilsModule;