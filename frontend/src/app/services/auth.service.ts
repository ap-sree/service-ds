import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { User } from './user.service';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);
    private apiUrl = environment.apiUrl;

    // Signals for reactive state
    currentUser = signal<User | null>(null);

    constructor() {
        // Try to restore session from sessionStorage
        const storedUser = sessionStorage.getItem('currentUser');
        if (storedUser) {
            this.currentUser.set(JSON.parse(storedUser));
        }
    }

    login(username: string): Observable<User> {
        return this.http.post<User>(`${this.apiUrl}/auth/login`, { username }).pipe(
            tap(user => {
                this.currentUser.set(user);
                sessionStorage.setItem('currentUser', JSON.stringify(user));
                this.router.navigate(['/dashboard']);
            })
        );
    }

    logout() {
        this.currentUser.set(null);
        sessionStorage.removeItem('currentUser');
        this.router.navigate(['/login']);
    }

    isAdmin(): boolean {
        return this.currentUser()?.role === 'ADMIN';
    }

    getUsername(): string {
        return this.currentUser()?.username || '';
    }
}
