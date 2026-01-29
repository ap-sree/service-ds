import { Component, inject } from '@angular/core';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormBuilderService } from '../../services/form-builder';
import { ExportService } from '../../services/export';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ElementPaletteComponent } from './components/element-palette/element-palette';
import { CanvasComponent } from './components/canvas/canvas';
import { PropertiesPanelComponent } from './components/properties-panel/properties-panel';

@Component({
    selector: 'app-form-builder',
    standalone: true,
    imports: [
        CommonModule,
        ButtonModule,
        ToolbarModule,
        ToastModule,
        ConfirmDialogModule,
        ElementPaletteComponent,
        CanvasComponent,
        PropertiesPanelComponent
    ],
    providers: [MessageService, ConfirmationService],
    templateUrl: './form-builder.html',
    styleUrls: ['./form-builder.scss']
})
export class FormBuilderComponent {
    private readonly formBuilderService = inject(FormBuilderService);
    isPreviewMode$ = this.formBuilderService.getPreviewMode();
    selectedElement$ = this.formBuilderService.getSelectedElement();

    constructor(
        private readonly exportService: ExportService,
        private readonly messageService: MessageService,
        private readonly confirmationService: ConfirmationService
    ) { }

    togglePreview(): void {
        this.formBuilderService.togglePreviewMode();
    }

    exportJSON(): void {
        this.formBuilderService.getFormSchema().pipe(take(1)).subscribe(schema => {
            const json = this.exportService.exportToJSON(schema);
            this.exportService.downloadFile(json, 'form-schema.json', 'application/json');
            this.showMessage('success', 'Form exported as JSON');
        });
    }

    exportHTML(): void {
        this.formBuilderService.getFormSchema().pipe(take(1)).subscribe(schema => {
            const html = this.exportService.exportToHTML(schema);
            this.exportService.downloadFile(html, 'form.html', 'text/html');
            this.showMessage('success', 'Form exported as HTML');
        });
    }

    clearForm(): void {
        this.confirmationService.confirm({
            message: 'Are you sure you want to clear all form elements?',
            header: 'Clear Form',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.formBuilderService.clearForm();
                this.showMessage('info', 'Form cleared');
            }
        });
    }

    loadSample(): void {
        this.formBuilderService.loadSampleForm();
        this.showMessage('info', 'Sample form loaded');
    }

    private showMessage(severity: string, detail: string): void {
        this.messageService.add({ severity, summary: 'Form Builder', detail });
    }
}
