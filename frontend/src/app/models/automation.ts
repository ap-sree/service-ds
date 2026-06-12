export interface TaskDefinition {
    id?: number;
    name: string;
    sourceId: number;
    payload: string;
    lastRunAt?: string;
    lastStatus?: string;
}
export interface TaskExecutionSummary {
    id: number;
    taskId: number;
    startedAt: string;
    completedAt?: string;
    status: 'RUNNING' | 'SUCCESS' | 'FAILED';
    triggeredBy?: string;
}

export interface TaskExecution extends TaskExecutionSummary {
    inputPayload: string;
    outputResult: string;
}
export interface AdHocRequest {
    source_id: number;
    payload: string;
}
