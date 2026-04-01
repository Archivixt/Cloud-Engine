declare module 'sql.js' {
  interface SqlJsStatic {
    Database: typeof Database;
  }

  interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  class Database {
    constructor(data?: ArrayLike<number>);
    run(sql: string, params?: any[]): Database;
    exec(sql: string, params?: any[]): QueryExecResult[];
    export(): Uint8Array;
    getRowsModified(): number;
    close(): void;
  }

  interface SqlJsConfig {
    locateFile?: (filename: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
  export { Database, SqlJsStatic, QueryExecResult };
}
