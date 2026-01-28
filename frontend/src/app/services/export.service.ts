import { Injectable } from '@angular/core';
import { FormSchema } from '../models/form-builder.model';

@Injectable({
    providedIn: 'root'
})
export class ExportService {

    exportToJSON(schema: FormSchema): string {
        return JSON.stringify(schema, null, 2);
    }

    exportToHTML(schema: FormSchema): string {
        return this.generateHTML(schema);
    }

    downloadFile(content: string, filename: string, type: string): void {
        const blob = new Blob([content], { type });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
    }

    private generateHTML(schema: FormSchema): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${schema.name}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <div class="container mt-5">
        <h1>${schema.name}</h1>
        <form>
            ${schema.elements.map(el => this.renderElement(el)).join('\n')}
        </form>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;
    }

    private renderElement(element: any): string {
        const required = element.required ? 'required' : '';
        const placeholder = element.placeholder ? `placeholder="${element.placeholder}"` : '';
        const id = element.id;

        switch (element.type) {
            case 'text':
            case 'email':
            case 'password':
            case 'number':
            case 'date':
                return `
            <div class="mb-3">
                <label for="${id}" class="form-label">${element.label}</label>
                <input type="${element.type}" class="form-control" id="${id}" name="${element.name}" ${placeholder} ${required}>
            </div>`;

            case 'textarea':
                return `
            <div class="mb-3">
                <label for="${id}" class="form-label">${element.label}</label>
                <textarea class="form-control" id="${id}" name="${element.name}" rows="${element.rows || 3}" ${placeholder} ${required}></textarea>
            </div>`;

            case 'select':
                const options = (element.options || []).map((opt: string) => `<option value="${opt}">${opt}</option>`).join('');
                return `
            <div class="mb-3">
                <label for="${id}" class="form-label">${element.label}</label>
                <select class="form-select" id="${id}" name="${element.name}" ${required}>
                     <option value="" selected disabled>Select an option</option>
                     ${options}
                </select>
            </div>`;

            case 'checkbox':
                return `
            <div class="mb-3">
                <label class="form-label d-block">${element.label}</label>
                ${(element.options || []).map((opt: string, idx: number) => `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="${opt}" id="${id}_${idx}" name="${element.name}">
                    <label class="form-check-label" for="${id}_${idx}">
                        ${opt}
                    </label>
                </div>`).join('')}
            </div>`;

            case 'radio':
                return `
            <div class="mb-3">
                <label class="form-label d-block">${element.label}</label>
                ${(element.options || []).map((opt: string, idx: number) => `
                <div class="form-check">
                    <input class="form-check-input" type="radio" name="${element.name}" value="${opt}" id="${id}_${idx}">
                    <label class="form-check-label" for="${id}_${idx}">
                        ${opt}
                    </label>
                </div>`).join('')}
            </div>`;

            case 'button':
                return `<div class="mb-3"><button type="button" class="btn btn-primary w-100">${element.label}</button></div>`;

            case 'submit':
                return `<div class="mb-3"><button type="submit" class="btn btn-primary w-100">${element.label}</button></div>`;

            default:
                return '';
        }
    }
}
