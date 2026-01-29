import { Component, Input, Output, EventEmitter } from '@angular/core';

import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { FormElement } from '../../../../models/form-builder';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';

@Component({
    selector: 'app-form-element',
    standalone: true,
    imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    CheckboxModule,
    RadioButtonModule,
    SelectModule,
    DatePickerModule
],
    templateUrl: './form-element.html',
    styleUrls: ['./form-element.scss']
})
export class FormElementComponent {
    @Input() element!: FormElement;
    @Input() group!: FormGroup;
    @Input() isPreview = false;
    @Input() isSelected = false;
    @Output() deleteElement = new EventEmitter<string>();

    onDelete(event: Event): void {
        event.stopPropagation();
        this.deleteElement.emit(this.element.id);
    }
}
