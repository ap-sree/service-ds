import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { DialogModule } from 'primeng/dialog';
import { SyncJobDialogComponent } from './sync-job-dialog';
import { SourceService } from '../../../../services/source';
import { SyncDefinition, TaskExecution } from '../../../../models/sync';

import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

@Component({
    selector: 'app-sync-job-config',
    standalone: true,
    imports: [
        CommonModule,
        CardModule, ButtonModule, TableModule, InputTextModule, TooltipModule, ConfirmDialogModule,
        IconFieldModule, InputIconModule, DialogModule
    ],
    providers: [DialogService, ConfirmationService],
    templateUrl: './sync-job-config.html',
    styles: [`
    .full-width { width: 100%; }
  `]
})
export class SyncJobConfigComponent implements OnInit {
    private sourceService = inject(SourceService);
    private messageService = inject(MessageService);
    private dialogService = inject(DialogService);
    private confirmationService = inject(ConfirmationService);

    dataSource: SyncDefinition[] = [];

    loadingJobs = new Set<number>();
    
    displayHistoryDialog = false;
    historyData: TaskExecution[] = [];
    loadingHistory = false;

    ngOnInit() {
        this.loadData();
    }

    loadData() {
        this.sourceService.getSyncDefs().subscribe({
            next: (data) => {
                this.dataSource = data;
            },
            error: (err) => this.showMsg('error', 'Failed to load Sync Jobs')
        });
    }

    openDialog(job?: SyncDefinition) {
        const ref = this.dialogService.open(SyncJobDialogComponent, {
            header: job ? 'Edit Job' : 'Create Job',
            width: '70vw',
            contentStyle: { overflow: 'auto' },
            baseZIndex: 10000,
            maximizable: true,
            closable: true,
            closeOnEscape: true,
            data: {
                job,
                existingTables: this.dataSource.map(d => d.targetTableName)
            }
        });

        ref?.onClose.subscribe((result: any) => {
            if (result) {
                this.loadData();
                this.showMsg('success', job ? 'Job Updated' : 'Job Created');
            }
        });
    }

    triggerSync(id: number) {
        this.loadingJobs.add(id);
        this.showMsg('info', 'Triggering Sync...');
        this.sourceService.triggerSync(id).subscribe({
            next: () => {
                this.loadingJobs.delete(id);
                this.showMsg('success', 'Sync Completed');
                this.loadData();
            },
            error: (err) => {
                this.loadingJobs.delete(id);
                this.showMsg('error', 'Failed: ' + err.message);
            }
        });
    }

    deleteSync(event: Event, id: number) {
        this.confirmationService.confirm({
            target: event.target as EventTarget,
            message: 'Are you sure? This will DELETE ALL related Widgets, Rules, and Data Tables!',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.sourceService.deleteSyncDef(id).subscribe({
                    next: () => {
                        this.showMsg('info', 'Deleted');
                        this.loadData();
                    },
                    error: (err) => {
                        this.showMsg('error', 'Failed to delete: ' + (err.error?.message || err.message));
                    }
                });
            }
        });
    }

    showMsg(severity: string, summary: string) {
        this.messageService.add({ severity, summary, detail: summary });
    }

    showHistory(id: number) {
        this.displayHistoryDialog = true;
        this.loadingHistory = true;
        this.historyData = [];
        this.sourceService.getSyncHistory(id).subscribe({
            next: (data) => {
                this.historyData = data;
                this.loadingHistory = false;
            },
            error: (err) => {
                this.showMsg('error', 'Failed to load history');
                this.loadingHistory = false;
            }
        });
    }
}
