//#region node modules
const fs = require("fs");
const git = require("simple-git");
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const path = require("path");
const rimraf = require("rimraf");
const asyncPool = require("tiny-async-pool");

// Configure axios with retry logic
const axiosInstance = axios.create();
axiosRetry(axiosInstance, {
    retries: 10,
    retryDelay: axiosRetry.exponentialDelay,
    shouldResetTimeout: true
});

const initializerModule = function(tfsOpts) {
    //#endregion node modules
    const tfsUtils = require('./ADOUtilities')(tfsOpts);

    async function initialize(opts) {
        //for each property in opts
        // if property contains/starts with ~
        // expand it and replace
        for (var propName in opts) {
            let prop = opts[propName] + "";
            if ((prop + "").startsWith("~")){
                let expanded = expandHomeDir(prop);
                opts[propName] = expanded;
            }
        }
        
        const repoList = opts.repo_list;
        try {
            await fs.mkdir(opts.TOP_DIRECTORY, function(err){
                console.log(err);
            });    

            let pattern = /([rR]elease|[Ee]nvironment)/;
            var ADORepos =  await tfsUtils.getRepos();
            var filtered = ADORepos.filter(
                x=>repoList.some(
                    y=> x.name == y && !x.remoteUrl.match(pattern)
                )
            );
            const gitInstance = git();
            gitInstance.cwd(`${opts.TOP_DIRECTORY}/`);
            let removals = await asyncPool(1,filtered,repo=>{

                return rmAndClone(path.join(opts.TOP_DIRECTORY,repo.name),repo.remoteUrl, gitInstance);
            });
            
        }
        catch (err){
            console.log(err);
        }
        return true;
    };

    return {initialize:initialize};
};


async function rmAndClone(dirPath, remote, gitInstance)
{
    return new Promise(async (resolve,reject)=> {
        await rimraf(dirPath,async function(err){
            if (!gitInstance) {
                gitInstance = git();
            }
            resolve(await gitInstance.clone(remote) );
        });
    });
}

async function analyticsRequest(path)
    {
        const url = `${tfsOpts.ANALYTICS_HOST}${path}`;
        var headerhost = new URL(tfsOpts.ANALYTICS_HOST).host;
        const headers = buildHeaders(tfsOpts.PAT, headerhost);
        const https = require('https');

        try {
            const response = await axiosInstance.get(url, {
                headers: headers,
                httpsAgent: new https.Agent({
                    rejectUnauthorized: tfsOpts.rejectUnauthorized !== undefined ? tfsOpts.rejectUnauthorized : true
                })
            });
            return response.data;
        } catch (error) {
            const errorMsg = error.response ? error.response.data : error.message;
            throw new Error(`${path}  ${errorMsg}`);
        }
    }


module.exports = initializerModule;