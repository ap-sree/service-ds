import { Component, inject, computed, Input, Output, EventEmitter, OnInit } from '@angular/core';

import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';

import { AuthService } from '../../auth/auth';
import { SessionNotificationService } from '../../services/session-notification';

@Component({
    selector: 'app-ui-layout',
    standalone: true,
    imports: [
        RouterLink,
        RouterLinkActive,
        ButtonModule,
        RippleModule,
        MenuModule
    ],
    templateUrl: './ui-layout.html',
    styles: [`
    :host {
        display: block;
        height: 100vh;
        overflow: hidden;
        --sidebar-width: 260px;
        --topbar-height: 50px;
        --bg-body: #f7f8fa;
        --bg-sidebar: #fff;
    }

    .layout-wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--bg-body);
    }

    /* Top Bar */
    .topbar {
        height: var(--topbar-height);
        background: #fff;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 1.5rem;
        border-bottom: 1px solid rgba(0,0,0,0.06);
        z-index: 1000;
    }
    .brand-text {
        font-family: 'Roboto', "Helvetica Neue", sans-serif;
        font-size: 1.25rem;
        font-weight: 500; /* Regular weight like screenshot */
        color: #222;
        letter-spacing: -0.5px;
    }

    /* Layout Body */
    .layout-body {
        display: flex;
        flex: 1;
        overflow: hidden;
        position: relative;
    }

    /* Sidebar */
    .sidebar-container {
        width: var(--sidebar-width);
        background: var(--bg-sidebar);
        border-right: 1px solid transparent; 
        /* Screenshot has no visible border, maybe whitespace separation. We can add subtle one if needed */
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        padding-top: 2rem;
        padding-bottom: 2rem;
    }
    
    .sidebar-content {
        padding: 0 1rem;
    }

    .nav-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .nav-header {
        font-size: 0.8em;
        font-weight: 600;
        color: #999;
        text-transform: uppercase;
        margin: 1.5rem 0 0.5rem 0.75rem;
    }

    .separator {
        height: 1px;
        background-color: #eee;
        margin: 1rem 0;
    }

    .nav-item {
        display: flex;
        align-items: center;
        padding: 0.75rem 1rem;
        border-radius: 6px;
        color: #444;
        text-decoration: none;
        transition: all 0.2s;
        font-weight: 400;
        cursor: pointer;
    }

    .nav-item i {
        margin-right: 12px;
        font-size: 1.1rem;
        color: #666;
    }

    .nav-item:hover {
        background-color: #f0f0f0;
        color: #222;
    }

    .nav-item.active-item {
        background-color: #e5e5e5; /* Distinct gray background */
        color: #000;
        font-weight: 500;
    }
    .nav-item.active-item i {
        color: #000;
    }

    /* Main Content */
    .main-content {
        flex: 1;
        overflow-y: auto;
        padding: 0; /* Removing padding from wrapper to allow full-width components (e.g. Form Builder) */
        display: flex;
        flex-direction: column;
    }

    .content-container {
        flex: 1;
        padding: 0; /* padding handled by pages */
        max-width: 100%;
        margin: 0 auto;
        width: 100%;
    }
    
    /* Allow full width/height for complex modules */
    :host ::ng-deep app-form-builder {
        display: block;
        height: 100%;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
        .sidebar-container {
            position: absolute;
            left: -100%;
            top: 0;
            bottom: 0;
            z-index: 999;
            transition: left 0.3s;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .sidebar-container.mobile-visible {
            left: 0;
        }
        .main-content {
            padding: 1rem;
        }
    }
    `]
})
export class UiLayoutComponent implements OnInit {
    authService = inject(AuthService);
    sessionNotifService = inject(SessionNotificationService);

    @Input() currentUser: any;
    @Input() isAdmin: boolean = false;
    @Output() logout = new EventEmitter<void>();

    mobileMenuVisible = false;
    userMenuItems: MenuItem[] = [];

    ngOnInit() {
        this.userMenuItems = [
            { label: 'Logout', icon: 'pi pi-power-off', command: () => this.logout.emit() }
        ];
    }

    toggleMobileMenu() {
        this.mobileMenuVisible = !this.mobileMenuVisible;
    }

    notifications = this.sessionNotifService.notifications;
    unreadCount = computed(() => this.notifications().length);

    removeNotification(index: number) {
        this.sessionNotifService.remove(index);
    }
}
