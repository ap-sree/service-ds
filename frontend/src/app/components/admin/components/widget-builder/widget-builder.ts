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
import { WidgetDialogComponent } from './widget-dialog';
import { DashboardService, WidgetDefinition } from '../../../../services/dashboard.service';

import { TagModule } from 'primeng/tag';

import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

@Component({
    selector: 'app-widget-builder',
    standalone: true,
    imports: [
        CommonModule,
        CardModule, ButtonModule, TableModule, InputTextModule, TooltipModule, ConfirmDialogModule, TagModule,
        IconFieldModule, InputIconModule
    ],
    providers: [DialogService, ConfirmationService],
    templateUrl: './widget-builder.html',
    styles: [`
    .full-width { width: 100%; }
  `]
})
export class WidgetBuilderComponent implements OnInit {
    private dashboardService = inject(DashboardService);
    private messageService = inject(MessageService);
    private dialogService = inject(DialogService);
    private confirmationService = inject(ConfirmationService);

    dataSource: WidgetDefinition[] = [];

    ngOnInit() {
        this.loadData();
    }

    loadData() {
        this.dashboardService.getAllWidgets().subscribe({
            next: (data) => {
                this.dataSource = data;
            },
            error: (err) => this.showMsg('error', 'Failed to load Widgets')
        });
    }

    openDialog(widget?: WidgetDefinition) {
        const ref = this.dialogService.open(WidgetDialogComponent, {
            header: widget ? 'Edit Widget' : 'Create Widget',
            width: '80%',
            contentStyle: { overflow: 'auto' },
            baseZIndex: 10000,
            maximizable: true,
            closable: true,
            closeOnEscape: true,
            data: { widget }
        });

        ref?.onClose.subscribe((result: any) => {
            if (result) {
                this.loadData();
                this.showMsg('success', widget ? 'Widget Updated' : 'Widget Created');
            }
        });
    }

    deleteWidget(event: Event, id: number) {
        this.confirmationService.confirm({
            target: event.target as EventTarget,
            message: 'Are you sure that you want to delete this widget?',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.dashboardService.deleteWidget(id).subscribe(() => {
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
