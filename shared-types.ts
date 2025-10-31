// Shared interfaces used across multiple modules

export interface Repository {
    id: string;
    name?: string;
    remoteUrl: string;
    project: {
        id: string;
    };
    [key: string]: any;
}

export interface TestRun {
    passedTests?: number;
    unanalyzedTests?: number;
    notApplicableTests?: number;
}

export interface TestRunData {
    passing: number;
    failing: number;
    skipped?: number;
}

export interface BuildOptions {
    Directory: string;
    endDate: Date;
    [key: string]: any;
}

export interface InitializeOptions {
    TOP_DIRECTORY: string;
    repo_list: string[];
    [key: string]: any;
}

export interface StatsOptions {
    Directory: string;
    outputDirectory: string;
    EndDate: Date;
    dates?: string[];
    VSTS?: boolean;
    CLOC?: boolean;
    Tests?: boolean;
    build?: boolean;
    pull?: boolean;
    langFilters?: string[];
    excludeDirs?: string[];
    [key: string]: any;
}

export interface VelocityOptions {
    projectId: string;
    outFile: string;
    count: number;
    include?: string[];
    exclude?: string[];
    effortWord?: string;
    aggregate?: string;
    extraPlannedDays?: number;
    lateAfterDays?: number;
    overWrite?: boolean;
}
