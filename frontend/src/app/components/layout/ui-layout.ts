import { Component, inject, computed, input, output, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
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
        CommonModule,
        RouterLink,
        RouterLinkActive,
        ButtonModule,
        RippleModule,
        MenuModule
    ],
    templateUrl: './ui-layout.html',
    styleUrl: './ui-layout.scss'
})
export class UiLayoutComponent implements OnInit {
    authService = inject(AuthService);
    sessionNotifService = inject(SessionNotificationService);

    currentUser = input<any>();
    isAdmin = input<boolean>(false);
    logout = output<void>();

    get isAuthenticated() {
        return this.authService.isAuthenticated;
    }

    mobileMenuVisible = false;
    userMenuItems: MenuItem[] = [];

    menuSections = [
        {
            items: [
                { label: 'Dashboard', icon: 'pi pi-home', routerLink: '/dashboard', routerLinkActiveOptions: { exact: true } }
            ],
            expanded: true
        },
        {
            title: 'Utilities',
            expanded: true,
            items: [
                { label: 'Form Builder', icon: 'pi pi-file-edit', routerLink: '/form-builder', routerLinkActiveOptions: { exact: false } },
                { label: 'Automation', icon: 'pi pi-bolt', routerLink: '/automation', routerLinkActiveOptions: { exact: false } },
                { label: 'Kubernetes', icon: 'pi pi-server', routerLink: '/k8s', routerLinkActiveOptions: { exact: false } },
                { label: 'Policy Visualizer', icon: 'pi pi-sitemap', routerLink: '/policy-visualizer', routerLinkActiveOptions: { exact: false } },
                { label: 'Policy Comparison', icon: 'pi pi-clone', routerLink: '/policy-comparison', routerLinkActiveOptions: { exact: false } }
            ]
        },
        {
            title: 'Experiment',
            expanded: true,
            items: [
                { label: 'Natural Language', icon: 'pi pi-bolt', routerLink: '/nlp', routerLinkActiveOptions: { exact: false } }
            ]
        },
        {
            title: 'Administration',
            expanded: false,
            isAdminOnly: true,
            items: [
                { label: 'Data Sources', icon: 'pi pi-database', routerLink: '/admin/data-sources', routerLinkActiveOptions: { exact: false } },
                { label: 'Sync Jobs', icon: 'pi pi-sync', routerLink: '/admin/sync-jobs', routerLinkActiveOptions: { exact: false } },
                { label: 'Widgets', icon: 'pi pi-th-large', routerLink: '/admin/widgets', routerLinkActiveOptions: { exact: false } },
                { label: 'Notification Rules', icon: 'pi pi-bell', routerLink: '/admin/notifications', routerLinkActiveOptions: { exact: false } },
                { label: 'Users', icon: 'pi pi-users', routerLink: '/admin/users', routerLinkActiveOptions: { exact: false } },
                { label: 'Certificates', icon: 'pi pi-lock', routerLink: '/admin/certificates', routerLinkActiveOptions: { exact: false } }
            ]
        }
    ];

    ngOnInit() {
        this.userMenuItems = [
            { label: 'Logout', icon: 'pi pi-power-off', command: () => this.logout.emit() }
        ];
    }

    toggleMobileMenu() {
        this.mobileMenuVisible = !this.mobileMenuVisible;
    }

    toggleSection(section: any) {
        section.expanded = !section.expanded;
    }

    notifications = this.sessionNotifService.notifications;
    unreadCount = computed(() => this.notifications().length);

    removeNotification(index: number) {
        this.sessionNotifService.remove(index);
    }
}
