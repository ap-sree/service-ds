import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { NotificationRuleService, NotificationRule } from '../../../../services/notification-rule.service';
import { SourceService } from '../../../../services/source.service';

@Component({
    selector: 'app-notification-rule-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule,
        ButtonModule, InputTextModule, TextareaModule, SelectModule
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
    uniqueTables: string[] = [];
    tableColumns: string[] = [];
    ruleData: NotificationRule | undefined;

    // ... imports remain same ...

    // Helper options
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
            local_table_name: ['', Validators.required],
            user_column: [''],
            target_role: [''],
            condition_json: [''],
            action_type: ['TOAST', Validators.required],
            title_template: ['Service Alert', Validators.required],
            message_template: ['Alert: Value is {{value}}', Validators.required],
            schedule_type: ['EVENT', Validators.required],
            schedule_config: ['']
        });

        // New Multi-Metric Style Condition
        this.ruleConditionForm = this.fb.group({
            operation: ['COUNT', Validators.required],
            column: ['*', Validators.required],
            condition: [''], // SQL Filter
            threshold_operator: ['>', Validators.required],
            threshold_value: ['0', Validators.required]
        });

        if (this.isEditing && this.ruleData) {
            this.ruleForm.patchValue(this.ruleData);
            this.onRuleTableChange();

            try {
                if (this.ruleData.condition_json) {
                    const cond = JSON.parse(this.ruleData.condition_json);

                    // Backward Compatibility Migration (Field/Op/Val -> New Structure)
                    if (cond.field && !cond.operation) {
                        if (cond.field === 'count') {
                            this.ruleConditionForm.patchValue({
                                operation: 'COUNT', column: '*', condition: '',
                                threshold_operator: cond.operator, threshold_value: cond.value
                            });
                        } else {
                            // Convert old "Field=Val" to "COUNT WHERE Field=Val > 0" ?
                            // Actually old logic was: SELECT COUNT(*) WHERE field op val. And trigger if result > 0.
                            // So: Op=COUNT, Col=*, Filter="field op val", ThreshOp='>', ThreshVal=0
                            this.ruleConditionForm.patchValue({
                                operation: 'COUNT',
                                column: '*',
                                condition: `${cond.field} ${cond.operator} '${cond.value}'`,
                                threshold_operator: '>',
                                threshold_value: '0'
                            });
                        }
                    } else {
                        // Standard Load
                        this.ruleConditionForm.patchValue(cond);
                    }
                }
            } catch (e) { }
        }
    }

    // ... loadTables, onRuleTableChange, save, cancel, showMsg remain same ...
    loadTables() {
        this.sourceService.getSyncDefs().subscribe({
            next: (data) => {
                this.uniqueTables = [...new Set(data.map(d => d.target_table_name))];
            }
        });
    }

    onRuleTableChange() {
        const table = this.ruleForm.get('local_table_name')?.value;
        if (table) {
            this.sourceService.getTableSchema(table).subscribe(cols => this.tableColumns = cols);
        }
    }

    save() {
        if (this.ruleForm.invalid || this.ruleConditionForm.invalid) return;
        this.loading = true;

        const ruleVal = this.ruleForm.getRawValue();
        const conditionVal = this.ruleConditionForm.getRawValue();
        ruleVal.condition_json = JSON.stringify(conditionVal);

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
