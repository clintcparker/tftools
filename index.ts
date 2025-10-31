import expandHomeDir from 'expand-home-dir';
import statsModuleFactory from './codestats';
import initializerModuleFactory from './repo_initializer';
import velocitiesModuleFactory from './velocities';
import utilsModuleFactory from './ADOUtilities';
import buildModuleFactory from './buildModule';
import { TfsOptions } from './ADOUtilities';
import { BuildOptions, InitializeOptions, StatsOptions, VelocityOptions } from './shared-types';

export { BuildOptions, InitializeOptions, StatsOptions, VelocityOptions, TfsOptions };

interface Options extends Partial<TfsOptions> {
    ADO_HOST?: string;
    PAT?: string;
    ANALYTICS_HOST?: string;
}

interface DefaultLangs {
    dotnet: string[];
    android: string[];
    ios: string[];
}

export default function(opts?: Options) {
    const tfsOpts: TfsOptions & { [key: string]: any } = {
        ADO_HOST: '',
        ANALYTICS_HOST: '',
        PAT: '',
        REPO_API_PATH: "/_apis/git/repositories?api-version=5.0",
        BUILD_API_PATH: "/_apis/build/builds?api-version=5.0",
        DEFINITIONS_API_PATH: "/_apis/build/definitions?api-version=5.0",
        COVERAGE_API_PATH: "/_apis/test/CodeCoverage?api-version=5.0-preview.1",
        TEST_API_PATH: "/_apis/test/runs?api-version=5.0",
    };

    if (opts) {
        Object.assign(tfsOpts, opts);
    }

    if (tfsOpts.ADO_HOST === undefined || tfsOpts.ADO_HOST === '') {
        const ADO_HOST_MESSAGE = `The ADO_HOST property is required!
        Ex: https://dev.azure.com/[your-organization]
        Ex: https://[your-subdomain].visualstudio.com


        ref: https://docs.microsoft.com/en-us/rest/api/azure/devops/
        `;
        console.error(ADO_HOST_MESSAGE);
        return;
    }

    if (tfsOpts.PAT === undefined || tfsOpts.PAT === '') {
        const PAT_MESSAGE = `The PAT property is required!
        Ex: [Your Personal Access Token here]

        ref: https://docs.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/pats
        `;
        console.error(PAT_MESSAGE);
        return;
    }

    if (tfsOpts.ANALYTICS_HOST === undefined || tfsOpts.ANALYTICS_HOST === '') {
        const ANALYTICS_URL = new URL(tfsOpts.ADO_HOST);
        ANALYTICS_URL.host = "analytics." + ANALYTICS_URL.host;
        tfsOpts.ANALYTICS_HOST = ANALYTICS_URL.href;
    }

    // For each property in opts
    // if property contains/starts with ~
    // expand it and replace
    for (const propName in tfsOpts) {
        const prop = tfsOpts[propName] + "";
        if ((prop + "").startsWith("~")) {
            const expanded = expandHomeDir(prop);
            tfsOpts[propName] = expanded;
        }
    }

    const statsModule = statsModuleFactory(tfsOpts);
    const initializerModule = initializerModuleFactory(tfsOpts);
    const velocitiesModule = velocitiesModuleFactory(tfsOpts);
    const utilsModule = utilsModuleFactory(tfsOpts);
    const buildModule = buildModuleFactory(tfsOpts);

    const defaultLangs: DefaultLangs = {
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
}

// For CommonJS compatibility
module.exports = function(opts?: Options) {
    return exports.default(opts);
};
module.exports.default = exports.default;
