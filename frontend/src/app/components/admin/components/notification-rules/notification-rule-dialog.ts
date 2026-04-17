import { Component, OnInit, inject } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { NotificationRuleService } from '../../../../services/notification-rule';
import { NotificationRule } from '../../../../models/notification';
import { SourceService } from '../../../../services/source';
import { SyncDefinition } from '../../../../models/sync';

@Component({
    selector: 'app-notification-rule-dialog',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        ButtonModule,
        InputTextModule,
        TextareaModule,
        SelectModule
    ],
    templateUrl: './notification-rule-dialog.html',
    styles: [`
    .field { margin-bottom: 1rem; }
  `]
})
export class NotificationRuleDialogComponent implements OnInit {
    private fb = inject(FormBuilder);
    private notificationRuleService = inject(NotificationRuleService);
    private sourceService = inject(SourceService);
    private messageService = inject(MessageService);
    public ref = inject(DynamicDialogRef);
    public config = inject(DynamicDialogConfig);

    ruleForm!: FormGroup;
    ruleConditionForm!: FormGroup;
    loading = false;
    isEditing = false;
    uniqueSyncs: SyncDefinition[] = [];
    uniqueTables: string[] = [];
    tableColumns: string[] = [];
    ruleData: NotificationRule | undefined;

    roles = [
        { label: '-- All Roles --', value: '' },
        { label: 'Admin', value: 'ADMIN' },
        { label: 'User', value: 'USER' }
    ];

    operators = [
        { label: '> (Greater Than)', value: '>' },
        { label: '< (Less Than)', value: '<' },
        { label: '= (Equals)', value: '=' },
        { label: '!= (Not Equals)', value: '!=' }
    ];

    operations = [
        { label: 'Count Rows', value: 'COUNT' },
        { label: 'Sum', value: 'SUM' },
        { label: 'Average', value: 'AVG' },
        { label: 'Min', value: 'MIN' },
        { label: 'Max', value: 'MAX' }
    ];

    actionTypes = [
        { label: 'App Toast', value: 'TOAST' },
        { label: 'OS Notification', value: 'OS_NOTIFY' }
    ];

    scheduleTypes = [
        { label: 'On Sync Event', value: 'EVENT' },
        { label: 'Cron', value: 'CRON' }
    ];

    constructor() { }

    ngOnInit() {
        this.initForms();
        this.loadTables();
    }

    initForms() {
        this.ruleData = this.config.data?.rule;
        this.isEditing = !!this.ruleData;

        this.ruleForm = this.fb.group({
            localTableName: ['', Validators.required],
            userColumn: [''],
            targetRole: [''],

            actionType: ['TOAST', Validators.required],
            titleTemplate: ['Service Alert', Validators.required],
            messageTemplate: ['Alert: Value is {{value}}', Validators.required],
            scheduleType: ['EVENT', Validators.required],
            scheduleConfig: ['']
        });


        this.ruleConditionForm = this.fb.group({
            operation: ['COUNT', Validators.required],
            column: ['*', Validators.required],
            condition: [''],
            thresholdOperator: ['>', Validators.required],
            thresholdValue: ['0', Validators.required]
        });

        if (this.isEditing && this.ruleData) {
            this.ruleForm.patchValue(this.ruleData);
            this.onRuleTableChange();

            if (this.ruleData.condition) {

                const cond = this.ruleData.condition;
                this.ruleConditionForm.patchValue(cond);
            }
        }
    }


    loadTables() {
        this.sourceService.getSyncDefs().subscribe({
            next: (data) => {
                this.uniqueSyncs = data;
                this.uniqueTables = [...new Set(data.map(d => d.targetTableName))];
            }
        });
    }

    onRuleTableChange() {
        const table = this.ruleForm.get('localTableName')?.value;
        const sync = this.uniqueSyncs.find(s => s.targetTableName === table);
        if (sync && sync.id) {
            this.sourceService.getSyncSchema(sync.id).subscribe({
                next: cols => this.tableColumns = cols,
                error: () => this.tableColumns = []
            });
        }
    }

    save() {
        if (this.ruleForm.invalid || this.ruleConditionForm.invalid) return;
        this.loading = true;

        const ruleVal = this.ruleForm.getRawValue();
        const conditionVal = this.ruleConditionForm.getRawValue();

        ruleVal.condition = conditionVal;

        if (this.isEditing) {
            this.notificationRuleService.updateRule(this.ruleData!.id!, ruleVal).subscribe({
                next: () => this.ref.close(true),
                error: (err) => {
                    this.loading = false;
                    this.showMsg('error', 'Error: ' + err.message);
                }
            });
        } else {
            this.notificationRuleService.createRule(ruleVal).subscribe({
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
