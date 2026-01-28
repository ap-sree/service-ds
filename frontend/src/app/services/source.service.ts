import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DataSource {
    id?: number;
    name: string;
    type: 'SQL_SERVER' | 'REST_API' | 'LOCAL_COMMAND' | 'LOCAL_FILE';
    config: string; // JSON string
}

export interface SyncDefinition {
    id?: number;
    source_id: number;
    target_table_name: string;
    fetch_query: string;
    sync_mode: 'MANUAL' | 'SCHEDULED' | 'INTERVAL';
    schedule_config?: string;
    field_mapping?: string;
    last_run_at?: string;
    last_status?: string;
}

@Injectable({
    providedIn: 'root'
})
export class SourceService {
    private http = inject(HttpClient);
    private apiUrl = environment.apiUrl;

    // Data Sources
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

    // Sync Definitions
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
        return this.http.post(`${this.apiUrl}/sync/${id}`, {});
    }

    previewData(source_id: number, fetch_query: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/preview`, { source_id, fetch_query });
    }

    // Schema
    getTableSchema(tableName: string): Observable<string[]> {
        return this.http.get<string[]>(`${this.apiUrl}/schema/${tableName}`);
    }
}
