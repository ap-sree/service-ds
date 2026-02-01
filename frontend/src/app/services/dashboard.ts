import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WidgetDefinition {
    id?: number;
    title: string;
    type: 'CARD' | 'TABLE' | 'GRID' | 'STATUS_GRID' | 'MULTI_METRIC';
    dataSourceTable: string;
    refreshInterval?: number;
    queryConfig?: any; 
    userColumn?: string;
    settings?: string; 
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

    
    getWidgets(username: string): Observable<WidgetDefinition[]> {
        return this.http.get<WidgetDefinition[]>(`${this.apiUrl}/widgets?username=${username}`);
    }

    
    getWidgetCatalog(): Observable<WidgetDefinition[]> {
        return this.http.get<WidgetDefinition[]>(`${this.apiUrl}/widget-catalog`);
    }

    
    getAllWidgets(): Observable<WidgetDefinition[]> {
        return this.http.get<WidgetDefinition[]>(`${this.apiUrl}/admin/widgets`);
    }

    
    getWidgetData(widgetId: number, userId?: string | number): Observable<WidgetDataResponse> {
        let url = `${this.apiUrl}/widgets/${widgetId}/data`;
        if (userId) {
            url += `?userId=${userId}`;
        }
        return this.http.get<WidgetDataResponse>(url);
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
