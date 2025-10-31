import * as pathModule from 'path';
import * as fs from 'fs';
import { parse } from 'json2csv';
import * as querystring from 'querystring';
import asyncPool from 'tiny-async-pool';
import expandHomeDir from 'expand-home-dir';
import tfsUtilsModule, { TfsOptions } from './ADOUtilities';
import { VelocityOptions } from './shared-types';

interface Team {
    TeamName: string;
    TeamId: string;
    ProjectSK: string;
    TeamSK: string;
}

interface Iteration {
    IterationSK: string;
    IterationName: string;
    IterationPath: string;
    StartDate: string;
    EndDate: string;
    IsEnded: boolean;
    late?: number;
    planned?: number;
    incomplete?: number;
    completed?: number;
    teamName?: string;
    total?: number;
}

interface BacklogType {
    BacklogCategoryReferenceName: string;
    WorkItemType: string;
    IsBugType: boolean;
    BacklogName: string;
}

interface WorkItemResult {
    completed: number;
    incomplete: number;
}

interface WorkItemData {
    StateCategory: string;
    IterationSK: string;
    AggregationResult?: number;
}

interface ProcessInfo {
    typeFields: {
        Effort: {
            referenceName: string;
        };
    };
}

const velocitiesModule = function(tfsOpts: TfsOptions) {
    const ITERATIONS_PATH = "/_odata/v3.0-preview/Iterations";
    const TEAMS_PATH = "/_odata/v3.0-preview/Teams";
    const PROCESSES_PATH = "/_odata/v3.0-preview/Processes";
    const WORKITEMS_PATH = "/_odata/v3.0-preview/WorkItems";
    const WORKITEM_SNAPSHOT_PATH = "/_odata/v3.0-preview/WorkItemSnapshot";
    const PROCESS_CONFIG_PATH = "/_apis/work/processconfiguration?api-version=5.0-preview.1";

    let keepGoingTeams: boolean;
    let keepGoingIterations: boolean;
    let lastTeam: string;
    let lastPath: string;

    const FIELDS = [
        {
            label: "Team",
            value: "teamName",
            default: "NULL"
        },
        {
            label: "Iteration Path",
            value: "IterationPath",
            default: 'NULL'
        },
        "StartDate",
        "EndDate",
        {
            label: "Planned",
            value: "planned",
            default: 0
        },
        {
            label: "Completed",
            value: "completed",
            default: 0
        },
        {
            label: "Completed Late",
            value: "late",
            default: 0
        },
        {
            label: "Incomplete",
            value: "incomplete",
            default: 0
        },
        {
            label: "Total",
            value: "total",
            default: 0
        },
    ];

    const tfsUtils = tfsUtilsModule(tfsOpts);

    async function getVelocities(incomingVelocityOpts: VelocityOptions): Promise<any> {
        const velocityOptsDefaults: Partial<VelocityOptions> = {
            include: [],
            exclude: [],
            effortWord: "Effort",
            aggregate: "sum",
            extraPlannedDays: 0,
            lateAfterDays: 0,
            overWrite: false
        };

        const velocityOpts: VelocityOptions = Object.assign({}, velocityOptsDefaults, incomingVelocityOpts);

        for (const propName in velocityOpts) {
            const prop = (velocityOpts as any)[propName] + "";
            if ((prop + "").startsWith("~")) {
                const expanded = expandHomeDir(prop);
                (velocityOpts as any)[propName] = expanded;
            }
        }

        try {
            console.time('Overall');
            let teams: Team[] = await getTeamsForProject(velocityOpts.projectId);
            keepGoingTeams = true;
            keepGoingIterations = true;

            try {
                const a = await fs.promises.readFile(velocityOpts.outFile);
                if (a) {
                    const last = a.toString().split("\n").reverse()[0].split(",");
                    lastTeam = last[0];
                    lastPath = last[1];
                    if (lastTeam === `"NULL"`) {
                        keepGoingTeams = false;
                        keepGoingIterations = false;
                    }
                }
            } catch {
                await fs.promises.writeFile(
                    velocityOpts.outFile,
                    parse({}, { header: true, fields: FIELDS })
                );
                keepGoingTeams = false;
                keepGoingIterations = false;
            }

            if (velocityOpts.overWrite) {
                await fs.promises.writeFile(
                    velocityOpts.outFile,
                    parse({}, { header: true, fields: FIELDS })
                );
                keepGoingTeams = false;
                keepGoingIterations = false;
            }

            if (velocityOpts.exclude && velocityOpts.exclude.length) {
                teams = teams.filter(x => !velocityOpts.exclude!.includes(x.TeamName));
            }

            if (velocityOpts.include && velocityOpts.include.length) {
                teams = teams.filter(x => velocityOpts.include!.includes(x.TeamName));
            }

            await setEffortType(velocityOpts);

            const results = await asyncPool(1, teams, team => {
                return getTeamIterationStats(team, velocityOpts.count, velocityOpts);
            });

            console.timeLog('Overall');
            return results;
        } catch (error) {
            console.log(error);
        }
    }

    async function getTeamIterationStats(team: Team, count: number, velocityOpts: VelocityOptions): Promise<Iteration[]> {
        console.log("starting " + team.TeamName);
        console.time(team.TeamName);

        return new Promise(async (resolve, reject) => {
            try {
                const backlogWorkItemTypes = await getWorkItemTypes(team.ProjectSK, team.TeamId, velocityOpts);
                const iterations = await getIterationsForTeam(team.ProjectSK, team.TeamId, count, velocityOpts);
                const teamIterationResults: Iteration[] = [];

                for (const iteration of iterations) {
                    if (`"${iteration.IterationPath}"` === lastPath && keepGoingIterations) {
                        keepGoingIterations = false;
                        continue;
                    }

                    if (keepGoingIterations) {
                        continue;
                    }

                    const iterationStats = await getSingleTeamIterationStats(team, iteration, backlogWorkItemTypes, velocityOpts);
                    teamIterationResults.push(iterationStats);

                    await fs.promises.appendFile(
                        velocityOpts.outFile,
                        "\n" + `${parse(iterationStats, { header: false, fields: FIELDS })}`
                    );
                }

                console.timeEnd(team.TeamName);
                resolve(teamIterationResults);
            } catch (error) {
                reject(error);
            }
        });
    }

    async function getSingleTeamIterationStats(
        team: Team,
        iteration: Iteration,
        backlogWorkItemTypes: BacklogType[],
        velocityOpts: VelocityOptions
    ): Promise<Iteration> {
        return new Promise(async (resolve, reject) => {
            try {
                const workItems = await getWorkItems(team.TeamId, backlogWorkItemTypes, iteration, velocityOpts);
                const workItemsCompletedLate = await getWorkItemsCompletedLate(team.TeamId, backlogWorkItemTypes, iteration, velocityOpts);
                iteration.late = workItemsCompletedLate;
                const workItemsPlanned = await getWorkItemsPlanned(team.TeamId, backlogWorkItemTypes, iteration, velocityOpts);
                iteration.planned = workItemsPlanned;
                iteration.incomplete = workItems.incomplete;
                iteration.completed = workItems.completed - workItemsCompletedLate;
                iteration.teamName = team.TeamName;
                iteration.total = workItems.completed;
                resolve(iteration);
            } catch (err) {
                reject(err);
            }
        });
    }

    async function getIterationsForTeam(projectId: string, teamId: string, count: number, velocityOpts?: VelocityOptions): Promise<Iteration[]> {
        const queryParameters = {
            "$filter": `Teams/any(t:t/TeamSK eq ${teamId}) and StartDate lt now()`,
            "$orderby": "IsEnded,StartDate desc,EndDate desc,IterationName",
            "$select": "IterationSK,IterationName,StartDate,EndDate,IsEnded,IterationPath",
            "$top": `${count}`
        };
        const path = `/${projectId}${ITERATIONS_PATH}?${querystring.stringify(queryParameters)}`;
        const rawIterations = await tfsUtils.analyticsRequest(path);
        return rawIterations.value;
    }

    async function getTeamsForProject(projectId: string): Promise<Team[]> {
        const path = `/${projectId}${TEAMS_PATH}`;
        const teams = await tfsUtils.analyticsRequest(path);
        return teams.value;
    }

    async function getWorkItemTypes(projectId: string, teamId: string, velocityOpts?: VelocityOptions): Promise<BacklogType[]> {
        const queryParameters = {
            "$apply": `filter(TeamSK eq ${teamId} and  ProjectSK eq ${projectId})
                    /
                    groupby((BacklogCategoryReferenceName, WorkItemType, IsBugType, BacklogName))`
        };

        const path = `${PROCESSES_PATH}?${querystring.stringify(queryParameters)}`;
        const rawTypes = await tfsUtils.analyticsRequest(path);
        const backlogItems = rawTypes.value.filter((x: BacklogType) => x.BacklogName === "Backlog items");
        return backlogItems;
    }

    async function setEffortType(velocityOpts: VelocityOptions): Promise<void> {
        const path = pathModule.join("/", velocityOpts.projectId, PROCESS_CONFIG_PATH);
        const processInfo: ProcessInfo = await tfsUtils.ADORequest(path);
        const effortWord = processInfo.typeFields.Effort.referenceName.split('.').pop();
        velocityOpts.effortWord = effortWord;
    }

    async function getWorkItems(
        teamId: string,
        backlogTypes: BacklogType[],
        iteration: Iteration,
        velocityOpts: VelocityOptions
    ): Promise<WorkItemResult> {
        const workItemLine = buildWorkItemLine(backlogTypes);
        const queryParameters = {
            "$apply": `filter(Teams/any(t:t/TeamSK eq ${teamId})
                    ${workItemLine}
                    and (IterationSK eq ${iteration.IterationSK}) and StateCategory ne null)
                    /
                    groupby((StateCategory, IterationSK),aggregate(${velocityOpts.effortWord} with sum as AggregationResult))`
        };

        const path = `/${velocityOpts.projectId}${WORKITEMS_PATH}?${querystring.stringify(queryParameters)}`;
        const rawWorkItems = await tfsUtils.analyticsRequest(path);
        const workItems: WorkItemData[] = rawWorkItems.value;
        let completed = 0;
        let incomplete = 0;

        if (workItems && workItems.length > 0) {
            const completedElem = workItems.find(x => x.StateCategory === "Completed");
            if (completedElem) {
                completed = completedElem.AggregationResult ? completedElem.AggregationResult : 0;
            }
            const incompleteElem = workItems.find(x => x.StateCategory === "InProgress");
            if (incompleteElem) {
                incomplete = incompleteElem.AggregationResult ? incompleteElem.AggregationResult : 0;
            }
        }
        return { completed: completed, incomplete: incomplete };
    }

    function buildWorkItemLine(backlogTypes: BacklogType[]): string {
        if (backlogTypes.length) {
            const workItemFilters = backlogTypes.map(x => ` WorkItemType eq '${x.WorkItemType}' `);
            const workItemFilter = workItemFilters.join(" or ");
            return workItemFilters.length > 0 ? `
            and (${workItemFilter})
            ` : "";
        }
        return "";
    }

    async function getWorkItemsCompletedLate(
        teamId: string,
        backlogTypes: BacklogType[],
        iteration: Iteration,
        velocityOpts: VelocityOptions
    ): Promise<number> {
        const endDate = velocityOpts.lateAfterDays! >= 0
            ? tfsUtils.buildDateStringForAnalytics(iteration.EndDate, velocityOpts.lateAfterDays!)
            : `Iteration/EndDate`;
        const workItemLine = buildWorkItemLine(backlogTypes);
        const queryParameters = {
            "$apply": `filter(Teams/any(t:t/TeamSK eq ${teamId})
                    ${workItemLine}
                    and StateCategory eq 'Completed'
                    and (IterationSK eq ${iteration.IterationSK})
                    and CompletedDate gt ${endDate})
                    /
                    groupby((StateCategory, IterationSK),aggregate(${velocityOpts.effortWord} with sum as AggregationResult))`
        };

        const path = `/${velocityOpts.projectId}${WORKITEMS_PATH}?${querystring.stringify(queryParameters)}`;
        const rawWorkItems = await tfsUtils.analyticsRequest(path);
        const workItems: WorkItemData[] = rawWorkItems.value;
        let late = 0;

        if (workItems && workItems[0]) {
            late = workItems[0].AggregationResult ? workItems[0].AggregationResult : 0;
        }
        return late;
    }

    async function getWorkItemsPlanned(
        teamId: string,
        backlogTypes: BacklogType[],
        iteration: Iteration,
        velocityOpts: VelocityOptions
    ): Promise<number> {
        const iterationStart = tfsUtils.buildDateStringForADO(iteration.StartDate, velocityOpts.extraPlannedDays!);
        const workItemLine = buildWorkItemLine(backlogTypes);
        const queryParameters = {
            "$apply": `filter(Teams/any(t:t/TeamSK eq  ${teamId})
            ${workItemLine}
            and (RevisedDateSK eq null or RevisedDateSK gt ${iterationStart})
            and (
                    (
                        (
                            (IterationSK eq ${iteration.IterationSK} and DateSK eq ${iterationStart}))
                            and (IterationSK eq ${iteration.IterationSK}) and (DateSK eq ${iterationStart})))
                            and StateCategory ne null)
                            /
                            groupby((IterationSK),aggregate(${velocityOpts.effortWord} with sum as AggregationResult))`
        };

        const path = `/${velocityOpts.projectId}${WORKITEM_SNAPSHOT_PATH}?${querystring.stringify(queryParameters)}`;
        const rawWorkItems = await tfsUtils.analyticsRequest(path);
        const workItems = rawWorkItems.value;
        let planned = 0;

        if (workItems && workItems[0]) {
            planned = workItems[0].AggregationResult;
        }
        return planned;
    }

    return {
        velocities: getVelocities,
        velocityFields: FIELDS.map(x => { if ((x as any).label) { return (x as any).value } return x })
    };
};

export default velocitiesModule;
