import { Component, OnInit, inject } from '@angular/core';
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
        ReactiveFormsModule,
        ButtonModule,
        InputTextModule,
        TextareaModule,
        SelectModule,
        CheckboxModule
    ],
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

    private SQL_TEMPLATE = `{\n  "server": "localhost",\n  "database": "testdb",\n  "authentication": "ActiveDirectoryManagedIdentity",\n  "clientId": "your-mi-client-id",\n  "options": { "encrypt": true, "trustServerCertificate": true }\n}`;

    private REST_TEMPLATE = `{\n  "baseUrl": "",\n  "headers": { "Authorization": "Bearer token" }, \n  "dataPropertyPath": "data"\n}`;

    private CMD_TEMPLATE = `{\n  "format": "json" \n}`;

    private FILE_TEMPLATE = `{\n  "path": "C:\\\\Data\\\\file.csv",\n  "format": "auto"\n}`;
    private LDAP_TEMPLATE = `{\n  "url": "ldap://localhost:389",\n  "baseDn": "dc=example,dc=com",\n  "userDn": "cn=admin,dc=example,dc=com",\n  "password": "secret"\n}`;

    sourceTypes = [
        { label: 'SQL Server', value: 'SQL_SERVER' },
        { label: 'LDAP/AD Directory', value: 'LDAP' },
        { label: 'REST API', value: 'REST_API' },
        { label: 'Local Command / Script', value: 'LOCAL_COMMAND' },
        { label: 'Local File (CSV/JSON)', value: 'LOCAL_FILE' }
    ];

    sqlForm!: FormGroup;
    ldapForm!: FormGroup;
    restForm!: FormGroup;
    viewMode: 'SIMPLE' | 'JSON' = 'SIMPLE';
    authTypes = [
        { label: 'None', value: 'NONE' },
        { label: 'Basic Auth', value: 'BASIC' },
        { label: 'OAuth (Client credential)', value: 'DYNAMIC' }
    ];
    ngOnInit() {
        this.sourceData = this.config.data?.config;
        this.isEditing = !!this.sourceData;
        this.sourceForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100), Validators.pattern(/^[a-zA-Z0-9 _-]+$/)]],
            type: ['REST_API', Validators.required],
            config: ['', Validators.required]
        });
        this.sqlForm = this.fb.group({
            server: ['localhost', Validators.required],
            port: [1433, [Validators.required, Validators.min(1), Validators.max(65535)]],
            database: ['', Validators.required],
            clientId: ['', Validators.required],
            encrypt: [true]
        });
        this.ldapForm = this.fb.group({
            url: ['ldap://localhost:389', Validators.required],
            baseDn: ['', Validators.required],
            userDn: ['', Validators.required],
            password: ['', Validators.required]
        });
        this.restForm = this.fb.group({
            baseUrl: ['https://', Validators.required],
            dataPropertyPath: [''],
            headers: ['{}'],
            authType: ['NONE'],
            basicUser: [''],
            basicPass: [''],
            authUrl: [''],
            authTokenPath: ['access_token'],
            authClientId: [''],
            authClientSecret: [''],
            authCredentialPlacement: ['HEADER_BASIC'],
            authGrantType: ['client_credentials'],
            authScope: [''],
            authBody: ['{}']
        });
        this.restForm.get('authType')?.valueChanges.subscribe(authType => {
            const basicFields = ['basicUser', 'basicPass'];
            const oauthFields = ['authUrl', 'authClientId', 'authClientSecret', 'authGrantType'];
            [...basicFields, ...oauthFields].forEach(f => {
                this.restForm.get(f)?.clearValidators();
                this.restForm.get(f)?.updateValueAndValidity();
            });
            if (authType === 'BASIC') {
                basicFields.forEach(f => {
                    this.restForm.get(f)?.setValidators(Validators.required);
                    this.restForm.get(f)?.updateValueAndValidity();
                });
            } else if (authType === 'DYNAMIC') {
                oauthFields.forEach(f => {
                    this.restForm.get(f)?.setValidators(Validators.required);
                    this.restForm.get(f)?.updateValueAndValidity();
                });
            }
        });
        if (this.isEditing && this.sourceData) {
            this.sourceForm.patchValue({
                name: this.sourceData.name,
                type: this.sourceData.type,
                config: this.sourceData.config
            });
            this.parseConfigToForms();
        } else {
            this.onTypeChange();
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
                    clientId: json.clientId,
                    encrypt: json.options?.encrypt ?? true
                });
            } else if (type === 'LDAP') {
                this.ldapForm.patchValue({
                    url: json.url,
                    baseDn: json.baseDn,
                    userDn: json.userDn,
                    password: json.password
                });
            } else if (type === 'REST_API') {
                let authType = 'NONE';
                if (json.auth) authType = 'BASIC';
                else if (json.authRequest) authType = 'DYNAMIC';
                const authReq = json.authRequest || {};
                const authBody = authReq.body || {};
                const clientId = authReq.clientId || authBody.client_id || '';
                const clientSecret = authReq.clientSecret || authBody.client_secret || '';
                const grantType = authReq.grantType || authBody.grant_type || 'client_credentials';
                const scope = authReq.scope || authBody.scope || '';
                const otherParams = { ...authBody };
                if (json.authRequest?.clientId) {
                }
                delete otherParams.client_id;
                delete otherParams.client_secret;
                delete otherParams.grant_type;
                delete otherParams.scope;
                this.restForm.patchValue({
                    baseUrl: json.baseUrl,
                    dataPropertyPath: json.dataPropertyPath,
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
            this.viewMode = 'JSON';
        }
    }
    syncFormsToConfig() {
        const type = this.sourceForm.get('type')?.value;
        let configObj: any = {};
        try {
            configObj = JSON.parse(this.sourceForm.get('config')?.value || '{}');
        } catch (e) { configObj = {}; }
        if (type === 'SQL_SERVER') {
            const val = this.sqlForm.value;
            configObj.server = val.server;
            configObj.port = val.port;
            configObj.database = val.database;
            configObj.authentication = 'ActiveDirectoryManagedIdentity';
            configObj.clientId = val.clientId;
            delete configObj.user;
            delete configObj.password;
            configObj.options = { ...configObj.options, encrypt: val.encrypt };
        } else if (type === 'LDAP') {
            const val = this.ldapForm.value;
            configObj.url = val.url;
            configObj.baseDn = val.baseDn;
            configObj.userDn = val.userDn;
            configObj.password = val.password;
        } else if (type === 'REST_API') {
            const val = this.restForm.value;
            configObj.baseUrl = val.baseUrl;
            configObj.dataPropertyPath = val.dataPropertyPath;
            try {
                const h = JSON.parse(val.headers || '{}');
                if (Object.keys(h).length > 0) configObj.headers = h;
                else delete configObj.headers;
            } catch (e) { }
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
                if (val.authCredentialPlacement === 'HEADER_BASIC') {
                    if (val.authClientId && val.authClientSecret) {
                        const auth = btoa(val.authClientId + ':' + val.authClientSecret);
                        configObj.authRequest.headers = configObj.authRequest.headers || {};
                        configObj.authRequest.headers['Authorization'] = 'Basic ' + auth;
                    }
                }
                configObj.authRequest.clientId = val.authClientId;
                configObj.authRequest.clientSecret = val.authClientSecret;
                configObj.authRequest.grantType = val.authGrantType;
                configObj.authRequest.scope = val.authScope;
                if (val.authCredentialPlacement === 'BODY') {
                    if (val.authClientId) body.client_id = val.authClientId;
                    if (val.authClientSecret) body.client_secret = val.authClientSecret;
                }
                if (val.authGrantType) body.grant_type = val.authGrantType;
                if (val.authScope) body.scope = val.authScope;
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
            else if (type === 'LDAP') template = this.LDAP_TEMPLATE;
            else if (type === 'LOCAL_COMMAND') template = this.CMD_TEMPLATE;
            else if (type === 'LOCAL_FILE') template = this.FILE_TEMPLATE;
            else template = this.REST_TEMPLATE;
            this.sourceForm.patchValue({ config: template });
            setTimeout(() => this.parseConfigToForms());
        }
    }
    save() {
        if (this.viewMode === 'SIMPLE') {
            const type = this.sourceForm.get('type')?.value;
            if (type === 'SQL_SERVER' && this.sqlForm.invalid) return;
            if (type === 'LDAP' && this.ldapForm.invalid) return;
            if (type === 'REST_API' && this.restForm.invalid) return;
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
