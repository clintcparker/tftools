const velocitiesModule = function(tfsOpts) {
    const ITERATIONS_PATH = "/_odata/v3.0-preview/Iterations";
    const TEAMS_PATH = "/_odata/v3.0-preview/Teams";
    const PROCESSES_PATH = "/_odata/v3.0-preview/Processes";
    const WORKITEMS_PATH = "/_odata/v3.0-preview/WorkItems";
    const WORKITEM_SNAPSHOT_PATH = "/_odata/v3.0-preview/WorkItemSnapshot";
    var ALL_VELOCITIES_FILE;
    const fs = require('fs');
    const { parse } = require('json2csv');
    const querystring = require("querystring");
    var keepGoingTeams;
    var keepGoingIterations;
    var lastTeam;
    var lastPath;
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
    async function getVelocities(velocityOpts){

        for (var propName in velocityOpts) {
            let prop = velocityOpts[propName] + "";
            if ((prop + "").startsWith("~")){
                let expanded = expandHomeDir(prop);
                velocityOpts[propName] = expanded;
            }
        }


        ALL_VELOCITIES_FILE = velocityOpts.outFile;
        try {
            console.time('Overall');
            var teams = await getTeamsForProject(velocityOpts.projectId);
            keepGoingTeams = true;
            keepGoingIterations = true;
            try {
                var a = await fs.readFileSync(ALL_VELOCITIES_FILE);
                if(a){
                    var last = a.toString().split("\n").reverse()[0].split(",");
                    lastTeam = last[0];
                    lastPath = last[1];
                    if (lastTeam == `"NULL"`){
                        keepGoingTeams = false
                        keepGoingIterations = false
                    }
                } 
            }   catch {
                await fs.writeFileSync(
                    ALL_VELOCITIES_FILE,
                    parse({},{header:true,fields:FIELDS}),
                    (err) => err ? console.error(`${ALL_VELOCITIES_FILE} not written!` , err) : console.log(`${ALL_VELOCITIES_FILE} written!`)
                );
                keepGoingTeams = false;
                keepGoingIterations = false;
            }
            var results =[];
            for (var team of teams) {
                if(`"${team.TeamName}"` == lastTeam){
                    keepGoingTeams =false;
                }
                if (keepGoingTeams){
                    continue;
                }
                if(team.TeamName == "MBScrum Team" || team.TeamName == "Payments"){
                    continue;
                }
                var teamIterationResults = await getTeamIterationStats(team,velocityOpts.count)
                results.concat(teamIterationResults);
            }
            console.timeEnd('Overall')
            return results;
        } catch (error){
            console.log(error)
        } finally{

        }
    }

    async function getTeamIterationStats(team,count){
        console.log("starting " + team.TeamName);
        console.time(team.TeamName,"","","");

        return new Promise( async (resolve, reject) => {
            try {
                //keepGoingIterations = lastPath && lastPath == "NULL" ? false : true;
                var backlogWorkItemTypes = await getWorkItemTypes(team.ProjectSK,team.TeamId);
                var iterations = await getIterationsForTeam(team.ProjectSK,team.TeamId,count);
                var teamIterationResults = [];
                for (var iteration of iterations){
                    if(`"${iteration.IterationPath}"`== lastPath && keepGoingIterations)
                    {
                        keepGoingIterations = false;
                        continue;
                    }
                    if (keepGoingIterations){
                        continue;
                    }
                    var iterationStats = await getSingleTeamIterationStats(team, iteration, backlogWorkItemTypes);
                    teamIterationResults.push(iterationStats);
                    await fs.appendFile(
                        ALL_VELOCITIES_FILE,
                        "\n" +`${parse(iterationStats,{header:false,fields:FIELDS})}`,
                        (err) => err ? console.error('CSV not appended!' , err) : ({})
                    );
                } 
                console.timeEnd(team.TeamName,"","","","");
                resolve(teamIterationResults);
            } catch(error) {
                reject(error)
            }
        });
    }

    async function getSingleTeamIterationStats(team,iteration,backlogWorkItemTypes){
        return new Promise( async(resolve, reject) => {
            try { 
                var workItems = await getWorkItems(team.ProjectSK,team.TeamId,backlogWorkItemTypes,iteration.IterationSK);
                var endDate = tfsUtils.buildDateStringForADO(iteration.EndDate,1);
                var workItemsCompletedLate = await getWorkItemsCompletedLate(team.ProjectSK,team.TeamId,backlogWorkItemTypes,iteration.IterationSK,endDate);
                iteration.late = workItemsCompletedLate;
                var startDate = tfsUtils.buildDateStringForADO(iteration.StartDate,1);
                var workItemsPlanned = await getWorkItemsPlanned(team.ProjectSK,team.TeamId,backlogWorkItemTypes,iteration.IterationSK,startDate)
                iteration.planned = workItemsPlanned;
                iteration.incomplete = workItems.incomplete;
                iteration.completed = workItems.completed;
                iteration.teamName = team.TeamName;
                iteration.total = workItemsCompletedLate + workItems.completed;
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
        var path= `/${projectId}${ITERATIONS_PATH}?${querystring.stringify(queryParameters)}`;
        var rawIterations = await tfsUtils.analyticsRequest(path);
        return rawIterations.value;
    }

    async function getTeamsForProject(projectId)
    {
        // AnalyticsUpdatedDate	"2018-07-31T18:47:53.01Z"
        var path= `/${projectId}${TEAMS_PATH}`;
        var teams = await tfsUtils.analyticsRequest(path);
        return teams.value;
    }

    async function getWorkItemTypes(projectId, teamId)
    {
        const queryParameters = {
            "$apply":`filter(TeamSK eq ${teamId} and  ProjectSK eq ${projectId})
                    /
                    groupby((BacklogCategoryReferenceName, WorkItemType, IsBugType, BacklogName))`
        };

        var path= `${PROCESSES_PATH}?${querystring.stringify(queryParameters)}`;
        var rawTypes = await tfsUtils.analyticsRequest(path);
        var backlogItems = rawTypes.value.filter(x=> x.BacklogName == "Backlog items");
        return backlogItems;
    }

    async function getWorkItems(projectId, teamId, backlogTypes, iteration)
    {
        var workItemFilters = backlogTypes.map(x=>` WorkItemType eq '${x.WorkItemType}' `);
        var workItemFilter = workItemFilters.join(" or ")
        var queryParameters = {
            "$apply":`filter(Teams/any(t:t/TeamSK eq ${teamId}) 
                    and (${workItemFilter}) 
                    and (IterationSK eq ${iteration}) and StateCategory ne null) 
                    /
                    groupby((StateCategory, IterationSK),aggregate(Effort with sum as AggregationResult))`
        };

        var path= `/${projectId}${WORKITEMS_PATH}?${querystring.stringify(queryParameters)}`;
        var rawWorkItems = await tfsUtils.analyticsRequest(path);
        var workItems = rawWorkItems.value;
        var completed = 0;
        var incomplete = 0;
        if (workItems && workItems.length > 0)
        {
            var completedElem = workItems.find(x=>x.StateCategory == "Completed");
            if(completedElem) {
                completed = completedElem.AggregationResult ? completedElem.AggregationResult : 0;
            }
            var incompleteElem = workItems.find(x=>x.StateCategory == "InProgress");
            if(incompleteElem){
                incomplete = incompleteElem.AggregationResult ? incompleteElem.AggregationResult : 0;
            }
        }
        return {completed:completed,incomplete:incomplete};
    }

    async function getWorkItemsCompletedLate(projectId, teamId, backlogTypes, iteration,endDate)
    {
        var workItemFilters = backlogTypes.map(x=>` WorkItemType eq '${x.WorkItemType}' `);
        var workItemFilter = workItemFilters.join(" or ")
        var queryParameters = {
            "$apply":`filter(Teams/any(t:t/TeamSK eq ${teamId}) 
                    and (${workItemFilter}) 
                    and StateCategory eq 'Completed' 
                    and (IterationSK eq ${iteration}) 
                    and CompletedDate gt Iteration/EndDate) 
                    /
                    groupby((StateCategory, IterationSK),aggregate(Effort with sum as AggregationResult))`
        };

        var path= `/${projectId}${WORKITEMS_PATH}?${querystring.stringify(queryParameters)}`;
        var rawWorkItems = await tfsUtils.analyticsRequest(path);
        var workItems = rawWorkItems.value;
        var late = 0;
        if (workItems && workItems[0])
        {
            late = workItems[0].AggregationResult ? workItems[0].AggregationResult : 0
        }
        return late;
    }

    async function getWorkItemsPlanned(projectId, teamId, backlogTypes, iterationId, iterationStart)
    {
        var workItemFilters = backlogTypes.map(x=>` WorkItemType eq '${x.WorkItemType}' `);
        var workItemFilter = workItemFilters.join(" or ")
        var queryParameters = {
            "$apply":`filter(Teams/any(t:t/TeamSK eq  ${teamId}) 
            and (${workItemFilter}) 
            and (RevisedDateSK eq null or RevisedDateSK gt ${iterationStart}) 
            and (
                    (
                        (
                            (IterationSK eq ${iterationId} and DateSK eq ${iterationStart})) 
                            and (IterationSK eq ${iterationId}) and (DateSK eq ${iterationStart}))) 
                            and StateCategory ne null)
                            /
                            groupby((IterationSK),aggregate(Effort with sum as AggregationResult))`
        };

        var path= `/${projectId}${WORKITEM_SNAPSHOT_PATH}?${querystring.stringify(queryParameters)}`;
        var rawWorkItems = await 
        tfsUtils.analyticsRequest(path);
        var workItems = rawWorkItems.value;
        var planned = 0;
        if (workItems && workItems[0])
        {
            planned = workItems[0].AggregationResult;
        }
        return planned;
    }

    return {
        velocities:getVelocities
    }

}

module.exports = velocitiesModule;

