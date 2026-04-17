
import { Component, OnInit, inject } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, FormsModule } from '@angular/forms';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { DashboardService, WidgetDefinition, QueryConfig, MetricConfig, StatusRule } from '../../../../services/dashboard';
import { SourceService } from '../../../../services/source';
import { SyncDefinition } from '../../../../models/sync';

@Component({
    selector: 'app-widget-dialog',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        FormsModule,
        ButtonModule,
        InputTextModule,
        TextareaModule,
        SelectModule,
        MultiSelectModule,
        TagModule
    ],
    templateUrl: './widget-dialog.html',
    styles: [`
    .field { margin-bottom: 1rem; }
`]
})
export class WidgetDialogComponent implements OnInit {
    private fb = inject(FormBuilder);
    private dashboardService = inject(DashboardService);
    private readonly sourceService = inject(SourceService);
    private readonly messageService = inject(MessageService);
    public ref = inject(DynamicDialogRef);
    public config = inject(DynamicDialogConfig);

    widgetForm!: FormGroup;
    loading = false;
    isEditing = false;
    uniqueSyncs: SyncDefinition[] = [];
    tableColumns: string[] = [];
    widgetData: WidgetDefinition | undefined;

    statusColors = [
        { label: 'Green', value: 'success' },
        { label: 'Red', value: 'warn' },
        { label: 'Blue', value: 'primary' },
        { label: 'Orange', value: 'accent' }
    ];

    widgetTypes = [
        { label: 'Table', value: 'TABLE' },
        { label: 'Card (Metric)', value: 'CARD' },
        { label: 'Status Grid', value: 'STATUS_GRID' },
        { label: 'Multi Metric', value: 'MULTI_METRIC' }
    ];

    operations = [
        { label: 'Count', value: 'COUNT' },
        { label: 'Sum', value: 'SUM' },
        { label: 'Avg', value: 'AVG' },
        { label: 'Min', value: 'MIN' },
        { label: 'Max', value: 'MAX' }
    ];

    constructor() { }

    ngOnInit() {
        this.initForm();
        this.loadTables();
    }

    initForm() {
        this.widgetData = this.config.data?.widget;
        this.isEditing = !!this.widgetData;

        this.widgetForm = this.fb.group({
            title: ['', Validators.required],
            type: ['TABLE', Validators.required],
            dataSourceTable: ['', Validators.required],
            userColumn: [''],
            globalFilter: [''],

            selectedColumns: [[]],

            statusLabelColumn: [''],
            statusValueColumn: [''],
            statusRules: this.fb.array([]),

            metrics: this.fb.array([])
        });


        if (!this.isEditing) {
            this.addStatusRule();
        }

        if (this.isEditing && this.widgetData) {
            this.widgetForm.patchValue(this.widgetData);
            this.restoreConfigForEdit(this.widgetData);
        }
    }

    get metrics(): FormArray {
        return this.widgetForm.get('metrics') as FormArray;
    }

    get statusRules(): FormArray {
        return this.widgetForm.get('statusRules') as FormArray;
    }

    addMetric() {
        if (this.metrics.length >= 4) return;
        this.metrics.push(this.fb.group({
            label: ['', Validators.required],
            operation: ['COUNT', Validators.required],
            column: ['*', Validators.required],
            condition: ['']
        }));
    }

    removeMetric(index: number) {
        this.metrics.removeAt(index);
    }

    addStatusRule() {
        this.statusRules.push(this.fb.group({
            value: [''],
            color: ['success']
        }));
    }

    removeStatusRule(index: number) {
        this.statusRules.removeAt(index);
    }

    loadTables() {
        this.sourceService.getSyncDefs().subscribe({
            next: (data) => {
                this.uniqueSyncs = data;
            }
        });
    }

    onTableChange() {
        const tableName = this.widgetForm.get('dataSourceTable')?.value;
        const sync = this.uniqueSyncs.find(s => s.targetTableName === tableName);

        if (sync && sync.id) {
            this.sourceService.getSyncSchema(sync.id).subscribe({
                next: cols => this.tableColumns = cols,
                error: () => this.tableColumns = []
            });
        }
    }

    restoreConfigForEdit(w: WidgetDefinition) {
        if (w.id) {
            this.sourceService.getWidgetSchema(w.id).subscribe({
                next: cols => {
                    this.tableColumns = cols;
                    if (w.queryConfig) {
                        try {
                            const c: QueryConfig = typeof w.queryConfig === 'string' ? JSON.parse(w.queryConfig) : w.queryConfig;

                            if (c.globalFilter) {
                                this.widgetForm.patchValue({ globalFilter: c.globalFilter });
                            }

                            if (w.type === 'TABLE' && c.columns) {
                                this.widgetForm.patchValue({ selectedColumns: c.columns });
                            }

                            if (w.type === 'STATUS_GRID') {
                                this.widgetForm.patchValue({
                                    statusLabelColumn: c.labelColumn,
                                    statusValueColumn: c.statusColumn
                                });
                                if (c.rules && Array.isArray(c.rules)) {
                                    this.statusRules.clear();
                                    c.rules.forEach((r: StatusRule) => {
                                        this.statusRules.push(this.fb.group({
                                            value: [r.value],
                                            color: [r.color]
                                        }));
                                    });
                                }
                            }

                            if (w.type === 'MULTI_METRIC' && c.metrics && Array.isArray(c.metrics)) {
                                this.metrics.clear();
                                c.metrics.forEach((m: MetricConfig) => {
                                    this.metrics.push(this.fb.group({
                                        label: [m.label || '', Validators.required],
                                        operation: [m.operation || 'COUNT', Validators.required],
                                        column: [m.column || '*', Validators.required],
                                        condition: [m.condition || '']
                                    }));
                                });
                            }

                        } catch (e) { console.error(e); }
                    }
                },
                error: () => this.tableColumns = []
            });
        }
    }

    save() {
        if (this.widgetForm.invalid) return;
        const formVal = this.widgetForm.getRawValue();
        this.loading = true;


        let queryConfig: QueryConfig = {
            globalFilter: formVal.globalFilter
        };

        if (formVal.type === 'TABLE' && formVal.selectedColumns?.length > 0) {
            queryConfig.columns = formVal.selectedColumns;
        } else if (formVal.type === 'STATUS_GRID') {
            queryConfig.labelColumn = formVal.statusLabelColumn;
            queryConfig.statusColumn = formVal.statusValueColumn;
            queryConfig.rules = formVal.statusRules;
        } else if (formVal.type === 'MULTI_METRIC') {
            queryConfig.metrics = formVal.metrics;
        }

        const payload: WidgetDefinition = {
            ...formVal,
            queryConfig: JSON.stringify(queryConfig)
        };


        const cleanPayload = { ...payload } as any;
        delete cleanPayload.selectedColumns;
        delete cleanPayload.statusLabelColumn;
        delete cleanPayload.statusValueColumn;
        delete cleanPayload.statusRules;
        delete cleanPayload.metrics;
        delete cleanPayload.globalFilter;


        if (this.isEditing) {
            this.dashboardService.updateWidget(this.widgetData!.id!, cleanPayload).subscribe({
                next: () => this.ref.close(true),
                error: (err) => {
                    this.loading = false;
                    this.showMsg('error', 'Error: ' + err.message);
                }
            });
        } else {
            this.dashboardService.createWidget(cleanPayload).subscribe({
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
