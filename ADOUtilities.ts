import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import * as https from 'https';
import * as querystring from 'querystring';
import { IncomingMessage } from 'http';
import { Repository } from './shared-types';

export interface TfsOptions {
    ADO_HOST: string;
    ANALYTICS_HOST: string;
    PAT: string;
    BUILD_API_PATH?: string;
    rejectUnauthorized?: boolean;
}

interface Headers {
    'Authorization': string;
    'Accept': string;
    'Host': string;
    'Upgrade-Insecure-Requests': string;
    'Content-Type'?: string;
    'Content-Length'?: number;
}

interface BuildDefinition {
    id: string | number;
}

interface BuildRepository {
    id: string | number;
}

interface BuildQueueBody {
    definition: BuildDefinition;
    repository: BuildRepository;
    sourceVersion: string;
}

interface ReposResponse {
    value: Repository[];
}

const tfsUtilsModule = function(tfsOpts: TfsOptions) {
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

    // Configure axios with retry logic
    const axiosInstance: AxiosInstance = axios.create();
    axiosRetry(axiosInstance, {
        retries: 10,
        retryDelay: axiosRetry.exponentialDelay,
        shouldResetTimeout: true
    });

    let lastBackOff = 0;
    const backOffs: { [host: string]: number } = {};

    function buildHeaders(PAT: string, host: string): Headers {
        const h = host.replace(/http(s)*:(\/)+/, "");
        return {
            'Authorization': 'Basic ' + Buffer.from("" + ':' + PAT).toString('base64'),
            'Accept': "application/json,text/html",
            'Host': `${h}`,
            'Upgrade-Insecure-Requests': '1'
        };
    }

    function retryFunction(incomingHttpMessage: IncomingMessage & { host?: string }): boolean {
        const bad = incomingHttpMessage.statusMessage !== 'OK';
        let backOff = 0;
        const host = incomingHttpMessage.host || '';
        let lastBackOffValue = backOffs[host] ? backOffs[host] : 0;

        if (lastBackOffValue !== 0 || bad) {
            backOff = lastBackOffValue !== 0 ? (Date.now() - lastBackOffValue) / 1000 : 0;
            console.log(`${incomingHttpMessage.statusCode}   +${backOff}s`);
        }

        if (bad) {
            lastBackOffValue = Date.now();
        } else {
            lastBackOffValue = 0;
        }

        backOffs[host] = lastBackOffValue;
        return bad;
    }

    async function ADORequest(path: string): Promise<any> {
        const url = `${tfsOpts.ADO_HOST}${path}`;
        const headerhost = new URL(tfsOpts.ADO_HOST).host;
        const headers = buildHeaders(tfsOpts.PAT, headerhost);

        try {
            const response = await axiosInstance.get(url, {
                headers: headers as any,
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

    function requestCallback(resolve: (value: any) => void, reject: (reason?: any) => void, path: string) {
        function requestCallbackInner(error: any, response: any, body: string) {
            if (error) {
                reject(`${path}  ${error}`);
                return;
            }
            if (response.statusCode >= 400) {
                reject(`${path}  ${body}`);
                return;
            }
            const data = JSON.parse(body);
            resolve(data);
        }
        return requestCallbackInner;
    }

    let analyticsLastBackOff = 0;

    async function analyticsRequest(path: string): Promise<any> {
        const url = `${tfsOpts.ANALYTICS_HOST}${path}`;
        const headerhost = new URL(tfsOpts.ANALYTICS_HOST).host;
        const headers = buildHeaders(tfsOpts.PAT, headerhost);

        try {
            const response = await axiosInstance.get(url, {
                headers: headers as any,
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

    async function getRepos(): Promise<Repository[]> {
        const rawRepos: ReposResponse = await ADORequest(REPO_API_PATH);
        return rawRepos.value;
    }

    function buildDateStringForADO(dateStr: string, plusDays: number): string {
        const date = addDays(new Date(dateStr), plusDays);
        const MM = `${date.getUTCMonth() + 1}`.padStart(2, '0');
        const DD = `${date.getUTCDate()}`.padStart(2, '0');
        const YYYY = date.getUTCFullYear();
        return `${YYYY}${MM}${DD}`;
    }

    function buildDateStringForAnalytics(dateStr: string, plusDays: number): string {
        const timePart = dateStr.replace(/\d{4}-\d{2}-\d{2}T/, "T");
        const dateIn = new Date(dateStr);
        const date = addDays(dateIn, plusDays);
        const ISOString = date.toISOString();
        const stringForAnalytics = ISOString.replace(/T.*$/, "");
        return `${stringForAnalytics}${timePart}`;
    }

    async function queueBuild(projectId: string, repoId: string | number, hash: string): Promise<IncomingMessage> {
        const queryParameters: { [key: string]: string } = {
            // "$top" : "15",
            // //"resultFilter" : "succeeded",
            // //"resultFilter" : "partiallySucceeded",
            // "repositoryId" : repo.id,
            // "queryOrder":"finishTimeDescending",
            // "repositoryType" : "tfsgit",
            // //"reasonFilter":"pullRequest",
            // "minTime" : buildDateString(endDate)
        };

        // NOTE: This function contains example hardcoded values and should be updated with actual project parameters
        const proj = projectId; // Use passed parameter instead of hardcoded value
        const path = `/${proj}${tfsOpts.BUILD_API_PATH}&${querystring.stringify(queryParameters)}`;
        const body = JSON.stringify({
            definition: {
                id: repoId, // Use passed parameter
            },
            repository: { id: repoId },
            sourceVersion: hash // Use passed parameter
        });

        const options: https.RequestOptions = {
            host: tfsOpts.ADO_HOST,
            port: 443,
            path: path,
            rejectUnauthorized: tfsOpts.rejectUnauthorized !== undefined ? tfsOpts.rejectUnauthorized : true,
            method: 'POST',
        };

        const headers = buildHeaders(tfsOpts.PAT, options.host as string);
        headers["Content-Type"] = 'application/json';
        headers["Content-Length"] = Buffer.byteLength(body);
        options.headers = headers as any;

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                res.on("end", function() {
                    console.log('ended');
                    resolve(res);
                });
                res.on('data', function(chunk) {
                    console.log('Response: ' + chunk);
                });
            });
            req.write(body);
            req.end();
        });
    }

    function addDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    return {
        ADORequest: ADORequest,
        analyticsRequest: analyticsRequest,
        buildDateStringForADO: buildDateStringForADO,
        buildDateStringForAnalytics: buildDateStringForAnalytics,
        getRepos: getRepos,
        queueBuild: queueBuild,
        buildHeaders: buildHeaders,
        addDays: addDays
    };
};

export default tfsUtilsModule;
