export interface DataSource {
    id?: number;
    name: string;
    type: 'SQL_SERVER' | 'REST_API' | 'LOCAL_COMMAND' | 'LOCAL_FILE';
    config: string;
}

export interface SyncDefinition {
    id?: number;
    sourceId: number;
    targetTableName: string;
    fetchQuery: string;
    httpMethod?: string;
    requestBody?: string;
    syncMode: 'MANUAL' | 'SCHEDULED' | 'INTERVAL';
    scheduleConfig?: string;
    fieldMapping?: string;
    syncStrategy?: string;
    primaryKey?: string;
    paginationConfig?: string;
    rootPath?: string;
    lastRunAt?: string;
    lastStatus?: string;
    schemaChanged?: boolean;
}

export interface TaskExecution {
    id: number;
    taskId: number;
    taskType: string;
    startedAt: string;
    completedAt?: string;
    status: string;
    outputResult?: string;
    triggeredBy?: string;
}
