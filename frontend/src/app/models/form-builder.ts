export enum ElementType {
    TEXT = 'text',
    EMAIL = 'email',
    PASSWORD = 'password',
    NUMBER = 'number',
    TEXTAREA = 'textarea',
    SELECT = 'select',
    CHECKBOX = 'checkbox',
    RADIO = 'radio',
    DATE = 'date',
    TIME = 'time',
    DATETIME = 'datetime-local',
    FILE = 'file',
    BUTTON = 'button',
    SUBMIT = 'submit',
    RESET = 'reset'
}

export interface FormElement {
    id: string;
    type: ElementType;
    label: string;
    name: string;
    placeholder?: string;
    required: boolean;
    value?: any;
    options?: string[];
    validators?: any[];
    styles?: { [key: string]: string };
    className?: string;
    rows?: number;
    min?: number;
    max?: number;
    step?: number;
}

export interface DraggedElement {
    type: ElementType;
    label: string;
    icon: string;
}

export interface FormSchema {
    id: string;
    name: string;
    description?: string;
    uiLibrary: 'material' | 'primeng';
    theme: string;
    elements: FormElement[];
    createdAt?: Date;
    updatedAt?: Date;
    metadata?: { [key: string]: any };
}
