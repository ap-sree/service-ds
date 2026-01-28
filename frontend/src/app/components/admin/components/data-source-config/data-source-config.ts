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
import { DataSourceDialogComponent } from './data-source-dialog';
import { SourceService, DataSource } from '../../../../services/source.service';

import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

@Component({
    selector: 'app-data-source-config',
    standalone: true,
    imports: [
        CommonModule,
        CardModule, ButtonModule, TableModule, InputTextModule, TooltipModule, ConfirmDialogModule,
        IconFieldModule, InputIconModule
    ],
    providers: [DialogService, ConfirmationService], // ConfirmService needed if using confirmDialog here, or use global
    templateUrl: './data-source-config.html',
    styles: [`
    .full-width { width: 100%; }
    .spacer { flex: 1 1 auto; }
  `]
})
export class DataSourceConfigComponent implements OnInit {
    private sourceService = inject(SourceService);
    private messageService = inject(MessageService);
    private dialogService = inject(DialogService);
    private confirmationService = inject(ConfirmationService);

    dataSource: DataSource[] = [];

    ngOnInit() {
        this.loadData();
    }

    loadData() {
        this.sourceService.getSources().subscribe({
            next: (data) => {
                this.dataSource = data;
            },
            error: (err) => this.showMsg('error', 'Failed to load Sources: ' + err.message)
        });
    }

    openDialog(config?: DataSource) { // Changed parameter name from source to config, type remains DataSource as DataSourceConfig is not defined
        const ref = this.dialogService.open(DataSourceDialogComponent, {
            header: config ? 'Edit Data Source' : 'Add Data Source',
            width: '70vw',
            contentStyle: { overflow: 'auto' },
            baseZIndex: 10000,
            maximizable: true,
            closable: true,
            closeOnEscape: true,
            data: { config }
        });

        ref?.onClose.subscribe((result: any) => {
            if (result) {
                this.loadData();
                this.showMsg('success', config ? 'Updated' : 'Created');
            }
        });
    }

    deleteSource(event: Event, id: number) {
        this.confirmationService.confirm({
            target: event.target as EventTarget,
            message: 'Are you sure? This will DELETE ALL related Sync Jobs, Widgets, and Rules!',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.sourceService.deleteSource(id).subscribe(() => {
                    this.showMsg('info', 'Deleted');
                    this.loadData();
                });
            }
        });
    }

    showMsg(severity: string, summary: string) {
        this.messageService.add({ severity, summary, detail: summary });
    }
}
