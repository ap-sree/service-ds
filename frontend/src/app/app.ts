import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CommonModule } from '@angular/common';

import { AuthService } from './services/auth.service';
import { SessionNotificationService } from './services/session-notification.service';
import { UiLayoutComponent } from './components/layout/ui-layout';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
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

  private authService = inject(AuthService);
  private sessionNotifService = inject(SessionNotificationService);
  private messageService = inject(MessageService);

  currentUser = this.authService.currentUser;

  constructor() { }

  ngOnInit() {
    this.sessionNotifService.startPolling();

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
      if ((window as any).electronAPI) {
        (window as any).electronAPI.sendNotification(notification.title, notification.body);
      } else {
        this.messageService.add({ severity: 'info', summary: `[OS Alert] ${notification.title}`, detail: notification.body });
      }
    }
  }
}
