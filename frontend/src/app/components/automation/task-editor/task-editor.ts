import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { AutomationService } from '../../../services/automation';
import { SourceService } from '../../../services/source';
import { TaskDefinition } from '../../../models/automation';
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
        TableModule,
        TagModule,
        TooltipModule,
        ToastModule,
        DialogModule,
        CheckboxModule
    ],
    templateUrl: './task-editor.html',
    styleUrls: ['./task-editor.scss']
})
export class TaskEditorComponent implements OnInit {

    // ── Wizard state ─────────────────────────────────────────────────────────
    activeStep = 0;
    readonly wizardSteps = ['Name', 'Steps', 'End Action', 'Review'];

    // ── Form & data ──────────────────────────────────────────────────────────
    taskForm!: FormGroup;
    sources: DataSource[] = [];
    isNew = true;
    currentTaskId: number | null = null;
    maxSteps = 3;

    // ── Option lists ─────────────────────────────────────────────────────────
    readonly httpMethods = [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
        { label: 'DELETE', value: 'DELETE' }
    ];

    readonly paginationOptions = [
        { label: 'None', value: 'NONE' },
        { label: 'Page Number  (e.g. ?page=1)', value: 'PAGE' },
        { label: 'Next Link in Response Body  (e.g. @odata.nextLink)', value: 'NEXT_LINK_BODY' }
    ];

    readonly endTaskTypes = [
        { label: 'None — no final action', value: 'NONE' },
        { label: 'Email Notification', value: 'EMAIL' },
        { label: 'File Download', value: 'DOWNLOAD' }
    ];

    readonly fileFormats = [
        { label: 'JSON', value: 'JSON' },
        { label: 'CSV', value: 'CSV' }
    ];

    readonly stepTypeOptions = [
        { label: 'Fetch Data', value: 'DATASOURCE' },
        { label: 'Export to File', value: 'PROCESS' }
    ];

    readonly overrideValueTypes = [
        { label: 'String', value: 'STRING' },
        { label: 'Number', value: 'NUMBER' },
        { label: 'JSON', value: 'JSON' }
    ];

    // ── Success criteria options ──────────────────────────────────────────────
    private readonly criteriaTypesRestApi = [
        { label: 'HTTP status equals', value: 'HTTP_STATUS_EQUALS' }
    ];

    private readonly criteriaTypesData = [
        { label: 'Result count equals', value: 'RESULT_COUNT_EQ' }
    ];

    readonly criteriaOperators = [
        { label: 'equals', value: 'EQUALS' }
    ];

    getCriteriaTypes(stepIndex: number) {
        return this.isRestApi(stepIndex) ? this.criteriaTypesRestApi : this.criteriaTypesData;
    }

    criteriaHasValue(type: string, operator?: string): boolean {
        return true;
    }

    getCriteriaLabel(stepIndex: number): string {
        const type = this.stepsFormArray.at(stepIndex)?.get('successCriteriaType')?.value;
        const val = this.stepsFormArray.at(stepIndex)?.get('successCriteriaValue')?.value;
        if (!type) return '';
        switch (type) {
            case 'HTTP_STATUS_EQUALS': return `HTTP status = ${val}`;
            case 'RESULT_COUNT_EQ': return `Result count = ${val}`;
            default: return '';
        }
    }

    // Literal {{ }} strings used as display examples in the template.
    // Defined here so the template compiler never sees raw {{ }} syntax.
    readonly exampleStepRef = '{{prev[0].fieldName}}';
    readonly exampleEmailBody = 'Workflow finished. Result: {{prev.id}}';

    // ── DI ───────────────────────────────────────────────────────────────────
    private service = inject(AutomationService);
    private sourceService = inject(SourceService);
    private messageService = inject(MessageService);
    private fb = inject(FormBuilder);
    public ref = inject(DynamicDialogRef);
    public config = inject(DynamicDialogConfig);

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor() {
        this.taskForm = this.fb.group({
            name: ['', Validators.required],
            steps: this.fb.array([]),
            endTask: this.fb.group({
                type: ['NONE'],
                emailTo: [''],
                emailSubject: [''],
                emailBody: [''],
                downloadFileName: [''],
                downloadFormat: ['JSON']
            })
        });
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    ngOnInit() {
        this.loadSources();
        this.service.getMaxSteps().subscribe({
            next: (val) => { this.maxSteps = val || 3; this.initForm(); },
            error: () => { this.maxSteps = 3; this.initForm(); }
        });
    }

    private initForm() {
        if (this.config.data?.taskId) {
            this.isNew = false;
            this.currentTaskId = this.config.data.taskId;
            this.loadTask(this.currentTaskId!);
        } else {
            this.addStep();   // one blank step to start
        }
    }

    // ── Sources ───────────────────────────────────────────────────────────────
    private loadSources() {
        this.sourceService.getSources().subscribe(data => {
            this.sources = data.filter(s => s.type === 'REST_API' || s.type === 'SQL_SERVER');
        });
    }

    // ── Steps FormArray ───────────────────────────────────────────────────────
    get stepsFormArray(): FormArray {
        return this.taskForm.get('steps') as FormArray;
    }

    get stepsControls(): FormGroup[] {
        return this.stepsFormArray.controls as FormGroup[];
    }

    private createStepGroup(step?: any): FormGroup {
        const mappingRows = this.fb.array<FormGroup>([]);
        if (step?.mapping) {
            Object.keys(step.mapping).forEach(k =>
                mappingRows.push(this.fb.group({
                    target: [k, Validators.required],
                    source: [step.mapping[k], Validators.required]
                }))
            );
        }

        const overrideRows = this.fb.array<FormGroup>([]);
        const loadOverrideMap = (map: Record<string, any>, appendMode: string) => {
            Object.keys(map).forEach(k => {
                const raw = map[k];
                const valueType = (typeof raw === 'number') ? 'NUMBER'
                    : (raw !== null && typeof raw === 'object') ? 'JSON'
                        : 'STRING';
                const valueStr = (valueType === 'JSON')
                    ? JSON.stringify(raw, null, 2)
                    : String(raw);
                overrideRows.push(this.fb.group({
                    field: [k, Validators.required],
                    valueType: [valueType],
                    appendMode: [appendMode],
                    value: [valueStr]
                }));
            });
        };
        if (step?.overrides) loadOverrideMap(step.overrides, 'REPLACE');
        if (step?.appendOverrides) loadOverrideMap(step.appendOverrides, 'APPEND');

        let bodyStr = '';
        if (step?.body) {
            bodyStr = typeof step.body === 'string'
                ? step.body
                : JSON.stringify(step.body, null, 2);
        }

        return this.fb.group({
            name: [step?.name || `Step ${this.stepsFormArray.length + 1}`, Validators.required],
            type: [step?.type || 'DATASOURCE'],
            sourceId: [step?.sourceId ?? null],
            fetchQuery: [step?.fetchQuery || ''],
            httpMethod: [step?.httpMethod || 'GET'],
            rootPath: [step?.rootPath || step?.responsePath || ''],
            body: [bodyStr],
            bodyFromStep: [typeof step?.bodyFromStep === 'number' ? step.bodyFromStep : null],
            includeResponseBody: [step?.includeResponseBody ?? false],
            responseIndex: [typeof step?.responseIndex === 'number' ? step.responseIndex : (step?.responseIndex != null ? Number(step.responseIndex) : null)],
            overrideRows,
            paginationType: [step?.paginationConfig?.type || 'NONE'],
            paginationNextKey: [step?.paginationConfig?.nextKey || ''],
            paginationLimitParam: [step?.paginationConfig?.limitParam || ''],
            paginationLimit: [step?.paginationConfig?.limit || ''],
            mappingRows,
            // Success criteria
            successCriteriaEnabled: [!!step?.successCriteria],
            successCriteriaType: [step?.successCriteria?.type || 'HTTP_STATUS_EQUALS'],
            successCriteriaField: [''],
            successCriteriaOperator: ['EQUALS'],
            successCriteriaValue: [step?.successCriteria?.value || ''],
            // PROCESS-type fields
            processType: [step?.processType || 'JSON_TO_FILE'],
            fileName: [step?.fileName || ''],
            fileFormat: [step?.fileFormat || 'JSON'],
            dependent: [step?.dependent !== undefined ? step.dependent : true]
        });
    }

    addStep(step?: any) {
        if (this.stepsFormArray.length < this.maxSteps) {
            this.stepsFormArray.push(this.createStepGroup(step));
        }
    }

    removeStep(index: number) {
        if (this.stepsFormArray.length > 1) {
            this.stepsFormArray.removeAt(index);
        }
    }

    getMappingRows(stepIndex: number): FormArray {
        return this.stepsFormArray.at(stepIndex).get('mappingRows') as FormArray;
    }

    addMappingRow(stepIndex: number) {
        this.getMappingRows(stepIndex).push(this.fb.group({
            target: ['', Validators.required],
            source: ['', Validators.required]
        }));
    }

    removeMappingRow(stepIndex: number, rowIndex: number) {
        this.getMappingRows(stepIndex).removeAt(rowIndex);
    }

    getOverrideRows(stepIndex: number): FormArray {
        return this.stepsFormArray.at(stepIndex).get('overrideRows') as FormArray;
    }

    addOverrideRow(stepIndex: number) {
        this.getOverrideRows(stepIndex).push(this.fb.group({
            field: ['', Validators.required],
            valueType: ['STRING'],
            appendMode: ['REPLACE'],
            value: ['']
        }));
    }

    removeOverrideRow(stepIndex: number, rowIndex: number) {
        this.getOverrideRows(stepIndex).removeAt(rowIndex);
    }

    // ── Wizard navigation ─────────────────────────────────────────────────────
    get canProceed(): boolean {
        switch (this.activeStep) {
            case 0:
                return !!this.taskForm.get('name')?.value?.trim();
            case 1:
                return this.stepsControls.length > 0 &&
                    this.stepsControls.every(s =>
                        s.get('type')?.value === 'PROCESS' || !!s.get('sourceId')?.value
                    );
            default:
                return true;
        }
    }

    next() { if (this.activeStep < this.wizardSteps.length - 1) this.activeStep++; }
    back() { if (this.activeStep > 0) this.activeStep--; }
    goTo(i: number) { this.activeStep = i; }

    // ── UI helpers ────────────────────────────────────────────────────────────
    getSourceName(id: number): string {
        return this.sources.find(s => s.id === id)?.name || `Source #${id}`;
    }

    getQueryHint(stepIndex: number): string {
        const sid = this.stepsFormArray.at(stepIndex)?.get('sourceId')?.value;
        const source = this.sources.find(s => s.id === sid);
        if (source?.type === 'SQL_SERVER') return 'SELECT * FROM table WHERE ...';
        return '/api/endpoint/path';
    }

    getSourceType(stepIndex: number): string | undefined {
        const sid = this.stepsFormArray.at(stepIndex)?.get('sourceId')?.value;
        return this.sources.find(s => s.id === sid)?.type;
    }

    isRestApi(stepIndex: number): boolean {
        return this.getSourceType(stepIndex) === 'REST_API';
    }

    showMethodDropdown(stepIndex: number): boolean {
        return this.isRestApi(stepIndex);
    }

    /**
     * Options for the "Request Body" dropdown on step at stepIndex.
     * null  → manual JSON textarea
     * 1..N  → use that step's full raw response as the body
     */
    getBodyOptions(stepIndex: number) {
        const opts: { label: string; value: number | null }[] = [
            { label: 'Manual JSON', value: null }
        ];
        for (let i = 0; i < stepIndex; i++) {
            const stepName = this.stepsControls[i]?.get('name')?.value || `Step ${i + 1}`;
            opts.push({ label: `Step ${i + 1} response${stepName !== `Step ${i + 1}` ? ' — ' + stepName : ''}`, value: i + 1 });
        }
        return opts;
    }

    // ── Load existing task ────────────────────────────────────────────────────
    private loadTask(id: number) {
        this.service.getTasks().subscribe(tasks => {
            const found = tasks.find(t => t.id === id);
            if (!found) return;

            let payloadObj: any = {};
            try { payloadObj = JSON.parse(found.payload); } catch { /* invalid JSON */ }

            this.taskForm.patchValue({ name: found.name });
            this.stepsFormArray.clear();

            if (Array.isArray(payloadObj?.steps)) {
                payloadObj.steps.forEach((s: any) => this.addStep(s));
            }
            if (payloadObj?.endTask) {
                this.taskForm.patchValue({ endTask: payloadObj.endTask });
            }
            if (!this.stepsFormArray.length) this.addStep();
        });
    }

    // ── Save ──────────────────────────────────────────────────────────────────
    save() {
        if (!this.taskForm.get('name')?.value?.trim()) {
            this.messageService.add({ severity: 'warn', summary: 'Required', detail: 'Task name is required' });
            this.activeStep = 0;
            return;
        }

        try {
            const val = this.taskForm.value;
            let primarySourceId: number | null = null;

            const steps = val.steps.map((step: any) => {
                const s: any = { name: step.name, type: step.type, dependent: step.dependent };

                if (step.type === 'DATASOURCE') {
                    if (step.sourceId && !primarySourceId) primarySourceId = step.sourceId;
                    s.sourceId = step.sourceId;
                    s.fetchQuery = step.fetchQuery;
                    s.httpMethod = step.httpMethod;
                    s.rootPath = step.rootPath || step.responsePath || null;
                    if (s.rootPath) s.responsePath = s.rootPath;

                    if (step.bodyFromStep != null && step.bodyFromStep > 0) {
                        // Use the numbered step's full raw response as the body
                        s.bodyFromStep = step.bodyFromStep;
                        const overrides: Record<string, any> = {};
                        const appendOverrides: Record<string, any> = {};
                        (step.overrideRows || []).forEach((r: any) => {
                            if (r.field) {
                                let val: any = r.value;
                                if (r.valueType === 'NUMBER') {
                                    val = Number(r.value);
                                } else if (r.valueType === 'JSON') {
                                    try { val = JSON.parse(r.value); } catch { /* keep as raw string if invalid */ }
                                }
                                if (r.appendMode === 'APPEND') {
                                    appendOverrides[r.field] = val;
                                } else {
                                    overrides[r.field] = val;
                                }
                            }
                        });
                        if (Object.keys(overrides).length) s.overrides = overrides;
                        if (Object.keys(appendOverrides).length) s.appendOverrides = appendOverrides;
                    } else if (step.body?.trim()) {
                        try { s.body = JSON.parse(step.body); } catch { s.body = step.body; }
                    }

                    if (step.paginationType !== 'NONE') {
                        s.paginationConfig = {
                            type: step.paginationType,
                            nextKey: step.paginationNextKey || null,
                            limitParam: step.paginationLimitParam || null,
                            limit: step.paginationLimit || null
                        };
                    }

                    const mapping: Record<string, string> = {};
                    (step.mappingRows || []).forEach((m: any) => {
                        if (m.target && m.source) mapping[m.target] = m.source;
                    });
                    if (Object.keys(mapping).length) s.mapping = mapping;
                    if (step.includeResponseBody) s.includeResponseBody = true;
                    if (step.responseIndex != null && step.responseIndex !== '') s.responseIndex = Number(step.responseIndex);

                    // Success criteria
                    if (step.successCriteriaEnabled && step.successCriteriaValue != null && step.successCriteriaValue !== '') {
                        s.successCriteria = {
                            type: step.successCriteriaType,
                            value: step.successCriteriaValue
                        };
                    }

                } else if (step.type === 'PROCESS') {
                    s.processType = step.processType;
                    s.fileName = step.fileName || 'export.json';
                    s.fileFormat = step.fileFormat || 'JSON';
                }

                return s;
            });

            const payload: any = { isMultiStep: true, steps, endTask: val.endTask };

            const taskDef: TaskDefinition = {
                id: this.currentTaskId || undefined,
                name: val.name,
                sourceId: primarySourceId || (this.sources[0]?.id ?? 1),
                payload: JSON.stringify(payload, null, 2)
            };

            const op = this.isNew
                ? this.service.createTask(taskDef)
                : this.service.updateTask(taskDef.id!, taskDef);

            op.subscribe({
                next: () => {
                    this.messageService.add({
                        severity: 'success', summary: 'Saved',
                        detail: this.isNew ? 'Task created successfully' : 'Task updated successfully'
                    });
                    this.ref.close(true);
                },
                error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message })
            });

        } catch (e: any) {
            this.messageService.add({ severity: 'error', summary: 'Save Failed', detail: e.message || 'Check JSON body format' });
        }
    }

    close() { this.ref.close(); }

    getSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | undefined {
        switch (status?.toUpperCase()) {
            case 'SUCCESS': return 'success';
            case 'FAILED': return 'danger';
            case 'RUNNING': return 'info';
            default: return 'secondary';
        }
    }
}
