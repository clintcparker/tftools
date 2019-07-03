### Getting setup for now

from a new directory
`npm install https://github.com/clintcparker/tftools`

including the reference 
`const ADOToolsModule = require(“vsts-scrape”)`

### Example
Example for getting the velocities for all teams in a project:

Make a file with this contents in the new directory:

```
var tfsOpts = {
   ADO_HOST            : “YOUR DOMAIN”, //your domain for ADO, ex: https://mindbody.visualstudio.com
}

tfsOpts.PAT = “PAT VALUE”; //your ADO PAT

const ADOToolsModule = require(“vsts-scrape”)

var velocityOpts = {
   outFile : `~/Desktop/2velocities.csv`,
   projectId:“PROJECT NAME”, //The name of your project, ex: MBScrum
   count : 2
}

void (async()=>{
   let ADOTools = ADOToolsModule(tfsOpts)
   let results = await ADOTools.velocities(velocityOpts)
})(); (edited) 
```

update the contents of the file, including `count` and `PAT`

after that, either debug from your nodejs environment, or `node NAME_OF_YOUR_FILE`