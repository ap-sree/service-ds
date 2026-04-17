import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule } from 'primeng/fileupload';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToolbarModule } from 'primeng/toolbar';
import { MessageService, ConfirmationService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { CertificateService, Certificate } from '../../../../services/certificate';

@Component({
    selector: 'app-certificate-mgmt',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        TableModule,
        ButtonModule,
        InputTextModule,
        DialogModule,
        FileUploadModule,
        ToastModule,
        ConfirmDialogModule,
        ToolbarModule,
        CardModule,
        IconFieldModule,
        InputIconModule
    ],
    providers: [MessageService, ConfirmationService],
    templateUrl: './certificate-mgmt.html',
    styles: [`
        :host ::ng-deep .p-dialog-content {
            overflow-y: visible;
        }
    `]
})
export class CertificateMgmtComponent implements OnInit {
    certificates: Certificate[] = [];
    certificateDialog: boolean = false;

    certForm!: FormGroup;
    selectedFile: File | null = null;

    private certificateService = inject(CertificateService);
    private messageService = inject(MessageService);
    private confirmationService = inject(ConfirmationService);
    private fb = inject(FormBuilder);

    ngOnInit() {
        this.certForm = this.fb.group({
            alias: ['', Validators.required]
        });
        this.loadCertificates();
    }

    loadCertificates() {
        this.certificateService.getCertificates().subscribe({
            next: (data) => this.certificates = data,
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load certificates' })
        });
    }

    openNew() {
        this.certForm.reset();
        this.selectedFile = null;
        this.certificateDialog = true;
    }

    onFileSelect(event: any) {
        if (event.files && event.files.length > 0) {
            this.selectedFile = event.files[0];

            if (!this.certForm.get('alias')?.value && this.selectedFile) {
                this.certForm.patchValue({ alias: this.selectedFile.name.split('.')[0] });
            }
        }
    }

    hideDialog() {
        this.certificateDialog = false;
    }

    saveCertificate() {
        if (this.certForm.invalid || !this.selectedFile) return;

        const alias = this.certForm.get('alias')?.value;

        this.certificateService.importCertificate(alias, this.selectedFile).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Certificate Imported' });
                this.hideDialog();
                this.loadCertificates();
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Import Failed: ' + err.message });
            }
        });
    }

    deleteCertificate(cert: Certificate) {
        this.confirmationService.confirm({
            message: 'Are you sure you want to delete ' + cert.alias + '?',
            header: 'Confirm',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.certificateService.deleteCertificate(cert.alias).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Certificate Deleted' });
                        this.loadCertificates();
                    },
                    error: (err) => {
                        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Delete Failed' });
                    }
                });
            }
        });
    }
}
