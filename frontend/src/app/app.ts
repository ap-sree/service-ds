import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';

import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';


import { AuthService } from './auth/auth';
import { SessionNotificationService } from './services/session-notification';
import { UiLayoutComponent } from './components/layout/ui-layout';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    UiLayoutComponent,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'service-dashboard';

  private readonly authService = inject(AuthService);
  private readonly sessionNotifService = inject(SessionNotificationService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  currentUser = this.authService.currentUser;

  constructor() { }

  ngOnInit() {
    this.router.initialNavigation();
    this.sessionNotifService.startPolling();

    // Sync OAuth state with App State
    if (this.authService.isAuthenticated && !this.authService.currentUser()) {
      const claims: any = this.authService.identityClaims;
      // Fallback to 'sub' or 'preferred_username' or 'username' depending on IDP
      const username = claims?.username || claims?.preferred_username || claims?.sub;
      if (username) {
        this.authService.syncUser(username).subscribe();
      }
    }

    // Subscribe to events
    this.sessionNotifService.notificationReceived$.subscribe(n => {
      this.triggerAlert(n);
    });
  }

  logout() {
    this.authService.logout();
  }

  isAdmin() {
    return this.authService.isAdmin();
  }

  ngOnDestroy() {
    this.sessionNotifService.stopPolling();
  }

  triggerAlert(notification: any) {
    const type = notification.action_type || 'TOAST';
    if (type === 'TOAST') {
      if (notification.title && notification.body) {
        this.messageService.add({ severity: 'info', summary: notification.title, detail: notification.body });
      }
    } else if (type === 'OS_NOTIFY') {
      if ((globalThis as any).electronAPI) {
        (globalThis as any).electronAPI.sendNotification(notification.title, notification.body);
      } else {
        this.messageService.add({ severity: 'info', summary: `[OS Alert] ${notification.title}`, detail: notification.body });
      }
    }
  }
}
