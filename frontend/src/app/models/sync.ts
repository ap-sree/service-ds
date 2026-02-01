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
    syncMode: 'MANUAL' | 'SCHEDULED' | 'INTERVAL';
    scheduleConfig?: string;
    fieldMapping?: string;
    lastRunAt?: string;
    lastStatus?: string;
}
