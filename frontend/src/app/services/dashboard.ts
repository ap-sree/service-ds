import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MetricConfig {
    label: string;
    operation: string;
    column: string;
    condition?: string;
}

export interface StatusRule {
    value: string;
    color: string;
}

export interface QueryConfig {
    globalFilter?: string;
    columns?: string[];
    labelColumn?: string;
    statusColumn?: string;
    rules?: StatusRule[];
    metrics?: MetricConfig[];
}

export interface WidgetDefinition {
    id?: number;
    title: string;
    type: 'CARD' | 'TABLE' | 'GRID' | 'STATUS_GRID' | 'MULTI_METRIC';
    dataSourceTable: string;
    refreshInterval?: number;
    queryConfig?: string | QueryConfig;
    userColumn?: string;
    settings?: string;
    schemaChanged?: boolean;
}

export interface WidgetSummary {
    id: number;
    title: string;
    type: string;
    schemaChanged?: boolean;
}

export interface DashboardConfig {
    widgets: WidgetSummary[];
    refreshInterval?: number;
    layout?: number[];
}

export interface WidgetDataResponse {
    type: string;
    count?: number;
    items?: any[];
    label?: string;
    limit?: number;
}

@Injectable({
    providedIn: 'root'
})
export class DashboardService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = environment.apiUrl;



    createWidget(widget: WidgetDefinition): Observable<WidgetDefinition> {
        return this.http.post<WidgetDefinition>(`${this.apiUrl}/widgets`, widget);
    }

    deleteWidget(id: number): Observable<any> {
        return this.http.delete(`${this.apiUrl}/widgets/${id}`);
    }

    updateWidget(id: number, widget: WidgetDefinition): Observable<any> {
        return this.http.put(`${this.apiUrl}/widgets/${id}`, widget);
    }


    getWidgets(): Observable<DashboardConfig> {
        return this.http.get<DashboardConfig>(`${this.apiUrl}/widgets`);
    }


    getWidgetCatalog(): Observable<WidgetDefinition[]> {
        return this.http.get<WidgetDefinition[]>(`${this.apiUrl}/widgets/catalog`);
    }


    getAllWidgets(): Observable<WidgetDefinition[]> {
        return this.http.get<WidgetDefinition[]>(`${this.apiUrl}/widgets/admin`);
    }


    getWidgetData(widgetId: number): Observable<WidgetDataResponse> {
        return this.http.get<WidgetDataResponse>(`${this.apiUrl}/widgets/${widgetId}/data`);
    }


    getData(tableName: string, limit: number = 10000): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/data/${tableName}?limit=${limit}`);
    }


    getLayout(userId: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/dashboard-layout/${userId}`);
    }

    saveLayout(userId: string, widgetIds: number[]): Observable<any> {
        return this.http.post(`${this.apiUrl}/dashboard-layout/${userId}`, { widgetIds });
    }
}
