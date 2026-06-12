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
import { TaskDefinition, TaskExecution, TaskExecutionSummary } from '../../../models/automation';
import { TaskEditorComponent } from '../task-editor/task-editor';
@Component({
    selector: 'app-automation-list',
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
            header: taskId ? 'Edit Workflow' : 'New Workflow',
            width: '60vw',
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
        const matches = new Set<string>();
        let match;
        // Only ${varName} prompts the user — {{...}} references are resolved automatically from step results
        const re = /\$\{(.*?)\}/g;
        while ((match = re.exec(payloadStr)) !== null) matches.add(match[1]);
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
    parsedExecutionResult: any = null;

    executeTaskService(taskId: number, params: any) {
        this.messageService.add({ severity: 'info', summary: 'Running', detail: `Starting task...` });
        this.service.executeTask(taskId, params).subscribe({
            next: (execution) => {
                this.executionResult = execution;
                try {
                    this.parsedExecutionResult = JSON.parse(execution.outputResult);
                } catch { this.parsedExecutionResult = null; }
                this.displayResultDialog = true;
                this.messageService.add({
                    severity: execution.status === 'SUCCESS' ? 'success' : 'error',
                    summary: 'Execution Complete',
                    detail: `Status: ${execution.status}`
                });

                if (this.parsedExecutionResult?.endTaskResult?.type === 'DOWNLOAD'
                    && this.parsedExecutionResult.endTaskResult.file) {
                    this.downloadFile(this.parsedExecutionResult.endTaskResult.file);
                }

                this.loadTasks();
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: 'Execution Failed', detail: err.message });
            }
        });
    }
    downloadFile(file: any) {
        if (!file || !file.fileContent) return;
        const blob = new Blob([file.fileContent], { type: file.format === 'CSV' ? 'text/csv' : 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.fileName || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
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
    // ── History dialog ────────────────────────────────────────────────────────
    displayHistoryDialog = false;
    historyTask: TaskDefinition | null = null;
    taskHistory: TaskExecutionSummary[] = [];   // summaries only — no LOB fields
    loadingHistory = false;

    // Execution detail — fetched on-demand via GET /executions/{id}
    displayHistoryResultDialog = false;
    historySelectedExecution: TaskExecution | null = null;
    parsedHistoryResult: any = null;
    loadingDetail = false;

    openHistoryDialog(task: TaskDefinition) {
        this.historyTask = task;
        this.taskHistory = [];
        this.loadingHistory = true;
        this.displayHistoryDialog = true;
        this.service.getTaskHistory(task.id!).subscribe({
            next: (data) => {
                this.taskHistory = data;
                this.loadingHistory = false;
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load history' });
                this.loadingHistory = false;
            }
        });
    }

    showHistoryExecution(summary: TaskExecutionSummary) {
        this.historySelectedExecution = null;
        this.parsedHistoryResult = null;
        this.loadingDetail = true;
        this.displayHistoryResultDialog = true;
        this.service.getExecution(summary.id).subscribe({
            next: (exec) => {
                this.historySelectedExecution = exec;
                try { this.parsedHistoryResult = JSON.parse(exec.outputResult); }
                catch { this.parsedHistoryResult = null; }
                this.loadingDetail = false;
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load execution detail' });
                this.loadingDetail = false;
                this.displayHistoryResultDialog = false;
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
