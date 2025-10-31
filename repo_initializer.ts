import * as fs from 'fs';
import simpleGit, { SimpleGit } from 'simple-git';
import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import * as path from 'path';
import { rimraf } from 'rimraf';
import asyncPool from 'tiny-async-pool';
import tfsUtilsModule, { TfsOptions } from './ADOUtilities';
import { InitializeOptions, Repository } from './shared-types';

// Configure axios with retry logic
const axiosInstance: AxiosInstance = axios.create();
axiosRetry(axiosInstance, {
    retries: 10,
    retryDelay: axiosRetry.exponentialDelay,
    shouldResetTimeout: true
});

const initializerModule = function(tfsOpts: TfsOptions) {
    const tfsUtils = tfsUtilsModule(tfsOpts);

    async function initialize(opts: InitializeOptions): Promise<boolean> {
        // For each property in opts
        // if property contains/starts with ~
        // expand it and replace
        for (const propName in opts) {
            const prop = opts[propName] + "";
            if ((prop + "").startsWith("~")) {
                const expandHomeDir = require('expand-home-dir');
                const expanded = expandHomeDir(prop);
                opts[propName] = expanded;
            }
        }

        const repoList = opts.repo_list;
        try {
            await fs.promises.mkdir(opts.TOP_DIRECTORY).catch((err) => {
                console.log(err);
            });

            const pattern = /([rR]elease|[Ee]nvironment)/;
            const ADORepos: Repository[] = await tfsUtils.getRepos();
            const filtered = ADORepos.filter(
                x => repoList.some(
                    y => x.name === y && !x.remoteUrl.match(pattern)
                )
            );
            const gitInstance = simpleGit();
            gitInstance.cwd(`${opts.TOP_DIRECTORY}/`);
            const removals = await asyncPool(1, filtered, repo => {
                return rmAndClone(path.join(opts.TOP_DIRECTORY, repo.name), repo.remoteUrl, gitInstance);
            });
        } catch (err) {
            console.log(err);
        }
        return true;
    }

    return { initialize: initialize };
};

async function rmAndClone(dirPath: string, remote: string, gitInstance: SimpleGit): Promise<any> {
    return new Promise(async (resolve, reject) => {
        await rimraf(dirPath);
        if (!gitInstance) {
            gitInstance = simpleGit();
        }
        resolve(await gitInstance.clone(remote));
    });
}

async function analyticsRequest(path: string, tfsOpts: TfsOptions, buildHeaders: Function): Promise<any> {
    const url = `${tfsOpts.ANALYTICS_HOST}${path}`;
    const headerhost = new URL(tfsOpts.ANALYTICS_HOST).host;
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
    } catch (error: any) {
        const errorMsg = error.response ? error.response.data : error.message;
        throw new Error(`${path}  ${errorMsg}`);
    }
}

export default initializerModule;
