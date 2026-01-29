export interface NotificationCondition {
    operation: string;
    column: string;
    condition: string;
    thresholdOperator: string;
    thresholdValue: number;
}

export interface NotificationRule {
    id?: number;
    localTableName: string;
    condition: NotificationCondition;
    actionType: 'TOAST' | 'OS_NOTIFY';
    messageTemplate: string;
    titleTemplate?: string;
    scheduleType: 'EVENT' | 'INTERVAL' | 'CRON';
    scheduleConfig?: string;
    userColumn?: string;
    targetRole?: string;
}
