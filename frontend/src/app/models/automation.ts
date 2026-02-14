export interface TaskDefinition {
    id?: number;
    name: string;
    sourceId: number;
    payload: string; 
    lastRunAt?: string;
    lastStatus?: string;
}
export interface TaskExecution {
    id: number;
    taskId: number;
    startedAt: string;
    completedAt?: string;
    status: 'RUNNING' | 'SUCCESS' | 'FAILED';
    inputPayload: string;
    outputResult: string;
    triggeredBy?: string;
}
export interface AdHocRequest {
    source_id: number;
    payload: string;
}
