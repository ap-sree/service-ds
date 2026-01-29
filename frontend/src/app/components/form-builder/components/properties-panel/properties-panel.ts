import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { FormBuilderService } from '../../../../services/form-builder';
import { FormElement } from '../../../../models/form-builder';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

@Component({
    selector: 'app-properties-panel',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, InputTextModule, InputNumberModule, TextareaModule, CheckboxModule, ToggleSwitchModule],
    templateUrl: './properties-panel.html',
    styleUrls: ['./properties-panel.scss']
})
export class PropertiesPanelComponent implements OnInit, OnDestroy {
    private formBuilderService = inject(FormBuilderService);
    private fb = inject(FormBuilder);

    selectedElement$ = this.formBuilderService.getSelectedElement();
    private destroy$ = new Subject<void>();
    private currentElementId: string | null = null;

    propertiesForm: FormGroup = this.fb.group({
        label: [''],
        name: [''],
        placeholder: [''],
        required: [false],
        options: ['', { updateOn: 'blur' }], // Update options on blur to prevent cursor jumping
        rows: [4],
        min: [null],
        max: [null]
    });

    constructor() { }

    ngOnInit(): void {
        this.selectedElement$
            .pipe(takeUntil(this.destroy$))
            .subscribe((element: FormElement | null) => {
                if (!element) {
                    this.currentElementId = null;
                    this.propertiesForm.reset({}, { emitEvent: false });
                    return;
                }

                this.currentElementId = element.id;

                // Sync Store -> Form (Only patch if changed to update cursor/state correctly)
                this.patchIfChanged('label', element.label);
                this.patchIfChanged('name', element.name);
                this.patchIfChanged('placeholder', element.placeholder || '');
                this.patchIfChanged('required', element.required || false);
                this.patchIfChanged('rows', element.rows || 4);
                this.patchIfChanged('min', element.min || null);
                this.patchIfChanged('max', element.max || null);

                const newOptions = element.options ? element.options.join('\n') : '';
                this.patchIfChanged('options', newOptions);
            });

        this.propertiesForm.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(values => {
                if (!this.currentElementId) return;

                const updates: Partial<FormElement> = { ...values };

                // Handle options conversion
                if (typeof values.options === 'string') {
                    updates.options = values.options.split('\n').filter((opt: string) => opt.trim().length > 0);
                }

                this.formBuilderService.updateElement(this.currentElementId, updates);
            });
    }

    private patchIfChanged(controlName: string, newValue: any): void {
        const control = this.propertiesForm.get(controlName);
        if (control && control.value !== newValue) {
            control.setValue(newValue, { emitEvent: false });
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
