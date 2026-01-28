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
import { SourceService, SyncDefinition, DataSource } from '../../../../services/source.service';

@Component({
    selector: 'app-sync-job-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule,
        ButtonModule, InputTextModule, TextareaModule, SelectModule, TableModule
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

    // Visual Mapping State
    availablePaths: string[] = []; // Discovered from simple response
    sampleData: any[] = [];
    previewRows: any[] = [];

    ngOnInit() {
        this.initForm();
        this.loadSources();
    }

    initForm() {
        this.syncData = this.config.data?.job;
        this.isEditing = !!this.syncData;

        this.syncFormGroup = this.fb.group({
            source_id: [null, Validators.required],
            target_table_name: ['sync_', Validators.required],
            fetch_query: [''],
            sync_mode: ['MANUAL', Validators.required],
            schedule_config: [''],
            sync_strategy: ['RELOAD', Validators.required],
            primary_key: [''],
            mappingRows: this.fb.array([]) // Visual Mapping
        });

        // Dynamic Validator for Primary Key based on Strategy
        this.syncFormGroup.get('sync_strategy')?.valueChanges.subscribe(val => {
            const pkControl = this.syncFormGroup.get('primary_key');
            if (val === 'APPEND') {
                pkControl?.setValidators(Validators.required);
            } else {
                pkControl?.clearValidators();
            }
            pkControl?.updateValueAndValidity();
        });

        // Auto-update preview when mapping changes
        this.syncFormGroup.get('mappingRows')?.valueChanges.subscribe(() => {
            this.updatePreview();
        });

        if (this.isEditing && this.syncData) {
            this.syncFormGroup.patchValue({
                source_id: this.syncData.source_id,
                target_table_name: this.syncData.target_table_name,
                fetch_query: this.syncData.fetch_query,
                sync_mode: this.syncData.sync_mode,
                schedule_config: this.syncData.schedule_config,
                sync_strategy: (this.syncData as any).sync_strategy || 'RELOAD',
                primary_key: (this.syncData as any).primary_key
            });

            // Trigger validator check
            const strategy = (this.syncData as any).sync_strategy || 'RELOAD';
            if (strategy === 'APPEND') this.syncFormGroup.get('primary_key')?.setValidators(Validators.required);
            this.syncFormGroup.get('primary_key')?.updateValueAndValidity();

            // Load existing mapping into FormArray
            if (this.syncData.field_mapping) {
                try {
                    const mapConfig = JSON.parse(this.syncData.field_mapping);
                    Object.keys(mapConfig).forEach(target => {
                        this.addMappingRow(target, mapConfig[target]);
                    });
                } catch (e) {
                    console.error('Failed to parse mapping', e);
                }
            }
        } else {
            // Add one empty row by default
            // this.addMappingRow();
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
        // extract target_col values from form array
        return this.mappingRows.controls
            .map(c => c.get('target_col')?.value)
            .filter(v => !!v) // remove empty
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
        const sourceId = this.syncFormGroup.get('source_id')?.value;
        const selectedSource = this.sources.find(s => s.id === sourceId);

        if (selectedSource) {
            if (selectedSource.type === 'SQL_SERVER') {
                this.syncQueryHint = 'Example: SELECT * FROM Users WHERE Active = 1';
            } else if (selectedSource.type === 'LOCAL_COMMAND') {
                this.syncQueryHint = 'Enter Command (e.g. "docker ps --format json")';
            } else {
                this.syncQueryHint = 'Example: /users (Relative to Base URL)';
            }
        }
    }

    fetchPreview() {
        const sourceId = this.syncFormGroup.get('source_id')?.value;
        const query = this.syncFormGroup.get('fetch_query')?.value;

        if (!sourceId) {
            this.showMsg('warn', 'Select a Source first');
            return;
        }
        this.showMsg('info', 'Fetching preview...');

        this.sourceService.previewData(sourceId, query).subscribe({
            next: (res) => {
                // Raw response wrapper? usually res.sample is the data array
                // The backend previewData returns { sample: [], mapping: {} } 
                // But wait, our API service returns raw array usually. 
                // Let's assume the previous code was right about structure:  { sample: any[], mapping: any }

                this.sampleData = res.sample || [];

                // Discover Paths from first item
                if (this.sampleData.length > 0) {
                    this.availablePaths = this.flattenObject(this.sampleData[0]);
                }

                // If no mapping exists yet, auto-populate from discovery
                if (this.mappingRows.length === 0) {
                    // Start with simple top-level keys
                    // Or use the suggested 'mapping' from backend if available, or just top-level keys
                    const initialKeys = Object.keys(this.sampleData[0]).slice(0, 5); // Limit to first 5 to avoid spam
                    initialKeys.forEach(k => {
                        // Check if it's an object, if so, ignore top level? No, let user decide.
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

        // Apply current mapping to sample data
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

    // --- Helpers ---

    flattenObject(obj: any, prefix = ''): string[] {
        let paths: string[] = [];
        for (const key in obj) {
            const val = obj[key];
            const fullPath = prefix ? `${prefix}.${key}` : key;

            paths.push(fullPath); // Add the path itself

            if (val && typeof val === 'object' && !Array.isArray(val)) {
                paths = paths.concat(this.flattenObject(val, fullPath));
            } else if (Array.isArray(val) && val.length > 0) {
                // Inspect first item if array of objects
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
        const cleanPath = path.replace(/\[(\d+)\]/g, '.$1'); // items[0] -> items.0
        return cleanPath.split('.').reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : null, obj);
    }

    save() {
        if (this.syncFormGroup.invalid) return;
        const formVal = this.syncFormGroup.getRawValue();
        this.loading = true;

        // Check for duplicate table name
        const existingTables = this.config.data?.existingTables || [];
        const currentTable = formVal.target_table_name;

        // If creating, check if exists. If editing, check if exists and is not self (though target_table_name usually shouldn't change, if it does, it must be unique)
        // Actually, if editing, we might want to prevent renaming to an existing one.
        // But for Creation:
        if (!this.isEditing && existingTables.includes(currentTable)) {
            this.showMsg('error', `Table "${currentTable}" already exists.`);
            this.loading = false;
            return;
        }

        // Convert rows back to JSON
        const mappingJson: any = {};
        formVal.mappingRows.forEach((row: any) => {
            mappingJson[row.target_col] = row.source_path;
        });

        // Construct payload
        const payload = {
            ...formVal,
            field_mapping: JSON.stringify(mappingJson)
        };
        // Remove mappingRows from payload to be safe (though backend ignores extras usually)
        delete (payload as any).mappingRows;


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
