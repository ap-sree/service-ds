import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../auth/auth';
import { SessionNotificationService } from '../../services/session-notification';

import { CheckboxModule } from 'primeng/checkbox';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [FormsModule, CardModule, InputTextModule, ButtonModule, CheckboxModule],
    templateUrl: './login.html',
    styleUrl: './login.scss'
})
export class LoginComponent {
    username = '';
    loading = false;
    error = '';
    private authService = inject(AuthService);
    private router = inject(Router);

    ngOnInit() {
        // Clear session when visiting login page to prevent layout wrapper from showing
        this.authService.currentUser.set(null);
        sessionStorage.removeItem('currentUser');
    }

    login() {
        if (!this.username.trim()) return;

        this.loading = true;
        this.error = '';

        this.authService.syncUser(this.username).subscribe({
            next: () => {
                this.loading = false;
                this.router.navigate(['/dashboard']);
            },
            error: (err) => {
                this.error = 'Login Failed';
                this.loading = false;
            }
        });
    }

    loginWithOAuth() {
        this.authService.login();
    }
}
