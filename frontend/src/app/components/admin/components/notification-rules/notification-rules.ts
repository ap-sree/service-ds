import { Component, OnInit, inject } from '@angular/core';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { NotificationRuleDialogComponent } from './notification-rule-dialog';
import { NotificationRuleService } from '../../../../services/notification-rule';
import { NotificationRule, NotificationCondition } from '../../../../models/notification';

import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

@Component({
    selector: 'app-notification-rules',
    standalone: true,
    imports: [
        CardModule,
        ButtonModule,
        TableModule,
        InputTextModule,
        TooltipModule,
        TagModule,
        ConfirmDialogModule,
        IconFieldModule,
        InputIconModule
    ],
    providers: [DialogService, ConfirmationService],
    templateUrl: './notification-rules.html',
    styles: [`
    .full-width { width: 100%; }
    .code-badge { background: #f0f0f0; padding: 2px 4px; border-radius: 4px; font-family: monospace; }
  `]
})
export class NotificationRulesComponent implements OnInit {
    private notificationRuleService = inject(NotificationRuleService);
    private messageService = inject(MessageService);
    private dialogService = inject(DialogService);
    private confirmationService = inject(ConfirmationService);

    dataSource: NotificationRule[] = [];

    ngOnInit() {
        this.loadData();
    }

    loadData() {
        this.notificationRuleService.getRules().subscribe({
            next: (data) => {
                this.dataSource = data;
            },
            error: (err) => this.showMsg('error', 'Failed to load Rules')
        });
    }

    openDialog(rule?: NotificationRule) {
        const ref = this.dialogService.open(NotificationRuleDialogComponent, {
            header: rule ? 'Edit Rule' : 'Create Rule',
            width: '80%',
            contentStyle: { overflow: 'auto' },
            baseZIndex: 10000,
            maximizable: true,
            closable: true,
            closeOnEscape: true,
            data: { rule }
        });

        ref?.onClose.subscribe((result: any) => {
            if (result) {
                this.loadData();
                this.showMsg('success', rule ? 'Rule Updated' : 'Rule Created');
            }
        });
    }

    deleteRule(event: Event, id: number) {
        this.confirmationService.confirm({
            target: event.target as EventTarget,
            message: 'Are you sure that you want to delete this notification rule?',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.notificationRuleService.deleteRule(id).subscribe({
                    next: () => {
                        this.showMsg('info', 'Deleted');
                        this.loadData();
                    },
                    error: (err) => {
                        this.showMsg('error', 'Failed to delete rule');
                    }
                });
            }
        });
    }

    showMsg(severity: string, summary: string) {
        this.messageService.add({ severity, summary, detail: summary });
    }

    formatCondition(c: NotificationCondition): string {
        if (!c) return '';
        const op = c.operation || 'COUNT';
        const col = c.column || '*';
        const thOp = c.thresholdOperator || '>';
        const thVal = c.thresholdValue || 0;
        const cond = c.condition ? ` WHERE ${c.condition}` : '';
        return `${op}(${col}) ${thOp} ${thVal}${cond}`;
    }
}
