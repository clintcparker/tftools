//#region node modules
const fs = require("fs");
const git = require("simple-git")();
const request = require('retry-request', {
    request: require('request')
});
const path = require("path")
const rimraf = require("rimraf")
const asyncPool = require("tiny-async-pool")

const initializerModule = function(tfsOpts) {
    //#endregion node modules
    const tfsUtils = require('./ADOUtilities')(tfsOpts);

    async function initialize(opts) {
        //for each property in opts
        // if property contains/starts wiht ~
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

            let pattern = /([rR]elease|[Ee]nvironment)/
            var ADORepos =  await tfsUtils.getRepos();
            var filtered = ADORepos.filter(
                x=>repoList.some(
                    y=> x.name == y && !x.remoteUrl.match(pattern)
                )
            )
            git.cwd(`${opts.TOP_DIRECTORY}/`);
            let removals = await asyncPool(1,filtered,repo=>{
                
                return rmAndClone(path.join(opts.TOP_DIRECTORY,repo.name),repo.remoteUrl)
            })
            
        }
        catch (err){
            console.log(err);
        }
        return true;
    };

    return {initialize:initialize};
}


async function rmAndClone(dirPath, remote)
{
    return new Promise(async (resolve,reject)=> {
        await rimraf(dirPath,async function(err){
            resolve(await git.clone(remote) );
        });  
    });
}

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


module.exports = initializerModule;