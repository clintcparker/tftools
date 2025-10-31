# tftools

[![Build Status](https://travis-ci.org/clintcparker/tftools.svg?branch=master)](https://travis-ci.org/clintcparker/tftools)

A powerful Node.js toolkit for extracting metrics and analytics from Azure DevOps (ADO) projects. tftools provides both a command-line interface and a programmatic API for analyzing team velocity, code statistics, build information, and test coverage.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Prerequisites](#prerequisites)
- [Authentication](#authentication)
- [Usage](#usage)
  - [CLI Usage](#cli-usage)
  - [Module Usage](#module-usage)
- [Commands](#commands)
  - [Velocities Command](#velocities-command)
  - [Stats Command](#stats-command)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Examples](#examples)
- [Contributing](#contributing)
- [License](#license)

## Features

### Team Velocity Analysis
- Extract work item completion data across multiple sprints
- Calculate team velocities using effort points or item counts
- Filter teams with include/exclude lists
- Configurable planned work windows (items added after sprint start)
- Configurable late work windows (items completed after sprint end)
- Export results to CSV format
- Resumable operations

### Code Statistics Analysis
- Lines of code analysis via CLOC integration
- Test detection and analysis via grep patterns
- Code coverage metrics from Azure DevOps
- Build information retrieval and queueing
- Git operations (clone, pull latest code)
- Configurable language filtering
- Directory exclusion support
- Multi-repository analysis
- CSV export of results

### Build Management
- Queue builds programmatically
- Retrieve build definitions
- Analyze build results
- Build status tracking

### Repository Operations
- Clone multiple repositories from ADO
- Initialize repositories for analysis
- Git pull operations across multiple repos

## Installation

### Global CLI Installation
```bash
npm install -g tftools
```

### Local Project Installation
```bash
npm install tftools
```

## Prerequisites

- Node.js 12.4 or higher
- Azure DevOps account with appropriate permissions
- Personal Access Token (PAT) with the following scopes:
  - Code (Read)
  - Build (Read & Execute)
  - Test Management (Read)
  - Analytics (Read)

## Authentication

To use tftools, you need to create a Personal Access Token (PAT) in Azure DevOps:

1. Go to your Azure DevOps organization
2. Navigate to User Settings > Personal Access Tokens
3. Click "New Token"
4. Grant the required scopes (Code, Build, Test Management, Analytics)
5. Copy the generated token

For more information, see: [Azure DevOps PAT Documentation](https://docs.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/pats)

## Usage

### CLI Usage

The CLI provides two main commands: `velocities` and `stats`.

#### Global Options

```bash
tftools [command] [options]

Options:
  -V, --version              output the version number
  --domain <url>             name of your ADO instance (default: "https://dev.azure.com")
  -o, --outputDir <dir>      directory for output files (default: "~/Desktop/")
  --pat <PAT>                Azure DevOps Personal Access Token
  --printOpts                print options for debugging
  -h, --help                 display help for command
```

### Module Usage

Include tftools in your Node.js project:

```javascript
const ADOToolsModule = require("tftools");

// Configure connection to Azure DevOps
const tfsOpts = {
    ADO_HOST: "https://dev.azure.com/yourorg",
    PAT: "your-personal-access-token"
};

// Initialize the module
const ADOTools = ADOToolsModule(tfsOpts);

// Use the API
async function run() {
    const results = await ADOTools.velocities({
        projectId: "YourProject",
        count: 5,
        outFile: "~/Desktop/velocities.csv"
    });
    console.log(results);
}

run();
```

## Commands

### Velocities Command

Get velocity metrics for all teams in a project across multiple sprints.

#### Options

```bash
tftools velocities [options]

Options:
  --project <name>            ADO project to analyze (required)
  -c, --count <count>         number of team velocities to collect (required)
  -f, --file_name <name>      output file name (default: "velocities.csv")
  --exclude <teams>           comma-separated list of teams to exclude
  --include <teams>           comma-separated list of teams to include
  -x, --over_write            overwrite the output file if it exists
  -C, --count_items           count items instead of summing effort points
  -p, --planned <days>        extra days to count from sprint start for planned work (default: 0)
  -l, --late <days>           extra days to count from sprint end for late work (default: 0)
  -h, --help                  display help for command
```

#### Examples

**Basic usage - Get last 4 sprints for all teams:**
```bash
tftools velocities \
  --project "ContosoScrum" \
  --count 4 \
  --pat "your-pat-token" \
  --domain "https://dev.azure.com/contoso"
```

**Advanced usage - Exclude teams and configure planned/late work:**
```bash
tftools velocities \
  -f ~/Desktop/velocities.csv \
  -c 4 \
  -x \
  -p 3 \
  -l 2 \
  --pat "your-pat-token" \
  --domain "https://dev.azure.com/contoso" \
  --project "ContosoScrum" \
  --exclude "Data Center Engineering,Business Systems"
```

This will:
- Analyze the last 4 sprints
- Exclude "Data Center Engineering" and "Business Systems" teams
- Count items added up to 3 days after sprint start as "planned"
- Count items completed up to 2 days after sprint end as "late"
- Overwrite the output file if it exists

**Count items instead of effort points:**
```bash
tftools velocities \
  --project "ContosoScrum" \
  --count 6 \
  -C \
  --pat "your-pat-token"
```

**Include only specific teams:**
```bash
tftools velocities \
  --project "ContosoScrum" \
  --count 3 \
  --include "Team Alpha,Team Beta,Team Gamma" \
  --pat "your-pat-token"
```

### Stats Command

Analyze code statistics across repositories including lines of code, tests, and coverage.

#### Options

```bash
tftools stats [options]

Options:
  -d, --directory <dir>              directory of repos to analyze (default: ".")
  --dates <dates>                    comma-separated list of dates to analyze
  --project <name>                   ADO project to analyze (required)
  -v, --vsts                         analyze ADO builds
  -c, --cloc                         analyze via CLOC (Count Lines of Code)
  -t, --tests                        analyze tests via grep
  -b, --build                        queue ADO builds
  --pull                             pull latest code before analysis
  --exclude_dirs <dirs>              comma-separated list of directories to exclude
  --include_lang <languages>         comma-separated list of languages to include
  -h, --help                         display help for command
```

#### Examples

**Basic code analysis with CLOC:**
```bash
tftools stats \
  --project "ContosoScrum" \
  -c \
  --directory ~/code/repos \
  --pat "your-pat-token"
```

**Comprehensive analysis - CLOC, tests, and builds:**
```bash
tftools stats \
  --project "ContosoScrum" \
  -d ~/code/repos \
  -c \
  -t \
  -v \
  --pull \
  --pat "your-pat-token"
```

**Filter by specific languages:**
```bash
tftools stats \
  --project "ContosoScrum" \
  -c \
  --include_lang "C#,TypeScript,JavaScript" \
  --directory ~/code/repos \
  --pat "your-pat-token"
```

**Exclude specific directories:**
```bash
tftools stats \
  --project "ContosoScrum" \
  -c \
  -t \
  --exclude_dirs "node_modules,bin,obj,dist" \
  --directory ~/code/repos \
  --pat "your-pat-token"
```

**Queue builds and analyze results:**
```bash
tftools stats \
  --project "ContosoScrum" \
  -b \
  -v \
  --directory ~/code/repos \
  --pat "your-pat-token"
```

## API Reference

When using tftools as a module, the following API is available:

### Initialization

```javascript
const ADOToolsModule = require("tftools");

const tfsOpts = {
    ADO_HOST: "https://dev.azure.com/yourorg",  // Required
    PAT: "your-personal-access-token"            // Required
};

const ADOTools = ADOToolsModule(tfsOpts);
```

### Methods

#### `codeStats(options)`

Analyze code statistics for repositories.

**Options:**
```javascript
{
    Directory: "./repos",              // Directory containing repositories
    dates: ["2024-01-01"],            // Array of dates to analyze
    VSTS: true,                       // Analyze ADO builds
    CLOC: true,                       // Run CLOC analysis
    Tests: true,                      // Analyze tests
    projectId: "ProjectName",         // ADO project name
    outputDirectory: "~/output",      // Output directory for results
    langFilters: ["C#", "JavaScript"], // Language filters
    excludeDirs: ["node_modules"],    // Directories to exclude
    build: true,                      // Queue builds
    pull: true                        // Pull latest code
}
```

**Returns:** Promise resolving to analysis results array

**Example:**
```javascript
const results = await ADOTools.codeStats({
    Directory: "~/code/repos",
    projectId: "ContosoScrum",
    CLOC: true,
    Tests: true,
    VSTS: true
});
```

#### `velocities(options)`

Get team velocity metrics.

**Options:**
```javascript
{
    outFile: "velocities.csv",     // Output file path
    projectId: "ProjectName",      // ADO project name
    count: 5,                      // Number of sprints to analyze
    exclude: ["Team1", "Team2"],   // Teams to exclude
    include: ["Team3"],            // Teams to include (if specified, only these)
    overWrite: true,               // Overwrite existing file
    aggregate: "sum",              // "sum" for effort points or "count" for items
    extraPlannedDays: 3,          // Days after sprint start for planned work
    lateAfterDays: 2              // Days after sprint end for late work
}
```

**Returns:** Promise resolving to velocity data array

**Example:**
```javascript
const results = await ADOTools.velocities({
    projectId: "ContosoScrum",
    count: 4,
    outFile: "~/Desktop/velocities.csv",
    exclude: ["Legacy Team"],
    aggregate: "sum",
    extraPlannedDays: 3,
    lateAfterDays: 2
});
```

#### `builds(options)`

Queue builds for repositories.

**Options:**
```javascript
{
    projectId: "ProjectName",     // ADO project name
    repos: ["repo1", "repo2"]    // Array of repository names
}
```

**Returns:** Promise resolving to build results

**Example:**
```javascript
const buildResults = await ADOTools.builds({
    projectId: "ContosoScrum",
    repos: ["frontend", "backend", "api"]
});
```

#### `definitions(options)`

Get build definitions for repositories.

**Options:**
```javascript
{
    projectId: "ProjectName"     // ADO project name
}
```

**Returns:** Promise resolving to build definitions array

**Example:**
```javascript
const definitions = await ADOTools.definitions({
    projectId: "ContosoScrum"
});
```

#### `initializeRepos(options)`

Clone and initialize repositories from Azure DevOps.

**Options:**
```javascript
{
    projectId: "ProjectName",        // ADO project name
    targetDirectory: "~/code/repos", // Target directory for cloned repos
    repos: ["repo1", "repo2"]       // Optional: specific repos to clone
}
```

**Returns:** Promise resolving when repositories are initialized

**Example:**
```javascript
await ADOTools.initializeRepos({
    projectId: "ContosoScrum",
    targetDirectory: "~/code/repos"
});
```

### Properties

#### `defaultLangs`

Pre-configured language sets for common platforms:

```javascript
ADOTools.defaultLangs = {
    dotnet: ["C#", "Razor", "ASP", "ASP.NET", "HTML", "CSS", "LESS", "PowerShell", "JavaScript", "TypeScript"],
    android: ["Kotlin", "Java", "XML", "Gradle"],
    ios: ["Objective C", "XML", "C/C++ Header"]
};
```

**Example:**
```javascript
const results = await ADOTools.codeStats({
    projectId: "MobileApp",
    CLOC: true,
    langFilters: ADOTools.defaultLangs.android
});
```

#### `velocityFields`

Field definitions for velocity output formatting.

## Configuration

### Environment Variables

You can also configure tftools using environment variables:

```bash
export ADO_HOST="https://dev.azure.com/yourorg"
export ADO_PAT="your-personal-access-token"
```

### Configuration Object

Full configuration options for module initialization:

```javascript
const tfsOpts = {
    ADO_HOST: "https://dev.azure.com/yourorg",              // Required: Your ADO instance URL
    PAT: "your-personal-access-token",                       // Required: Personal Access Token
    ANALYTICS_HOST: "https://analytics.dev.azure.com/yourorg", // Optional: Auto-configured
    REPO_API_PATH: "/_apis/git/repositories?api-version=5.0", // Optional: API path overrides
    BUILD_API_PATH: "/_apis/build/builds?api-version=5.0",
    DEFINITIONS_API_PATH: "/_apis/build/definitions?api-version=5.0",
    COVERAGE_API_PATH: "/_apis/test/CodeCoverage?api-version=5.0-preview.1",
    TEST_API_PATH: "/_apis/test/runs?api-version=5.0"
};
```

### Path Expansion

tftools automatically expands home directory paths (`~`) in file paths:

```javascript
// These are equivalent
outFile: "~/Desktop/velocities.csv"
outFile: "/home/username/Desktop/velocities.csv"
```

## Examples

### Complete Examples

#### Example 1: Full Velocity Analysis

```javascript
const ADOToolsModule = require("tftools");

const tfsOpts = {
    ADO_HOST: "https://dev.azure.com/contoso",
    PAT: process.env.ADO_PAT
};

const velocityOpts = {
    outFile: "~/Desktop/velocities.csv",
    projectId: "ContosoScrum",
    count: 6,
    exclude: ["Legacy Team", "Admin Team"],
    aggregate: "sum",
    extraPlannedDays: 3,
    lateAfterDays: 2,
    overWrite: true
};

async function analyzeVelocity() {
    const ADOTools = ADOToolsModule(tfsOpts);
    const results = await ADOTools.velocities(velocityOpts);
    console.log("Velocity analysis complete!");
    console.table(results);
}

analyzeVelocity();
```

#### Example 2: Multi-Repository Code Analysis

```javascript
const ADOToolsModule = require("tftools");

const tfsOpts = {
    ADO_HOST: "https://dev.azure.com/contoso",
    PAT: process.env.ADO_PAT
};

const statsOpts = {
    Directory: "~/code/contoso-repos",
    projectId: "ContosoScrum",
    CLOC: true,
    Tests: true,
    VSTS: true,
    pull: true,
    langFilters: ["C#", "TypeScript", "JavaScript"],
    excludeDirs: ["node_modules", "bin", "obj", "dist"],
    outputDirectory: "~/Desktop/stats-output"
};

async function analyzeCode() {
    const ADOTools = ADOToolsModule(tfsOpts);
    const results = await ADOTools.codeStats(statsOpts);
    console.log("Code analysis complete!");
    console.table(results);
}

analyzeCode();
```

#### Example 3: Platform-Specific Analysis

```javascript
const ADOToolsModule = require("tftools");

const tfsOpts = {
    ADO_HOST: "https://dev.azure.com/contoso",
    PAT: process.env.ADO_PAT
};

async function analyzeAndroidRepos() {
    const ADOTools = ADOToolsModule(tfsOpts);

    // Use pre-configured Android language set
    const results = await ADOTools.codeStats({
        Directory: "~/code/android-repos",
        projectId: "MobileApps",
        CLOC: true,
        Tests: true,
        langFilters: ADOTools.defaultLangs.android,
        excludeDirs: ["build", ".gradle"]
    });

    console.table(results);
}

analyzeAndroidRepos();
```

#### Example 4: Initialize and Analyze New Repositories

```javascript
const ADOToolsModule = require("tftools");

const tfsOpts = {
    ADO_HOST: "https://dev.azure.com/contoso",
    PAT: process.env.ADO_PAT
};

async function setupAndAnalyze() {
    const ADOTools = ADOToolsModule(tfsOpts);

    // First, clone all repositories
    console.log("Cloning repositories...");
    await ADOTools.initializeRepos({
        projectId: "ContosoScrum",
        targetDirectory: "~/code/new-analysis"
    });

    // Then analyze them
    console.log("Analyzing code...");
    const results = await ADOTools.codeStats({
        Directory: "~/code/new-analysis",
        projectId: "ContosoScrum",
        CLOC: true,
        Tests: true,
        VSTS: true
    });

    console.table(results);
}

setupAndAnalyze();
```

## Output Formats

### Velocity CSV Output

The velocity command generates a CSV file with the following columns:

- Team Name
- Sprint/Iteration Name
- Sprint Start Date
- Sprint End Date
- Planned Work (points or count)
- Completed Work (points or count)
- Late Work (points or count)
- Total Velocity
- Completion Percentage

### Stats Output

The stats command can generate multiple output files including:

- Code statistics CSV (lines of code by language)
- Test coverage reports
- Build results
- Combined metrics

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Related Documentation

- [Azure DevOps REST API](https://docs.microsoft.com/en-us/rest/api/azure/devops/)
- [Azure DevOps Analytics](https://docs.microsoft.com/en-us/azure/devops/report/analytics/)
- [Personal Access Tokens](https://docs.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/pats)

## Support

For issues and feature requests, please use the GitHub issue tracker.

---

**Version:** 2.0.15
