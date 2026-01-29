import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationRule } from '../models/notification';

@Injectable({
    providedIn: 'root'
})
export class NotificationRuleService {
    private http = inject(HttpClient);
    private apiUrl = environment.apiUrl;

    getRules(): Observable<NotificationRule[]> {
        return this.http.get<NotificationRule[]>(`${this.apiUrl}/notification-rules`);
    }

    createRule(rule: NotificationRule): Observable<NotificationRule> {
        return this.http.post<NotificationRule>(`${this.apiUrl}/notification-rules`, rule);
    }

    updateRule(id: number, rule: NotificationRule): Observable<any> {
        return this.http.put(`${this.apiUrl}/notification-rules/${id}`, rule);
    }

    deleteRule(id: number): Observable<any> {
        return this.http.delete(`${this.apiUrl}/notification-rules/${id}`);
    }

    getPendingNotifications(username: string): Observable<any[]> {
        // Pass username query param if strict user scoping needed, or handle in backend
        return this.http.get<any[]>(`${this.apiUrl}/notifications?user=${username}`);
    }
}
