import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { SourceService } from '../../../../services/source';
import { DataSource } from '../../../../models/sync';

@Component({
    selector: 'app-data-source-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule,
        ButtonModule, InputTextModule, TextareaModule, SelectModule, CheckboxModule
    ],
    // MessageService provided by parent or globally? DynamicDialog components share root injector usually, 
    // but safer to use what's available. If this component needs to show toast, it should use MessageService.
    templateUrl: './data-source-dialog.html',
    styles: [`
    .field { margin-bottom: 1rem; }
    textarea { font-family: monospace; }
  `]
})
export class DataSourceDialogComponent implements OnInit {
    private fb = inject(FormBuilder);
    private sourceService = inject(SourceService);
    private messageService = inject(MessageService);
    public ref = inject(DynamicDialogRef);
    public config = inject(DynamicDialogConfig);

    sourceForm!: FormGroup;
    loading = false;
    isEditing = false;
    sourceData: DataSource | undefined;

    // Helper Templates
    private SQL_TEMPLATE = `{\n  "server": "localhost",\n  "database": "testdb",\n  "user": "sa",\n  "password": "yourPassword",\n  "options": { "encrypt": true, "trustServerCertificate": true }\n}`;
    private REST_TEMPLATE = `{\n  "baseUrl": "https://api.example.com",\n  "headers": { "Authorization": "Bearer token" }, \n  "dataPropertyPath": "data",\n  "pagination": {\n    "type": "PAGE_PARAM",\n    "key": "page",\n    "limit": 100\n  }\n}`;
    private CMD_TEMPLATE = `{\n  "format": "json" \n}`;
    private FILE_TEMPLATE = `{\n  "path": "C:\\\\Data\\\\file.csv",\n  "format": "auto"\n}`;

    sourceTypes = [
        { label: 'SQL Server', value: 'SQL_SERVER' },
        { label: 'REST API', value: 'REST_API' },
        { label: 'Local Command / Script', value: 'LOCAL_COMMAND' },
        { label: 'Local File (CSV/JSON)', value: 'LOCAL_FILE' }
    ];

    paginationTypes = [
        { label: 'None', value: 'NONE' },
        { label: 'Page Parameter', value: 'PAGE_PARAM' },
        { label: 'Next URL', value: 'NEXT_URL' }
    ];

    sqlForm!: FormGroup;
    restForm!: FormGroup;

    viewMode: 'SIMPLE' | 'JSON' = 'SIMPLE';

    authTypes = [
        { label: 'None', value: 'NONE' },
        { label: 'Basic Auth', value: 'BASIC' },
        { label: 'Dynamic Token (OAuth/Login)', value: 'DYNAMIC' }
    ];

    ngOnInit() {
        this.sourceData = this.config.data?.config;
        this.isEditing = !!this.sourceData;

        this.sourceForm = this.fb.group({
            name: ['', Validators.required],
            type: ['REST_API', Validators.required],
            config: ['', Validators.required]
        });

        // SQL Form
        this.sqlForm = this.fb.group({
            server: ['localhost', Validators.required],
            database: ['', Validators.required],
            user: ['sa', Validators.required],
            password: ['', Validators.required],
            encrypt: [true]
        });

        // REST Form
        this.restForm = this.fb.group({
            baseUrl: ['https://', Validators.required],
            dataPropertyPath: [''],
            paginationType: ['NONE'],
            paginationKey: ['page'],
            paginationNextPath: ['next'], // for NEXT_URL
            headers: ['{}'], // JSON string

            // Auth
            authType: ['NONE'],
            basicUser: [''],
            basicPass: [''],
            authUrl: [''],
            authTokenPath: ['access_token'],
            authClientId: [''],
            authClientSecret: [''],
            authCredentialPlacement: ['HEADER_BASIC'], // Default per user request
            authGrantType: ['client_credentials'],
            authScope: [''],
            authBody: ['{}']
        });

        if (this.isEditing && this.sourceData) {
            this.sourceForm.patchValue({
                name: this.sourceData.name,
                type: this.sourceData.type,
                config: this.sourceData.config
            });
            this.parseConfigToForms();
        } else {
            this.onTypeChange(); // Set defaults
        }
    }

    parseConfigToForms() {
        try {
            const json = JSON.parse(this.sourceForm.get('config')?.value || '{}');
            const type = this.sourceForm.get('type')?.value;

            if (type === 'SQL_SERVER') {
                this.sqlForm.patchValue({
                    server: json.server,
                    database: json.database,
                    user: json.user,
                    password: json.password,
                    encrypt: json.options?.encrypt ?? true
                });
            } else if (type === 'REST_API') {
                let authType = 'NONE';
                if (json.auth) authType = 'BASIC';
                else if (json.authRequest) authType = 'DYNAMIC';

                const authBody = json.authRequest?.body || {};

                // Extract known fields from body to simplify UI
                const clientId = authBody.client_id || '';
                const clientSecret = authBody.client_secret || '';
                const grantType = authBody.grant_type || 'client_credentials';
                const scope = authBody.scope || '';

                // Remove extracted fields from "Additional Params" logic to avoid duplication
                const otherParams = { ...authBody };
                delete otherParams.client_id;
                delete otherParams.client_secret;
                delete otherParams.grant_type;
                delete otherParams.scope;

                this.restForm.patchValue({
                    baseUrl: json.baseUrl,
                    dataPropertyPath: json.dataPropertyPath,
                    paginationType: json.pagination?.type || 'NONE',
                    paginationKey: json.pagination?.key || 'page',
                    paginationNextPath: json.pagination?.nextPath || 'next',
                    headers: JSON.stringify(json.headers || {}, null, 2),

                    authType: authType,
                    basicUser: json.auth?.username || '',
                    basicPass: json.auth?.password || '',
                    authUrl: json.authRequest?.url || '',
                    authTokenPath: json.authRequest?.tokenPath || 'access_token',

                    authClientId: clientId,
                    authClientSecret: clientSecret,
                    authGrantType: grantType,
                    authScope: scope,
                    authBody: JSON.stringify(otherParams, null, 2)
                });
            }
        } catch (e) {
            console.error('Failed to parse config to form', e);
            this.viewMode = 'JSON'; // Fallback
        }
    }

    syncFormsToConfig() {
        const type = this.sourceForm.get('type')?.value;
        let configObj: any = {};

        try {
            // Start with existing JSON to preserve extra fields (headers etc)
            configObj = JSON.parse(this.sourceForm.get('config')?.value || '{}');
        } catch (e) { configObj = {}; }

        if (type === 'SQL_SERVER') {
            const val = this.sqlForm.value;
            configObj.server = val.server;
            configObj.database = val.database;
            configObj.user = val.user;
            configObj.password = val.password;
            configObj.options = { ...configObj.options, encrypt: val.encrypt };
        } else if (type === 'REST_API') {
            const val = this.restForm.value;
            configObj.baseUrl = val.baseUrl;
            configObj.dataPropertyPath = val.dataPropertyPath;

            // Pagination
            if (val.paginationType !== 'NONE') {
                configObj.pagination = { type: val.paginationType, key: val.paginationKey, nextPath: val.paginationNextPath };
            } else { delete configObj.pagination; }

            // Headers
            try {
                const h = JSON.parse(val.headers || '{}');
                if (Object.keys(h).length > 0) configObj.headers = h;
                else delete configObj.headers;
            } catch (e) { /* ignore */ }

            // Auth
            delete configObj.auth;
            delete configObj.authRequest;

            if (val.authType === 'BASIC') {
                configObj.auth = { username: val.basicUser, password: val.basicPass };
            } else if (val.authType === 'DYNAMIC') {
                let body: any = {};
                configObj.authRequest = {
                    url: val.authUrl,
                    method: 'POST',
                    tokenPath: val.authTokenPath,
                };

                // Add standard OAuth fields
                if (val.authCredentialPlacement === 'HEADER_BASIC') {
                    if (val.authClientId && val.authClientSecret) {
                        const auth = btoa(val.authClientId + ':' + val.authClientSecret);
                        configObj.authRequest.headers = configObj.authRequest.headers || {};
                        configObj.authRequest.headers['Authorization'] = 'Basic ' + auth;
                    }
                } else {
                    // BODY (Default)
                    if (val.authClientId) body.client_id = val.authClientId;
                    if (val.authClientSecret) body.client_secret = val.authClientSecret;
                }

                if (val.authGrantType) body.grant_type = val.authGrantType;
                if (val.authScope) body.scope = val.authScope;

                // Merge extra params
                try {
                    const extra = JSON.parse(val.authBody || '{}');
                    body = { ...body, ...extra };
                } catch (e) { }

                configObj.authRequest.body = body;
            }
        }

        this.sourceForm.patchValue({ config: JSON.stringify(configObj, null, 2) });
    }

    onTypeChange() {
        if (!this.isEditing) {
            const type = this.sourceForm.get('type')?.value;
            let template = '';
            if (type === 'SQL_SERVER') template = this.SQL_TEMPLATE;
            else if (type === 'LOCAL_COMMAND') template = this.CMD_TEMPLATE;
            else if (type === 'LOCAL_FILE') template = this.FILE_TEMPLATE;
            else template = this.REST_TEMPLATE;

            this.sourceForm.patchValue({ config: template });

            // Auto-fill forms from template
            setTimeout(() => this.parseConfigToForms());
        }
    }

    save() {
        if (this.viewMode === 'SIMPLE') {
            this.syncFormsToConfig();
        }
        if (this.sourceForm.invalid) return;
        const formVal = this.sourceForm.getRawValue();

        try {
            JSON.parse(formVal.config);
        } catch (e) {
            this.messageService.add({ severity: 'warn', summary: 'Invalid JSON Config' });
            return;
        }

        this.loading = true;
        if (this.isEditing) {
            this.sourceService.updateSource(this.sourceData!.id!, formVal).subscribe({
                next: () => this.ref.close(true),
                error: (err) => {
                    this.loading = false;
                    this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message });
                }
            });
        } else {
            this.sourceService.createSource(formVal).subscribe({
                next: () => this.ref.close(true),
                error: (err) => {
                    this.loading = false;
                    this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message });
                }
            });
        }
    }

    cancel() {
        this.ref.close();
    }
}
