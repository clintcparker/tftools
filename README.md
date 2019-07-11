[![Build Status](https://travis-ci.org/clintcparker/tftools.svg?branch=master)](https://travis-ci.org/clintcparker/tftools)

### Getting setup for now

from a new directory
`npm install tftools`

or for the global CLI
`npm install -g tftools`

including the reference 
`const ADOToolsModule = require(“tftools”)`

### Example
Example for getting the velocities for all teams in a project:

Make a file with this contents in the new directory:

```
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
