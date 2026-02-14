import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface K8sPod {
    name: string;
    namespace: string;
    status: string;
    ip: string;
    node: string;
}

@Injectable({ providedIn: 'root' })
export class K8sService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    saveConfig(type: 'FILE' | 'TOKEN', value: string) {
        return this.http.post(`${this.apiUrl}/k8s/config`, { type, value });
    }

    getPods(namespace?: string): Observable<K8sPod[]> {
        return this.http.get<K8sPod[]>(`${this.apiUrl}/k8s/pods`, { params: { namespace: namespace || '' } });
    }
}
