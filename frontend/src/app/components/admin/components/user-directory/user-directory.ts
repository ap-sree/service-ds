import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { UserDialogComponent } from './user-dialog';
import { UserService, User } from '../../../../services/user.service';
import { AuthService } from '../../../../services/auth.service';

import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

@Component({
    selector: 'app-user-directory',
    standalone: true,
    imports: [
        CommonModule,
        CardModule, ButtonModule, TableModule, InputTextModule, TooltipModule, TagModule, ConfirmDialogModule,
        IconFieldModule, InputIconModule
    ],
    providers: [DialogService, ConfirmationService],
    templateUrl: './user-directory.html',
    styles: [`
    .full-width { width: 100%; }
  `]
})
export class UserDirectoryComponent implements OnInit {
    private userService = inject(UserService);
    private authService = inject(AuthService);
    private messageService = inject(MessageService);
    private dialogService = inject(DialogService);
    private confirmationService = inject(ConfirmationService);

    dataSource: User[] = [];
    currentUserId: string | null = null;
    // ref removed

    ngOnInit() {
        this.currentUserId = this.authService.currentUser()?.username || null;
        this.loadData();
    }

    loadData() {
        this.userService.getUsers().subscribe({
            next: (data) => {
                this.dataSource = data;
            },
            error: (err) => this.showMsg('error', 'Failed to load Users')
        });
    }

    openDialog(user?: User) {
        const ref = this.dialogService.open(UserDialogComponent, {
            header: user ? 'Edit User' : 'Create User',
            width: '70vw',
            contentStyle: { overflow: 'auto' },
            baseZIndex: 10000,
            maximizable: true,
            closable: true,
            closeOnEscape: true,
            data: { user }
        });

        ref?.onClose.subscribe((result: any) => {
            if (result) {
                this.loadData();
                this.showMsg('success', user ? 'User Updated' : 'User Created');
            }
        });
    }

    deleteUser(event: Event, username: string) {
        if (username === 'admin' || username === this.currentUserId) {
            this.showMsg('warn', 'Cannot delete admin or yourself');
            return;
        }

        this.confirmationService.confirm({
            target: event.target as EventTarget,
            message: `Are you sure that you want to delete user ${username}?`,
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.userService.deleteUser(username).subscribe(() => {
                    this.showMsg('info', 'Deleted');
                    this.loadData();
                });
            }
        });
    }

    resetUserLayout(event: Event, username: string) {
        this.confirmationService.confirm({
            target: event.target as EventTarget,
            message: `Reset layout for ${username} to global default?`,
            icon: 'pi pi-refresh',
            accept: () => {
                this.userService.resetPreferences(username).subscribe(() => {
                    this.showMsg('success', 'Layout Reset');
                    this.loadData();
                });
            }
        });
    }

    showMsg(severity: string, summary: string) {
        this.messageService.add({ severity, summary, detail: summary });
    }
}
