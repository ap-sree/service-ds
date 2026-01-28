import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { UserService, User } from '../../../../services/user.service';

@Component({
    selector: 'app-user-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule,
        ButtonModule, InputTextModule, SelectModule
    ],
    templateUrl: './user-dialog.html',
    styles: [`
    .field { margin-bottom: 1rem; }
  `]
})
export class UserDialogComponent implements OnInit {
    private fb = inject(FormBuilder);
    private userService = inject(UserService);
    private messageService = inject(MessageService);
    public ref = inject(DynamicDialogRef);
    public config = inject(DynamicDialogConfig);

    userForm!: FormGroup;
    loading = false;
    isEditing = false;
    userData: User | undefined;

    roles = [
        { label: 'Admin', value: 'ADMIN' },
        { label: 'User', value: 'USER' }
    ];

    constructor() { }

    ngOnInit() {
        this.initForm();
    }

    initForm() {
        this.userData = this.config.data?.user;
        this.isEditing = !!this.userData;

        this.userForm = this.fb.group({
            username: [{ value: '', disabled: this.isEditing }, Validators.required],
            role: ['USER', Validators.required]
        });

        if (this.isEditing && this.userData) {
            this.userForm.patchValue({
                username: this.userData.username,
                role: this.userData.role
            });
        }
    }

    save() {
        if (this.userForm.invalid) return;
        this.loading = true;

        const formVal = this.userForm.getRawValue();

        if (this.isEditing) {
            // Update User
            const updatePayload: any = { role: formVal.role };

            this.userService.updateUser(this.userData!.username, updatePayload).subscribe({
                next: () => this.ref.close(true),
                error: (err: any) => {
                    this.loading = false;
                    this.showMsg('error', 'Error: ' + err.message);
                }
            });
        } else {
            // Create User - Password omitted for SSO future
            this.userService.createUser(formVal).subscribe({
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
