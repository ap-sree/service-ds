import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';
import { AutomationService } from '../../../services/automation';
import { TaskDefinition } from '../../../models/automation';
import { TaskEditorComponent } from '../task-editor/task-editor';
@Component({
    selector: 'app-automation-list',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        TableModule,
        ButtonModule,
        CardModule,
        TagModule,
        ConfirmDialogModule,
        ToastModule,
        IconFieldModule,
        InputIconModule,
        InputTextModule,
        TooltipModule,
        DialogModule,
        FormsModule
    ],
    providers: [ConfirmationService, MessageService, DialogService],
    templateUrl: './automation-list.html',
    styleUrls: ['./automation-list.scss']
})
export class AutomationListComponent implements OnInit {
    tasks: TaskDefinition[] = [];
    loading = false;

    private service = inject(AutomationService);

    private confirmationService = inject(ConfirmationService);

    private messageService = inject(MessageService);

    private dialogService = inject(DialogService);
    ngOnInit() {
        this.loadTasks();
    }
    loadTasks() {
        this.loading = true;
        this.service.getTasks().subscribe({
            next: (data) => {
                this.tasks = data;
                this.loading = false;
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load tasks' });
                this.loading = false;
            }
        });
    }
    openTaskDialog(taskId?: number) {
        const ref = this.dialogService.open(TaskEditorComponent, {
            header: taskId ? 'Edit Task' : 'New Task',
            width: '70vw',
            contentStyle: { overflow: 'auto' },
            baseZIndex: 10000,
            maximizable: true,
            closable: true,
            closeOnEscape: true,
            data: {
                taskId: taskId
            }
        });
        ref?.onClose.subscribe((result) => {
            this.loadTasks();
        });
    }
    displayRuntimeParamsDialog = false;
    runtimeParams: string[] = [];
    runtimeValues: any = {};
    pendingTask: TaskDefinition | null = null;
    runTask(task: TaskDefinition) {
        if (!task.id) return;
        const payloadStr = task.payload || '';
        const regex = /{{(.*?)}}/g;
        const matches = new Set<string>();
        let match;
        while ((match = regex.exec(payloadStr)) !== null) {
            matches.add(match[1]);
        }
        if (matches.size > 0) {
            this.pendingTask = task;
            this.runtimeParams = Array.from(matches);
            this.runtimeValues = {};
            this.runtimeParams.forEach(p => this.runtimeValues[p] = '');
            this.displayRuntimeParamsDialog = true;
        } else {
            this.executeTaskService(task.id, null);
        }
    }
    runWithParams() {
        if (this.pendingTask && this.pendingTask.id) {
            this.displayRuntimeParamsDialog = false;
            this.executeTaskService(this.pendingTask.id, this.runtimeValues);
            this.pendingTask = null;
        }
    }
    displayResultDialog = false;
    executionResult: any = null;

    executeTaskService(taskId: number, params: any) {
        this.messageService.add({ severity: 'info', summary: 'Running', detail: `Starting task...` });
        this.service.executeTask(taskId, params).subscribe({
            next: (execution) => {
                this.executionResult = execution;
                this.displayResultDialog = true;
                this.messageService.add({
                    severity: execution.status === 'SUCCESS' ? 'success' : 'error',
                    summary: 'Execution Complete',
                    detail: `Status: ${execution.status}`
                });
                this.loadTasks();
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: 'Execution Failed', detail: err.message });
            }
        });
    }
    deleteTask(task: TaskDefinition) {
        this.confirmationService.confirm({
            message: `Are you sure you want to delete "${task.name}"?`,
            accept: () => {
                if (task.id) {
                    this.service.deleteTask(task.id).subscribe({
                        next: () => {
                            this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Task deleted' });
                            this.loadTasks();
                        },
                        error: (err) => {
                            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete task: ' + err.message });
                        }
                    });
                }
            }
        });
    }
    getSeverity(status: string | undefined): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | undefined {
        if (!status) return 'secondary';
        switch (status.toUpperCase()) {
            case 'SUCCESS': return 'success';
            case 'FAILED': return 'danger';
            case 'RUNNING': return 'info';
            default: return 'secondary';
        }
    }
}
