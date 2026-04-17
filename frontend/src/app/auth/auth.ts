import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { Observable, tap } from 'rxjs';
import { User } from '../models/user';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);
    private apiUrl = environment.apiUrl;

    currentUser = signal<User | null>(null);

    private oauthService = inject(OAuthService);

    constructor() {
        const storedUser = sessionStorage.getItem('currentUser');
        if (storedUser) {
            this.currentUser.set(JSON.parse(storedUser));
        }
    }

    login() {
        this.oauthService.initCodeFlow();
    }

    logout() {
        this.currentUser.set(null);
        sessionStorage.removeItem('currentUser');
        this.oauthService.logOut(true);

        this.router.navigate(['/logout']);
    }

    fetchCurrentUser(): Observable<User> {
        return this.http.get<User>(`${this.apiUrl}/auth/me`).pipe(
            tap(user => {
                this.currentUser.set(user);
                sessionStorage.setItem('currentUser', JSON.stringify(user));
            })
        );
    }

    syncUser(username: string): Observable<User> {
        return this.fetchCurrentUser();
    }

    get isAuthenticated(): boolean {
        return this.oauthService.hasValidAccessToken();
    }

    get accessToken(): string {
        return this.oauthService.getAccessToken();
    }

    get identityClaims() {
        return this.oauthService.getIdentityClaims();
    }

    loadDiscoveryDocument() {
        return this.oauthService.loadDiscoveryDocument();
    }

    tryLogin() {
        return this.oauthService.tryLogin();
    }

    isAdmin(): boolean {
        return this.currentUser()?.role === 'ADMIN';
    }

    getUsername(): string {
        return this.currentUser()?.username || '';
    }
}
