import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserPreferences {
    widgetIds?: number[];
    theme?: string;
}

export interface User {
    id?: string | number; // Alphanumeric ID support
    username: string;
    role: 'ADMIN' | 'USER';
    preferences?: UserPreferences;
}

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = environment.apiUrl;

    getUsers(): Observable<User[]> {
        return this.http.get<User[]>(`${this.apiUrl}/users`);
    }

    createUser(user: { username: string, role: string }): Observable<User> {
        return this.http.post<User>(`${this.apiUrl}/users`, user);
    }

    updateUser(username: string, data: any): Observable<User> {
        return this.http.put<User>(`${this.apiUrl}/users/${username}`, data);
    }

    updateRole(username: string, role: string): Observable<any> {
        return this.http.put(`${this.apiUrl}/users/${username}/role`, { role });
    }

    savePreferences(username: string, preferences: UserPreferences): Observable<any> {
        return this.http.post(`${this.apiUrl}/users/${username}/preferences`, preferences);
    }

    resetPreferences(username: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/users/${username}/preferences`, null);
    }

    getPreferences(username: string): Observable<UserPreferences> {
        return this.http.get<UserPreferences>(`${this.apiUrl}/users/${username}/preferences`);
    }

    getGlobalPreferences(): Observable<any> {
        return this.http.get(`${this.apiUrl}/config/global_dashboard_layout`);
    }

    saveGlobalPreferences(preferences: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/config`, {
            key: 'global_dashboard_layout',
            value: preferences
        });
    }

    deleteUser(username: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/users/${username}`);
    }
}
