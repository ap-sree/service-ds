import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DataSource, SyncDefinition } from '../models/sync';

@Injectable({
    providedIn: 'root'
})
export class SourceService {
    private http = inject(HttpClient);
    private apiUrl = environment.apiUrl;


    getSources(): Observable<DataSource[]> {
        return this.http.get<DataSource[]>(`${this.apiUrl}/data-sources`);
    }

    createSource(source: DataSource): Observable<DataSource> {
        return this.http.post<DataSource>(`${this.apiUrl}/data-sources`, source);
    }

    deleteSource(id: number): Observable<any> {
        return this.http.delete(`${this.apiUrl}/data-sources/${id}`);
    }

    updateSource(id: number, source: DataSource): Observable<any> {
        return this.http.put(`${this.apiUrl}/data-sources/${id}`, source);
    }


    getSyncDefs(): Observable<SyncDefinition[]> {
        return this.http.get<SyncDefinition[]>(`${this.apiUrl}/sync-defs`);
    }

    createSyncDef(def: SyncDefinition): Observable<SyncDefinition> {
        return this.http.post<SyncDefinition>(`${this.apiUrl}/sync-defs`, def);
    }

    updateSyncDef(id: number, def: SyncDefinition): Observable<any> {
        return this.http.put(`${this.apiUrl}/sync-defs/${id}`, def);
    }

    deleteSyncDef(id: number): Observable<any> {
        return this.http.delete(`${this.apiUrl}/sync-defs/${id}`);
    }

    triggerSync(id: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/sync-defs/sync/${id}`, {});
    }

    previewData(sourceId: number, fetchQuery: string, method?: string, body?: any, rootPath?: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/sync-defs/preview`, {
            source_id: sourceId,
            fetch_query: fetchQuery,
            method: method,
            body: body,
            root_path: rootPath
        });
    }


    getWidgetSchema(widgetId: number): Observable<string[]> {
        return this.http.get<string[]>(`${this.apiUrl}/widgets/${widgetId}/schema`);
    }

    getSyncSchema(syncId: number): Observable<string[]> {
        return this.http.get<string[]>(`${this.apiUrl}/sync-defs/${syncId}/schema`);
    }
}
