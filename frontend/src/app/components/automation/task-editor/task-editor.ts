import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { AutomationService } from '../../../services/automation';
import { SourceService } from '../../../services/source';
import { TaskDefinition, TaskExecution } from '../../../models/automation';
import { DataSource } from '../../../models/sync';
@Component({
    selector: 'app-task-editor',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        ButtonModule,
        InputTextModule,
        TextareaModule,
        SelectModule,
        TabsModule,
        TableModule,
        TagModule,
        TooltipModule,
        TooltipModule,
        ToastModule,
        DialogModule
    ],
    templateUrl: './task-editor.html',
    styleUrls: ['./task-editor.scss']
})
export class TaskEditorComponent implements OnInit {
    taskForm: FormGroup;
    mappingRows: FormArray;
    sources: DataSource[] = [];
    history: TaskExecution[] = [];
    isNew = true;
    loadingHistory = false;
    currentTaskId: number | null = null;
    selectedExecution: TaskExecution | null = null;
    availablePaths: any[] = [];
    previewRows: any[] = [];
    queryHint = 'Enter query or command';

    private service = inject(AutomationService);

    private sourceService = inject(SourceService);

    private messageService = inject(MessageService);

    private fb = inject(FormBuilder);

    public ref = inject(DynamicDialogRef);

    public config = inject(DynamicDialogConfig);
    httpMethods = [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
        { label: 'DELETE', value: 'DELETE' }
    ];
    showMethodDropdown = false;
    paginationOptions = [
        { label: 'None', value: 'NONE' },
        { label: 'Page Number (e.g. page=1)', value: 'PAGE' },
        { label: 'Next Link in Response Body (e.g. MS Graph @odata.nextLink)', value: 'NEXT_LINK_BODY' }
    ];
    constructor() {
        this.mappingRows = this.fb.array([]);
        this.taskForm = this.fb.group({
            name: ['', Validators.required],
            sourceId: [null, Validators.required],
            fetchQuery: [''],
            httpMethod: ['GET'],
            rootPath: [''],
            body: [''],
            bodyType: ['form'],
            paginationType: ['NONE'],
            paginationNextKey: [''],
            paginationLimitParam: [''],
            paginationLimit: [''],
            bodyParams: this.fb.array([]),
            mappingRows: this.mappingRows
        });
        this.taskForm.get('mappingRows')?.valueChanges.subscribe(() => {
        });
    }
    get bodyParams() {
        return (this.taskForm.get('bodyParams') as FormArray).controls;
    }
    addBodyParam(key: string = '', value: string = '', type: 'static' | 'dynamic' = 'static') {
        const arr = this.taskForm.get('bodyParams') as FormArray;
        arr.push(this.fb.group({
            key: [key, Validators.required],
            value: [value],
            type: [type]
        }));
    }
    removeBodyParam(index: number) {
        (this.taskForm.get('bodyParams') as FormArray).removeAt(index);
    }
    ngOnInit() {
        this.loadSources();
        if (this.config.data?.taskId) {
            this.isNew = false;
            this.currentTaskId = this.config.data.taskId;
            this.loadTask(this.currentTaskId!);
            this.loadHistory(this.currentTaskId!);
        }
    }
    loadSources() {
        this.sourceService.getSources().subscribe(data => this.sources = data);
    }
    loadTask(id: number) {
        this.service.getTasks().subscribe(tasks => {
            const found = tasks.find(t => t.id === id);
            if (found) {
                let payloadObj: any = {};
                try {
                    payloadObj = JSON.parse(found.payload);
                } catch (e) {
                    console.error('Invalid JSON payload', e);
                }
                this.taskForm.patchValue({
                    name: found.name,
                    sourceId: found.sourceId,
                    fetchQuery: payloadObj.fetch_query || '',
                    httpMethod: payloadObj.method || 'GET',
                    rootPath: payloadObj.root_path || '',
                    body: payloadObj.body ? JSON.stringify(payloadObj.body, null, 2) : '',
                    bodyType: 'json',
                    paginationType: payloadObj.pagination_config?.type || 'NONE',
                    paginationNextKey: payloadObj.pagination_config?.nextKey || '',
                    paginationLimitParam: payloadObj.pagination_config?.limitParam || '',
                    paginationLimit: payloadObj.pagination_config?.limit || ''
                });
                if (payloadObj.body) {
                    this.parseBodyToForm(payloadObj.body);
                }
                this.onSourceChange();
                this.mappingRows.clear();
                if (payloadObj.mapping) {
                    Object.keys(payloadObj.mapping).forEach(key => {
                        this.addMappingRow(key, payloadObj.mapping[key]);
                    });
                }
            }
        });
    }
    parseBodyToForm(bodyObj: any) {
        const arr = this.taskForm.get('bodyParams') as FormArray;
        arr.clear();
        if (typeof bodyObj === 'object' && bodyObj !== null) {
            Object.keys(bodyObj).forEach(key => {
                const val = bodyObj[key];
                let type: 'static' | 'dynamic' = 'static';
                let value = val;
                if (typeof val === 'string' && val.trim().startsWith('{{') && val.trim().endsWith('}}')) {
                    type = 'dynamic';
                    value = val.trim().substring(2, val.trim().length - 2);
                }
                this.addBodyParam(key, value, type);
            });
            this.taskForm.patchValue({ bodyType: 'form' });
        } else {
            this.taskForm.patchValue({ bodyType: 'json' });
        }
    }
    buildBodyFromForm(): any {
        const params = this.taskForm.value.bodyParams;
        const body: any = {};
        params.forEach((p: any) => {
            if (p.key) {
                if (p.type === 'dynamic') {
                    body[p.key] = `{{${p.value}}}`;
                } else {
                    body[p.key] = p.value;
                }
            }
        });
        return body;
    }
    loadHistory(taskId: number) {
        this.loadingHistory = true;
        this.service.getTaskHistory(taskId).subscribe({
            next: (data) => {
                this.history = data;
                this.loadingHistory = false;
            },
            error: () => this.loadingHistory = false
        });
    }
    save() {
        if (this.taskForm.invalid) {
            this.messageService.add({ severity: 'warn', summary: 'Invalid', detail: 'Name and Source are required' });
            return;
        }
        const val = this.taskForm.value;
        const mapping: any = {};
        val.mappingRows.forEach((row: any) => {
            if (row.target && row.source) {
                mapping[row.target] = row.source;
            }
        });
        let bodyJson = null;
        if (val.bodyType === 'form') {
            bodyJson = this.buildBodyFromForm();
        } else {
            if (val.body) {
                try {
                    bodyJson = JSON.parse(val.body);
                } catch (e) {
                    this.messageService.add({ severity: 'error', summary: 'Invalid Body JSON', detail: 'Please fix JSON syntax' });
                    return;
                }
            }
        }
        const payload = JSON.stringify({
            fetch_query: val.fetchQuery,
            method: val.httpMethod,
            body: bodyJson,
            mapping: Object.keys(mapping).length > 0 ? mapping : null,
            root_path: val.rootPath || null,
            pagination_config: {
                type: val.paginationType,
                nextKey: val.paginationNextKey,
                limitParam: val.paginationLimitParam,
                limit: val.paginationLimit
            }
        }, null, 2);
        const taskDef: TaskDefinition = {
            id: this.currentTaskId || undefined,
            name: val.name,
            sourceId: val.sourceId,
            payload: payload
        };
        if (this.isNew) {
            this.service.createTask(taskDef).subscribe({
                next: (created) => {
                    this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Task created' });
                    this.ref.close(true);
                },
                error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message })
            });
        } else {
            this.service.updateTask(taskDef.id!, taskDef).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Task updated' });
                    this.ref.close(true);
                },
                error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message })
            });
        }
    }
    close() {
        this.ref.close();
    }
    get mappingControls() {
        return (this.taskForm.get('mappingRows') as FormArray).controls;
    }
    addMappingRow(target: string = '', source: string = '') {
        this.mappingRows.push(this.fb.group({
            target: [target, Validators.required],
            source: [source, Validators.required]
        }));
    }
    removeMappingRow(index: number) {
        this.mappingRows.removeAt(index);
    }
    onSourceChange() {
        const sourceId = this.taskForm.get('sourceId')?.value;
        const source = this.sources.find(s => s.id === sourceId);
        if (source) {
            if (source.type === 'SQL_SERVER') {
                this.queryHint = 'SELECT * FROM ...';
                this.showMethodDropdown = false;
            } else if (source.type === 'LOCAL_COMMAND') {
                this.queryHint = 'Enter command (e.g. docker ps --format json)';
                this.showMethodDropdown = false;
            } else {
                this.queryHint = '/api/endpoint';
                this.showMethodDropdown = true;
            }
        }
    }
    fetchPreview() {
        const sourceId = this.taskForm.get('sourceId')?.value;
        const query = this.taskForm.get('fetchQuery')?.value;
        const method = this.taskForm.get('httpMethod')?.value;
        let body = this.taskForm.get('body')?.value;
        if (body) {
            try {
                body = JSON.parse(body);
            } catch (e) {
            }
        }
        if (!sourceId) {
            this.messageService.add({ severity: 'warn', summary: 'Select Source' });
            return;
        }
        const rootPath = this.taskForm.get('rootPath')?.value;
        this.messageService.add({ severity: 'info', summary: 'Fetching Preview...' });
        this.sourceService.previewData(sourceId, query, method, body, rootPath).subscribe({
            next: (res) => {
                const sample = res.sample || [];
                if (sample.length > 0) {
                    this.availablePaths = this.flattenObject(sample[0]).map(p => ({ label: p, value: p }));
                    if (this.mappingRows.length === 0) {
                        const keys = Object.keys(sample[0]).slice(0, 5);
                        keys.forEach(k => this.addMappingRow(k, k));
                    }
                    this.updatePreviewResult(sample);
                    this.messageService.add({ severity: 'success', summary: 'Success', detail: `Fetched ${sample.length} rows` });
                } else {
                    this.messageService.add({ severity: 'warn', summary: 'No Data', detail: 'Query returned empty result' });
                }
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Failed', detail: err.message })
        });
    }
    updatePreviewResult(sampleData: any[]) {
        const mapping = this.taskForm.value.mappingRows;
        if (!mapping || mapping.length === 0) {
            this.previewRows = sampleData.slice(0, 5);
            return;
        }
        this.previewRows = sampleData.slice(0, 5).map(row => {
            const newRow: any = {};
            mapping.forEach((m: any) => {
                if (m.target && m.source) {
                    newRow[m.target] = this.resolvePath(row, m.source);
                }
            });
            return newRow;
        });
    }
    getPreviewCols() {
        if (this.previewRows.length === 0) return [];
        return Object.keys(this.previewRows[0]);
    }
    flattenObject(obj: any, prefix = ''): string[] {
        let paths: string[] = [];
        for (const key in obj) {
            const fullPath = prefix ? `${prefix}.${key}` : key;
            paths.push(fullPath);
            if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                paths = paths.concat(this.flattenObject(obj[key], fullPath));
            }
        }
        return paths;
    }
    resolvePath(obj: any, path: string) {
        return path.split('.').reduce((acc, part) => acc && acc[part] ? acc[part] : null, obj);
    }
    runtimeParams: any[] = [];
    runtimeValues: any = {};
    displayRuntimeParamsDialog = false;
    execute() {
        if (!this.currentTaskId) return;
        let bodyJson = this.taskForm.value.body;
        if (this.taskForm.value.bodyType === 'form') {
            bodyJson = JSON.stringify(this.buildBodyFromForm());
        }
        const payloadStr = JSON.stringify({
            fetch_query: this.taskForm.value.fetchQuery,
            method: this.taskForm.value.httpMethod,
            root_path: this.taskForm.value.rootPath,
            body: bodyJson
        });
        const regex = /{{(.*?)}}/g;
        const matches = new Set<string>();
        let match;
        while ((match = regex.exec(payloadStr)) !== null) {
            matches.add(match[1]);
        }
        if (matches.size > 0) {
            this.runtimeParams = Array.from(matches);
            this.runtimeValues = {};
            this.runtimeParams.forEach(p => this.runtimeValues[p] = '');
            this.displayRuntimeParamsDialog = true;
        } else {
            this.runWithParams(null);
        }
    }
    runWithParams(params: any) {
        this.displayRuntimeParamsDialog = false;
        if (this.currentTaskId) {
            this.messageService.add({ severity: 'info', summary: 'Running', detail: 'Execution started...' });
            this.service.executeTask(this.currentTaskId, params).subscribe({
                next: (exec) => {
                    const sev = exec.status === 'SUCCESS' ? 'success' : 'error';
                    const sum = exec.status === 'SUCCESS' ? 'Success' : 'Failed';
                    this.messageService.add({ severity: sev, summary: sum, detail: 'Execution finished' });
                    this.loadHistory(this.currentTaskId!);
                    this.selectedExecution = exec;
                    this.displayExecutionDialog = true;
                },
                error: (err) => this.messageService.add({ severity: 'error', summary: 'Failed', detail: err.message })
            });
        }
    }
    showExecution(exec: TaskExecution) {
        this.selectedExecution = exec;
        this.displayExecutionDialog = true;
    }
    displayExecutionDialog = false;
    getSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | undefined {
        switch (status) {
            case 'SUCCESS': return 'success';
            case 'FAILED': return 'danger';
            case 'RUNNING': return 'info';
            default: return 'secondary';
        }
    }
}
