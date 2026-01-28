import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmationService } from 'primeng/api';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { CdkDrag, CdkDropList, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder } from '@angular/cdk/drag-drop';
import { FormBuilderService } from '../../../../services/form-builder.service';
import { FormSchema, ElementType, FormElement } from '../../../../models/form-builder.model';
import { FormElementComponent } from '../form-element/form-element.component';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-canvas',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, CdkDrag, CdkDropList, CdkDragHandle, CdkDragPlaceholder, FormElementComponent],
    templateUrl: './canvas.component.html',
    styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements OnInit, OnDestroy {
    private formBuilderService = inject(FormBuilderService);
    private confirmationService = inject(ConfirmationService);
    private fb = inject(FormBuilder);

    formSchema$ = this.formBuilderService.getFormSchema();
    selectedElement$ = this.formBuilderService.getSelectedElement();
    isPreviewMode$ = this.formBuilderService.getPreviewMode();

    form: FormGroup = this.fb.group({});
    private subscription: Subscription = new Subscription();

    canvasListId = 'canvas-drop-list';

    constructor() { }

    ngOnInit(): void {
        this.subscription.add(
            this.formSchema$.subscribe(schema => {
                this.rebuildForm(schema);
            })
        );
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
    }

    rebuildForm(schema: FormSchema): void {
        // Retain existing values if possible, or just rebuild.
        // For simplicity in builder, we rebuild. 
        // Ideally we should patch values back if we want persistence during drag/drop, 
        // but element.value is the source of truth in the service.

        const newGroup: any = {};
        schema.elements.forEach(element => {
            newGroup[element.id] = new FormControl(element.value || '');
        });

        // Because we can't easily replace controls in-place without losing focus/state if done naively,
        // we'll just create a new form group. 
        // NOTE: This might cause focus loss on re-render. 
        // Given this is a builder, dragging rebuilds anyway. 
        // Editing properties updates the service, which updates schema, which triggers this.
        this.form = this.fb.group(newGroup);
    }

    drop(event: CdkDragDrop<any>): void {
        if (event.previousContainer === event.container) {
            this.formBuilderService.moveElement(event.previousIndex, event.currentIndex);
        } else {
            const draggedItem = event.item.data;
            if (draggedItem && draggedItem.type) {
                this.formBuilderService.addElement(draggedItem.type as ElementType, event.currentIndex);
            }
        }
    }

    selectElement(element: FormElement): void {
        if (this.formBuilderService.getPreviewModeValue()) {
            return;
        }
        this.formBuilderService.selectElement(element);
    }

    onCanvasClick(event: Event): void {
        if (!this.formBuilderService.getPreviewModeValue()) {
            this.formBuilderService.selectElement(null);
        }
    }

    deleteElement(elementId: string): void {
        this.confirmationService.confirm({
            message: 'Are you sure you want to delete this element?',
            header: 'Delete Element',
            icon: 'pi pi-trash',
            accept: () => {
                this.formBuilderService.deleteElement(elementId);
            }
        });
    }

    trackByElementId(index: number, element: FormElement): string {
        return element.id;
    }
}
