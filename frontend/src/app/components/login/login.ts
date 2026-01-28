import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../services/auth.service';

import { CheckboxModule } from 'primeng/checkbox';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, FormsModule, CardModule, InputTextModule, ButtonModule, CheckboxModule],
    templateUrl: './login.html',
    styleUrl: './login.scss'
})
export class LoginComponent {
    username = '';
    loading = false;
    error = '';
    private authService = inject(AuthService);

    ngOnInit() {
        // Clear session when visiting login page to prevent layout wrapper from showing
        this.authService.currentUser.set(null);
        sessionStorage.removeItem('currentUser');
    }

    login() {
        if (!this.username.trim()) return;

        this.loading = true;
        this.error = '';

        this.authService.login(this.username).subscribe({
            next: () => {
                this.loading = false;
            },
            error: (err) => {
                this.error = 'Login Failed';
                this.loading = false;
            }
        });
    }
}
