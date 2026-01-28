import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { FormElement, FormSchema, ElementType } from '../models/form-builder.model';

@Injectable({
    providedIn: 'root'
})
export class FormBuilderService {
    private formSchema$ = new BehaviorSubject<FormSchema>({
        id: this.generateId(),
        name: 'New Form',
        uiLibrary: 'material',
        theme: 'default',
        elements: []
    });

    private selectedElement$ = new BehaviorSubject<FormElement | null>(null);
    private previewMode$ = new BehaviorSubject<boolean>(false);

    constructor() {
        this.loadFromStorage();
    }

    getFormSchema(): Observable<FormSchema> {
        return this.formSchema$.asObservable();
    }

    getSelectedElement(): Observable<FormElement | null> {
        return this.selectedElement$.asObservable();
    }

    getPreviewMode(): Observable<boolean> {
        return this.previewMode$.asObservable();
    }

    getPreviewModeValue(): boolean {
        return this.previewMode$.value;
    }

    addElement(type: ElementType, index?: number): void {
        const newElement: FormElement = {
            id: this.generateId(),
            type,
            label: this.getDefaultLabel(type),
            name: `field_${Date.now()}`,
            required: false,
            placeholder: '',
            options: this.getDefaultOptions(type)
        };

        const currentSchema = this.formSchema$.value;
        const elements = [...currentSchema.elements];

        if (index !== undefined) {
            elements.splice(index, 0, newElement);
        } else {
            elements.push(newElement);
        }

        this.updateFormSchema({ ...currentSchema, elements });
        this.selectElement(newElement);
    }

    updateElement(elementId: string, updates: Partial<FormElement>): void {
        const currentSchema = this.formSchema$.value;
        const elements = currentSchema.elements.map(el =>
            el.id === elementId ? { ...el, ...updates } : el
        );

        this.updateFormSchema({ ...currentSchema, elements });
    }

    deleteElement(elementId: string): void {
        const currentSchema = this.formSchema$.value;
        const elements = currentSchema.elements.filter(el => el.id !== elementId);

        this.updateFormSchema({ ...currentSchema, elements });

        if (this.selectedElement$.value?.id === elementId) {
            this.selectedElement$.next(null);
        }
    }

    moveElement(fromIndex: number, toIndex: number): void {
        const currentSchema = this.formSchema$.value;
        const elements = [...currentSchema.elements];
        const [movedElement] = elements.splice(fromIndex, 1);
        elements.splice(toIndex, 0, movedElement);

        this.updateFormSchema({ ...currentSchema, elements });
    }

    selectElement(element: FormElement | null): void {
        this.selectedElement$.next(element);
    }

    togglePreviewMode(): void {
        this.previewMode$.next(!this.previewMode$.value);
        this.selectedElement$.next(null);
    }

    clearForm(): void {
        const currentSchema = this.formSchema$.value;
        this.updateFormSchema({ ...currentSchema, elements: [] });
        this.selectedElement$.next(null);
    }

    updateFormSchema(schema: FormSchema): void {
        this.formSchema$.next(schema);
        this.saveToStorage();
    }

    loadSampleForm(): void {
        const sampleSchema: FormSchema = {
            id: this.generateId(),
            name: 'Sample Registration Form',
            uiLibrary: 'material',
            theme: 'default',
            elements: [
                {
                    id: this.generateId(),
                    type: ElementType.TEXT,
                    label: 'First Name',
                    name: 'firstName',
                    placeholder: 'Enter your first name',
                    required: true
                },
                {
                    id: this.generateId(),
                    type: ElementType.TEXT,
                    label: 'Last Name',
                    name: 'lastName',
                    placeholder: 'Enter your last name',
                    required: true
                },
                {
                    id: this.generateId(),
                    type: ElementType.EMAIL,
                    label: 'Email Address',
                    name: 'email',
                    placeholder: 'your@email.com',
                    required: true
                },
                {
                    id: this.generateId(),
                    type: ElementType.SELECT,
                    label: 'Country',
                    name: 'country',
                    required: true,
                    options: ['United States', 'Canada', 'United Kingdom', 'Australia', 'India']
                },
                {
                    id: this.generateId(),
                    type: ElementType.RADIO,
                    label: 'Gender',
                    name: 'gender',
                    required: false,
                    options: ['Male', 'Female', 'Other']
                },
                {
                    id: this.generateId(),
                    type: ElementType.CHECKBOX,
                    label: 'Interests',
                    name: 'interests',
                    required: false,
                    options: ['Technology', 'Sports', 'Music', 'Travel', 'Reading']
                },
                {
                    id: this.generateId(),
                    type: ElementType.TEXTAREA,
                    label: 'About Yourself',
                    name: 'about',
                    placeholder: 'Tell us about yourself...',
                    required: false,
                    rows: 4
                },
                {
                    id: this.generateId(),
                    type: ElementType.SUBMIT,
                    label: 'Submit',
                    name: 'submit',
                    required: false
                }
            ]
        };

        this.updateFormSchema(sampleSchema);
    }

    private generateId(): string {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }

    private getDefaultLabel(type: ElementType): string {
        const labels: { [key: string]: string } = {
            [ElementType.TEXT]: 'Text Input',
            [ElementType.EMAIL]: 'Email Address',
            [ElementType.PASSWORD]: 'Password',
            [ElementType.NUMBER]: 'Number',
            [ElementType.TEXTAREA]: 'Text Area',
            [ElementType.SELECT]: 'Dropdown',
            [ElementType.CHECKBOX]: 'Checkbox Group',
            [ElementType.RADIO]: 'Radio Group',
            [ElementType.DATE]: 'Date Picker',
            [ElementType.TIME]: 'Time Picker',
            [ElementType.DATETIME]: 'Date & Time',
            [ElementType.FILE]: 'File Upload',
            [ElementType.BUTTON]: 'Button',
            [ElementType.SUBMIT]: 'Submit Button',
            [ElementType.RESET]: 'Reset Button'
        };

        return labels[type] || 'Form Field';
    }

    private getDefaultOptions(type: ElementType): string[] | undefined {
        if ([ElementType.SELECT, ElementType.RADIO, ElementType.CHECKBOX].includes(type)) {
            return ['Option 1', 'Option 2', 'Option 3'];
        }
        return undefined;
    }

    private saveToStorage(): void {
        try {
            localStorage.setItem('formBuilderSchema', JSON.stringify(this.formSchema$.value));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }

    private loadFromStorage(): void {
        try {
            const saved = localStorage.getItem('formBuilderSchema');
            if (saved) {
                const schema = JSON.parse(saved);
                this.formSchema$.next(schema);
            }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
        }
    }
}
