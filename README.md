# tftools

[![Build Status](https://travis-ci.org/clintcparker/tftools.svg?branch=master)](https://travis-ci.org/clintcparker/tftools)

## Installation

from a new directory
`npm install tftools`

or for the global CLI
`npm install -g tftools`

including the reference
`const ADOToolsModule = require(“tftools”)`

## Examples

### Using the CLI

#### Options

```
$ tftools velocities -h                                                                                                                                                                                       v2.0.12 
Usage: velocities [options]

get  velocities for all teams in a project

Options:
  --project <name>            the ADO project analyze (default: "<ENTER A PROJECT NAME>")
  -c, --count <count>         the number of team velocities to collect
  -f --file_name <name>       the name of the output file. Defaults to velocities.csv (default: "velocities.csv")
  --exclude <excluded teams>  comma separated list of teams to exclude
  --include <included teams>  comma separated list of teams to include
  -x, --over_write            over write the output file if it exists
  -C, --count_items           count items instead of summing effort
  -p, --planned <days>        extra days to count from the start of the sprint for planned work (default: 0)
  -l, --late <days>           extra days to count from the end of the sprint for late work (default: 0)
  -h, --help                  output usage information
  ```

#### Invoking

```
$ tftools velocities -f ~/Desktop/velocities.csv -c 4 -x -p 3 -l 2   --pat iszadpfub08adfsdgf7ybh9adfh9ahf6l3273c2nrxjphlqa --domain https://dev.azure.com/contoso  --project ContosoScrum --exclude "Data Center Engineering,Business Systems"
```

* This will get the data for the last 4 sprints for all teams except "Data Center Engineering" and "Business Systems." It will count anything completed 2 days after the sprint end as "late" and will include anything added to the backlod 3 days after the sprint start.

### Using as a module

Example for getting the velocities for all teams in a project:

Make a file with this contents in the new directory:

```js
var tfsOpts = {
   ADO_HOST            : “YOUR DOMAIN”, //your domain for ADO, ex: https://fabrikam.visualstudio.com
}

tfsOpts.PAT = “PAT VALUE”; //your ADO PAT

const ADOToolsModule = require(“tftools”)

var velocityOpts = {
   outFile : `~/Desktop/2velocities.csv`,
   projectId:“PROJECT NAME”, //The name of your project, ex: MBScrum
   count : 2
}

void (async()=>{
   let ADOTools = ADOToolsModule(tfsOpts)
   let results = await ADOTools.velocities(velocityOpts)
})();
```

update the contents of the file, including `count` and `PAT`

after that, either debug from your nodejs environment, or run `node NAME_OF_YOUR_FILE` in the terminal
