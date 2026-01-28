import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface AppNotification {
    title: string;
    body: string;
    action_type: string;
    timestamp: Date;
    severity?: string; // info, warn, error
}

@Injectable({
    providedIn: 'root'
})
export class SessionNotificationService implements OnDestroy {
    private http = inject(HttpClient);
    private authService = inject(AuthService);

    private apiUrl = environment.apiUrl;
    private pollInterval: any;

    // Reactive list of notifications for the session
    notifications = signal<AppNotification[]>([]);

    // Event stream for new notifications (for Toasts/OS alerts)
    notificationReceived$ = new Subject<AppNotification>();

    constructor() { }

    startPolling() {
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.checkNotifications(); // Immediate check
        this.pollInterval = setInterval(() => this.checkNotifications(), 10000);
    }

    stopPolling() {
        if (this.pollInterval) clearInterval(this.pollInterval);
    }

    ngOnDestroy() {
        this.stopPolling();
    }

    clearAll() {
        this.notifications.set([]);
    }

    remove(index: number) {
        this.notifications.update(current => current.filter((_, i) => i !== index));
    }

    checkNotifications() {
        const username = this.authService.getUsername();
        const url = username
            ? `${this.apiUrl}/notifications?user=${username}`
            : `${this.apiUrl}/notifications`;

        this.http.get<any[]>(url).subscribe({
            next: (notifs) => {
                if (notifs && notifs.length > 0) {
                    notifs.forEach(n => this.processNotification(n));
                }
            },
            error: () => { /* Suppress error */ }
        });
    }

    private processNotification(raw: any) {
        // Enforce timestamp
        const notif: AppNotification = {
            title: raw.title,
            body: raw.body,
            action_type: raw.action_type || 'TOAST',
            timestamp: new Date(),
            severity: 'info'
        };

        // Add to history (newest first)
        this.notifications.update(current => [notif, ...current]);

        // Emit event for UI handling
        this.notificationReceived$.next(notif);
    }
}
