import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { MessageService } from 'primeng/api';
import { SourceService } from '../../../../services/source';
import { SyncDefinition, DataSource } from '../../../../models/sync';
@Component({
    selector: 'app-sync-job-dialog',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        ButtonModule,
        InputTextModule,
        TextareaModule,
        SelectModule,
        TableModule,
        CommonModule
    ],
    templateUrl: './sync-job-dialog.html',
    styles: [`
    .field { margin-bottom: 1rem; }
    textarea { font-family: monospace; }
  `]
})
export class SyncJobDialogComponent implements OnInit {

    private fb = inject(FormBuilder);

    private sourceService = inject(SourceService);

    private messageService = inject(MessageService);

    public ref = inject(DynamicDialogRef);

    public config = inject(DynamicDialogConfig);
    syncFormGroup!: FormGroup;
    loading = false;
    isEditing = false;
    sources: DataSource[] = [];
    syncQueryHint = 'SELECT * FROM ... or /api/v1/tickets';
    syncData: SyncDefinition | undefined;
    modeOptions = [
        { label: 'Manual', value: 'MANUAL' },
        { label: 'Scheduled (Cron)', value: 'SCHEDULED' }
    ];
    strategyOptions = [
        { label: 'Reload Completely (Truncate & Insert)', value: 'RELOAD' },
        { label: 'Append (Insert New & Update Existing)', value: 'APPEND' }
    ];
    availablePaths: string[] = [];
    sampleData: any[] = [];
    previewRows: any[] = [];
    httpMethods = [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
        { label: 'DELETE', value: 'DELETE' }
    ];
    showMethodDropdown = false;
    showHttpOptions = false;
    paginationOptions = [
        { label: 'None', value: 'NONE' },
        { label: 'Page Number (e.g. page=1)', value: 'PAGE' },
        { label: 'Next Link in Response Body (e.g. MS Graph @odata.nextLink)', value: 'NEXT_LINK_BODY' },
    ];
    ngOnInit() {
        this.initForm();
        this.loadSources();
    }
    initForm() {
        this.syncData = this.config.data?.job;
        this.isEditing = !!this.syncData;
        this.syncFormGroup = this.fb.group({
            sourceId: [null, Validators.required],
            targetTableName: ['sync_', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_]+$/)]],
            fetchQuery: ['', Validators.required],
            httpMethod: ['GET'],
            requestBody: [''],
            syncMode: ['MANUAL', Validators.required],
            scheduleConfig: [''],
            syncStrategy: ['RELOAD', Validators.required],
            primaryKey: [''],
            paginationType: ['NONE'],
            paginationNextKey: [''],
            paginationLimitParam: [''],
            paginationLimit: [''],
            rootPath: [''],
            mappingRows: this.fb.array([])
        });
        this.syncFormGroup.get('syncStrategy')?.valueChanges.subscribe(val => {
            const pkControl = this.syncFormGroup.get('primaryKey');
            if (val === 'APPEND') {
                pkControl?.setValidators(Validators.required);
            } else {
                pkControl?.clearValidators();
            }
            pkControl?.updateValueAndValidity();
        });
        this.syncFormGroup.get('mappingRows')?.valueChanges.subscribe(() => {
            this.updatePreview();
        });
        if (this.isEditing && this.syncData) {
            this.syncFormGroup.patchValue({
                sourceId: this.syncData.sourceId,
                targetTableName: this.syncData.targetTableName,
                fetchQuery: this.syncData.fetchQuery,
                httpMethod: (this.syncData as any).httpMethod || 'GET',
                requestBody: (this.syncData as any).requestBody || '',
                syncMode: this.syncData.syncMode,
                scheduleConfig: this.syncData.scheduleConfig,
                syncStrategy: (this.syncData as any).syncStrategy || 'RELOAD',
                primaryKey: (this.syncData as any).primaryKey,
                rootPath: (this.syncData as any).rootPath || ''
            });
            if (this.syncData.paginationConfig) {
                try {
                    const p = JSON.parse(this.syncData.paginationConfig);
                    this.syncFormGroup.patchValue({
                        paginationType: p.type || 'NONE',
                        paginationNextKey: p.nextKey || '',
                        paginationLimitParam: p.limitParam || '',
                        paginationLimit: p.limit || ''
                    });
                } catch (e) { }
            }
            const strategy = (this.syncData as any).syncStrategy || 'RELOAD';
            if (strategy === 'APPEND') this.syncFormGroup.get('primaryKey')?.setValidators(Validators.required);
            this.syncFormGroup.get('primaryKey')?.updateValueAndValidity();
            if (this.syncData.fieldMapping) {
                try {
                    const mapConfig = JSON.parse(this.syncData.fieldMapping);
                    Object.keys(mapConfig).forEach(target => {
                        this.addMappingRow(target, mapConfig[target]);
                    });
                } catch (e) {
                    console.error('Failed to parse mapping', e);
                }
            }
        }
    }
    get mappingRows(): FormArray {
        return this.syncFormGroup.get('mappingRows') as FormArray;
    }
    addMappingRow(target: string = '', source: string = '') {
        const row = this.fb.group({
            target_col: [target, Validators.required],
            source_path: [source, Validators.required]
        });
        this.mappingRows.push(row);
        this.updatePreview();
    }
    removeMappingRow(index: number) {
        this.mappingRows.removeAt(index);
        this.updatePreview();
    }
    get targetColumnOptions() {
        return this.mappingRows.controls
            .map(c => c.get('target_col')?.value)
            .filter(v => !!v)
            .map(v => ({ label: v, value: v }));
    }
    loadSources() {
        this.sourceService.getSources().subscribe(sources => {
            this.sources = sources;
            if (this.isEditing) {
                this.onSyncSourceChange();
            }
        });
    }
    onSyncSourceChange() {
        const sourceId = this.syncFormGroup.get('sourceId')?.value;
        const selectedSource = this.sources.find(s => s.id === sourceId);
        if (selectedSource) {
            if (selectedSource.type === 'SQL_SERVER') {
                this.syncQueryHint = 'Example: SELECT * FROM Users WHERE Active = 1';
                this.showMethodDropdown = false;
                this.showHttpOptions = false;
            } else if (selectedSource.type === 'LOCAL_COMMAND') {
                this.syncQueryHint = 'Enter Command (e.g. "docker ps --format json")';
                this.showMethodDropdown = false;
                this.showHttpOptions = false;
            } else {
                this.syncQueryHint = 'Example: /users (Relative to Base URL)';
                this.showMethodDropdown = true;
                this.showHttpOptions = true;

                if (!this.isEditing) {
                    try {
                        const cfg = JSON.parse(selectedSource.config || '{}');
                        if (cfg.pagination?.type && cfg.pagination.type !== 'NONE') {
                            this.syncFormGroup.patchValue({
                                paginationType: cfg.pagination.type,
                                paginationNextKey: cfg.pagination.key || cfg.pagination.nextPath || '',
                                paginationLimitParam: cfg.pagination.type === 'PAGE' ? 'numberPerPage' : '',
                                paginationLimit: cfg.pagination.limit || ''
                            });
                        }
                    } catch (e) { }
                }
            }
        }
    }
    fetchPreview() {
        const sourceId = this.syncFormGroup.get('sourceId')?.value;
        const query = this.syncFormGroup.get('fetchQuery')?.value;
        const method = this.syncFormGroup.get('httpMethod')?.value;
        let body = this.syncFormGroup.get('requestBody')?.value;
        if (body) {
            try {
                body = JSON.parse(body);
            } catch (e) {
            }
        }
        if (!sourceId) {
            this.showMsg('warn', 'Select a Source first');
            return;
        }
        this.showMsg('info', 'Fetching preview...');
        this.sourceService.previewData(sourceId, query, method, body).subscribe({
            next: (res) => {
                this.sampleData = res.sample || [];
                if (this.sampleData.length > 0) {
                    this.availablePaths = this.flattenObject(this.sampleData[0]);
                }
                if (this.mappingRows.length === 0 && this.sampleData.length > 0) {
                    const initialKeys = Object.keys(this.sampleData[0]).slice(0, 5);
                    initialKeys.forEach(k => {
                        this.addMappingRow(k, k);
                    });
                }
                this.updatePreview();
                this.showMsg('success', `Fetched ${this.sampleData.length} rows.`);
            },
            error: (err) => this.showMsg('error', 'Preview Failed: ' + (err.error?.error || err.message))
        });
    }
    updatePreview() {
        if (!this.sampleData || this.sampleData.length === 0) return;
        const currentMapping: any = {};
        this.mappingRows.controls.forEach(control => {
            const val = control.value;
            if (val.target_col && val.source_path) {
                currentMapping[val.target_col] = val.source_path;
            }
        });
        const targetCols = Object.keys(currentMapping);
        if (targetCols.length === 0) {
            this.previewRows = [];
            return;
        }
        this.previewRows = this.sampleData.slice(0, 5).map(row => {
            const newRow: any = {};
            targetCols.forEach(col => {
                const path = currentMapping[col];
                let val = this.resolvePath(row, path);
                if (val && typeof val === 'object') {
                    val = JSON.stringify(val);
                }
                newRow[col] = val;
            });
            return newRow;
        });
    }
    flattenObject(obj: any, prefix = ''): string[] {
        let paths: string[] = [];
        for (const key in obj) {
            const val = obj[key];
            const fullPath = prefix ? `${prefix}.${key}` : key;
            paths.push(fullPath);
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                paths = paths.concat(this.flattenObject(val, fullPath));
            } else if (Array.isArray(val) && val.length > 0) {
                const firstItem = val[0];
                if (typeof firstItem === 'object') {
                    paths = paths.concat(this.flattenObject(firstItem, `${fullPath}[0]`));
                }
            }
        }
        return paths;
    }
    resolvePath(obj: any, path: string) {
        if (!path || !obj) return null;
        const cleanPath = path.replace(/\[(\d+)\]/g, '.$1');
        return cleanPath.split('.').reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : null, obj);
    }
    save() {
        if (this.syncFormGroup.invalid) return;
        const formVal = this.syncFormGroup.getRawValue();
        this.loading = true;
        const existingTables = this.config.data?.existingTables || [];
        const currentTable = formVal.targetTableName;
        if (!this.isEditing && existingTables.includes(currentTable)) {
            this.showMsg('error', `Table "${currentTable}" already exists.`);
            this.loading = false;
            return;
        }
        const mappingJson: any = {};
        formVal.mappingRows.forEach((row: any) => {
            mappingJson[row.target_col] = row.source_path;
        });

        const paginationJson = {
            type: formVal.paginationType,
            nextKey: formVal.paginationNextKey,
            limitParam: formVal.paginationLimitParam,
            limit: formVal.paginationLimit
        };

        const payload = {
            ...formVal,
            fieldMapping: JSON.stringify(mappingJson),
            paginationConfig: JSON.stringify(paginationJson)
        };
        delete (payload as any).mappingRows;
        delete (payload as any).paginationType;
        delete (payload as any).paginationNextKey;
        delete (payload as any).paginationLimitParam;
        delete (payload as any).paginationLimit;

        if (this.isEditing) {
            this.sourceService.updateSyncDef(this.syncData!.id!, payload).subscribe({
                next: () => this.ref.close(true),
                error: (err) => {
                    this.loading = false;
                    this.showMsg('error', 'Error: ' + err.message);
                }
            });
        } else {
            this.sourceService.createSyncDef(payload).subscribe({
                next: () => this.ref.close(true),
                error: (err) => {
                    this.loading = false;
                    this.showMsg('error', 'Error: ' + err.message);
                }
            });
        }
    }
    cancel() {
        this.ref.close();
    }
    showMsg(severity: string, summary: string) {
        this.messageService.add({ severity, summary, detail: summary });
    }
}
