import { DashboardConfig } from '../services/dashboard';

export interface UserPreferences {
    widgetIds?: number[];
    theme?: string;
    refreshInterval?: number;
}

export interface User {
    id?: string | number;
    username: string;
    role: 'ADMIN' | 'USER';
    preferences?: UserPreferences;
    dashboardConfig?: DashboardConfig;
}
