declare module 'expand-home-dir' {
    function expandHomeDir(path: string): string;
    export = expandHomeDir;
}

declare module 'tiny-async-pool' {
    function asyncPool<T, R>(
        poolLimit: number,
        array: T[],
        iteratorFn: (item: T, array: T[]) => Promise<R>
    ): Promise<R[]>;
    export = asyncPool;
}

declare module 'json2csv' {
    export interface Json2CsvOptions {
        fields?: any[];
        header?: boolean;
    }

    export function parse(data: any, options?: Json2CsvOptions): string;
}
