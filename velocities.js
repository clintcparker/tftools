const velocitiesModule = function(tfsOpts) {
    const ITERATIONS_PATH = "/_odata/v3.0-preview/Iterations";
    const TEAMS_PATH = "/_odata/v3.0-preview/Teams";
    const PROCESSES_PATH = "/_odata/v3.0-preview/Processes";
    const WORKITEMS_PATH = "/_odata/v3.0-preview/WorkItems";
    const WORKITEM_SNAPSHOT_PATH = "/_odata/v3.0-preview/WorkItemSnapshot";
    const PROCESS_CONFIG_PATH = "/_apis/work/processconfiguration?api-version=5.0-preview.1"
    const pathModule = require("path")
    const fs = require('fs');
    const { parse } = require('json2csv');
    const querystring = require("querystring");
    const asyncPool = require("tiny-async-pool")
    let keepGoingTeams;
    let keepGoingIterations;
    let lastTeam;
    let lastPath;
    const FIELDS = [
        {
            label:"Team",
            value:"teamName",
            default: "NULL"
        },
        {
            label:"Iteration Path",
            value:"IterationPath",
            default:'NULL'
        },
        "StartDate",
        "EndDate",
        {
            label:"Planned",
            value:"planned",
            default:0
        },
        {
            label:"Completed",
            value:"completed",
            default:0
        },
        {
            label:"Completed Late",
            value:"late",
            default:0
        },
        {
            label:"Incomplete",
            value:"incomplete",
            default:0
        },
        {
            label:"Total",
            value:"total",
            default:0
        },
    ];
    
    const tfsUtils = require('./ADOUtilities')(tfsOpts);
    async function getVelocities(incomingVelocityOpts){

        velocityOptsDefaults = {
            include : [],
            exclude : [],
            effortWord  : "Effort",//Effort
            aggregate: "sum",
            extraPlannedDays: 0,
            lateAfterDays: 0,
            overWrite:false
        }

        let velocityOpts = Object.assign({},velocityOptsDefaults,incomingVelocityOpts)

        for (let propName in velocityOpts) {
            let prop = velocityOpts[propName] + "";
            if ((prop + "").startsWith("~")){
                let expanded = expandHomeDir(prop);
                velocityOpts[propName] = expanded;
            }
        }


        try {
            console.time('Overall');
            let teams = await getTeamsForProject(velocityOpts.projectId);
            keepGoingTeams = true;
            keepGoingIterations = true;
            try {
                let a = await fs.readFileSync(velocityOpts.outFile);
                if(a){
                    let last = a.toString().split("\n").reverse()[0].split(",");
                    lastTeam = last[0];
                    lastPath = last[1];
                    if (lastTeam == `"NULL"`){
                        keepGoingTeams = false
                        keepGoingIterations = false
                    }
                } 
            }   catch {
                await fs.writeFileSync(
                    velocityOpts.outFile,
                    parse({},{header:true,fields:FIELDS}),
                    (err) => err ? console.error(`${velocityOpts.outFile} not written!` , err) : console.log(`${velocityOpts.outFile} written!`)
                );
                keepGoingTeams = false;
                keepGoingIterations = false;
            }
            if(velocityOpts.overWrite){
                await fs.writeFileSync(
                    velocityOpts.outFile,
                    parse({},{header:true,fields:FIELDS}),
                    (err) => err ? console.error(`${velocityOpts.outFile} not written!` , err) : console.log(`${velocityOpts.outFile} written!`)
                );
                keepGoingTeams = false;
                keepGoingIterations = false;
            }
            if(velocityOpts.exclude && velocityOpts.exclude.length){
                teams = teams.filter(x=>!velocityOpts.exclude.includes(x.TeamName));
            }
            if(velocityOpts.include && velocityOpts.include.length){
                teams = teams.filter(x=>velocityOpts.include.includes(x.TeamName));
            }
            await setEffortType(velocityOpts);
            // for (let team of teams) {
            //     if(`"${team.TeamName}"` == lastTeam){
            //         keepGoingTeams =false;
            //     }
            //     if (keepGoingTeams){
            //         continue;
            //     }
            //     let teamIterationResults = await getTeamIterationStats(team,velocityOpts.count,velocityOpts)
            //     results.concat(teamIterationResults);
            // }
            let results = await asyncPool(1, teams, team =>  {
                return  getTeamIterationStats(team,velocityOpts.count,velocityOpts);
            });
            console.timeLog('Overall')
            return results;
        } catch (error){
            console.log(error)
        } finally{

        }
    }

    async function getTeamIterationStats(team,count,velocityOpts){
        console.log("starting " + team.TeamName);
        console.time(team.TeamName);

        return new Promise( async (resolve, reject) => {
            try {
                //keepGoingIterations = lastPath && lastPath == "NULL" ? false : true;
                let backlogWorkItemTypes = await getWorkItemTypes(team.ProjectSK,team.TeamId, velocityOpts);
                let iterations = await getIterationsForTeam(team.ProjectSK,team.TeamId,count,velocityOpts);
                let teamIterationResults = [];
                for (let iteration of iterations){
                    if(`"${iteration.IterationPath}"`== lastPath && keepGoingIterations)
                    {
                        keepGoingIterations = false;
                        continue;
                    }
                    if (keepGoingIterations){
                        continue;
                    }
                    let iterationStats = await getSingleTeamIterationStats(team, iteration, backlogWorkItemTypes, velocityOpts);
                    teamIterationResults.push(iterationStats);
                    await fs.appendFile(
                        velocityOpts.outFile,
                        "\n" +`${parse(iterationStats,{header:false,fields:FIELDS})}`,
                        (err) => err ? console.error('CSV not appended!' , err) : ({})
                    );
                } 
                console.timeEnd(team.TeamName);
                resolve(teamIterationResults);
            } catch(error) {
                reject(error)
            }
        });
    }

    async function getSingleTeamIterationStats(team,iteration,backlogWorkItemTypes,velocityOpts){
        return new Promise( async(resolve, reject) => {
            try { 
                let workItems = await getWorkItems(team.TeamId,backlogWorkItemTypes,iteration,velocityOpts);
                let workItemsCompletedLate = await getWorkItemsCompletedLate(team.TeamId,backlogWorkItemTypes,iteration,velocityOpts);
                iteration.late = workItemsCompletedLate;
                let workItemsPlanned = await getWorkItemsPlanned(team.TeamId,backlogWorkItemTypes,iteration,velocityOpts)
                iteration.planned = workItemsPlanned;
                iteration.incomplete = workItems.incomplete;
                iteration.completed = workItems.completed - workItemsCompletedLate;
                iteration.teamName = team.TeamName;
                iteration.total = workItems.completed;
                resolve(iteration);
            } catch (err) {
                reject(err)
            }
        });
    }

    async function getIterationsForTeam(projectId, teamId, count){
        const queryParameters = {
            "$filter":`Teams/any(t:t/TeamSK eq ${teamId}) and StartDate lt now()`,
            "$orderby":"IsEnded,StartDate desc,EndDate desc,IterationName",
            "$select":"IterationSK,IterationName,StartDate,EndDate,IsEnded,IterationPath",
            "$top":`${count}`
        };
        let path= `/${projectId}${ITERATIONS_PATH}?${querystring.stringify(queryParameters)}`;
        let rawIterations = await tfsUtils.analyticsRequest(path);
        return rawIterations.value;
    }

    async function getTeamsForProject(projectId)
    {
        // AnalyticsUpdatedDate	"2018-07-31T18:47:53.01Z"
        let path= `/${projectId}${TEAMS_PATH}`;
        let teams = await tfsUtils.analyticsRequest(path);
        return teams.value;
    }

    async function getWorkItemTypes(projectId, teamId)
    {
        const queryParameters = {
            "$apply":`filter(TeamSK eq ${teamId} and  ProjectSK eq ${projectId})
                    /
                    groupby((BacklogCategoryReferenceName, WorkItemType, IsBugType, BacklogName))`
        };

        let path= `${PROCESSES_PATH}?${querystring.stringify(queryParameters)}`;
        let rawTypes = await tfsUtils.analyticsRequest(path);
        let backlogItems = rawTypes.value.filter(x=> x.BacklogName == "Backlog items");
        return backlogItems;
    }

    async function setEffortType(velocityOpts)
    {
        //https://mindbody.visualstudio.com/MBScrum/_apis/work/processconfiguration?api-version=5.0-preview.1
        let path = pathModule.join("/",velocityOpts.projectId,PROCESS_CONFIG_PATH)
        let processInfo = await tfsUtils.ADORequest(path);
        let effortWord = processInfo.typeFields.Effort.referenceName.split('.').pop();
        velocityOpts.effortWord = effortWord;
    }

    async function getWorkItems(teamId, backlogTypes, iteration,velocityOpts)
    {
        let workItemLine = buildWorkItemLine(backlogTypes);
        let queryParameters = {
            "$apply":`filter(Teams/any(t:t/TeamSK eq ${teamId}) 
                    ${workItemLine}
                    and (IterationSK eq ${iteration.IterationSK}) and StateCategory ne null) 
                    /
                    groupby((StateCategory, IterationSK),aggregate(${velocityOpts.effortWord} with sum as AggregationResult))`
        };

        let path= `/${velocityOpts.projectId}${WORKITEMS_PATH}?${querystring.stringify(queryParameters)}`;
        let rawWorkItems = await tfsUtils.analyticsRequest(path);
        let workItems = rawWorkItems.value;
        let completed = 0;
        let incomplete = 0;
        if (workItems && workItems.length > 0)
        {
            let completedElem = workItems.find(x=>x.StateCategory == "Completed");
            if(completedElem) {
                completed = completedElem.AggregationResult ? completedElem.AggregationResult : 0; //this is the total completed. Note th lack of a date in the query
            }
            let incompleteElem = workItems.find(x=>x.StateCategory == "InProgress");
            if(incompleteElem){
                incomplete = incompleteElem.AggregationResult ? incompleteElem.AggregationResult : 0;
            }
        }
        return {completed:completed,incomplete:incomplete};
    }
    
    function buildWorkItemLine(backlogTypes){
        if(backlogTypes.length){
            let workItemFilters = backlogTypes.map(x=>` WorkItemType eq '${x.WorkItemType}' `);
            let workItemFilter = workItemFilters.join(" or ")
            return workItemFilters.length > 0 ? `
            and (${workItemFilter}) 
            ` : "";
        }
        return "";
    }

    async function getWorkItemsCompletedLate(teamId, backlogTypes, iteration,velocityOpts)
    {
        let endDate = velocityOpts.lateAfterDays >= 0 ? tfsUtils.buildDateStringForAnalytics(iteration.EndDate, velocityOpts.lateAfterDays) : `Iteration/EndDate`;
        let workItemLine = buildWorkItemLine(backlogTypes);
        let queryParameters = {
            "$apply":`filter(Teams/any(t:t/TeamSK eq ${teamId}) 
                    ${workItemLine}
                    and StateCategory eq 'Completed' 
                    and (IterationSK eq ${iteration.IterationSK}) 
                    and CompletedDate gt ${endDate}) 
                    /
                    groupby((StateCategory, IterationSK),aggregate(${velocityOpts.effortWord} with sum as AggregationResult))`
        };

        let path= `/${velocityOpts.projectId}${WORKITEMS_PATH}?${querystring.stringify(queryParameters)}`;
        let rawWorkItems = await tfsUtils.analyticsRequest(path);
        let workItems = rawWorkItems.value;
        let late = 0;
        if (workItems && workItems[0])
        {
            late = workItems[0].AggregationResult ? workItems[0].AggregationResult : 0;
        }
        return late;
    }
    
    async function getWorkItemsPlanned(teamId, backlogTypes, iteration,velocityOpts)
    {
        let iterationStart = tfsUtils.buildDateStringForADO(iteration.StartDate,velocityOpts.extraPlannedDays);
        let workItemLine = buildWorkItemLine(backlogTypes);
        let queryParameters = {
            "$apply":`filter(Teams/any(t:t/TeamSK eq  ${teamId}) 
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

        let path= `/${velocityOpts.projectId}${WORKITEM_SNAPSHOT_PATH}?${querystring.stringify(queryParameters)}`;
        let rawWorkItems = await tfsUtils.analyticsRequest(path);
        let workItems = rawWorkItems.value;
        let planned = 0;
        if (workItems && workItems[0])
        {
            planned = workItems[0].AggregationResult;
        }
        return planned;
    }

    return {
        velocities:getVelocities,
        velocityFields: FIELDS.map(x=>{if(x.label){return x.value}return x})
    }

}

module.exports = velocitiesModule;

