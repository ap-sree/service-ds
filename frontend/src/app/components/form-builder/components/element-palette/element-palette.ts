import { Component } from '@angular/core';

import { CdkDrag, CdkDropList, CdkDragPreview } from '@angular/cdk/drag-drop';
import { ElementType, DraggedElement } from '../../../../models/form-builder';
import { TooltipModule } from 'primeng/tooltip';

@Component({
    selector: 'app-element-palette',
    standalone: true,
    imports: [CdkDrag, CdkDropList, CdkDragPreview, TooltipModule],
    templateUrl: './element-palette.html',
    styleUrls: ['./element-palette.scss']
})
export class ElementPaletteComponent {
    paletteListId = 'element-palette-list';

    elements: DraggedElement[] = [
        { type: ElementType.TEXT, label: 'Text Input', icon: 'pi pi-align-left' },
        { type: ElementType.EMAIL, label: 'Email', icon: 'pi pi-at' },
        { type: ElementType.PASSWORD, label: 'Password', icon: 'pi pi-lock' },
        { type: ElementType.NUMBER, label: 'Number', icon: 'pi pi-hashtag' },
        { type: ElementType.TEXTAREA, label: 'Text Area', icon: 'pi pi-align-justify' },
        { type: ElementType.SELECT, label: 'Dropdown', icon: 'pi pi-chevron-down' },
        { type: ElementType.CHECKBOX, label: 'Checkbox', icon: 'pi pi-check-square' },
        { type: ElementType.RADIO, label: 'Radio', icon: 'pi pi-stop-circle' },
        { type: ElementType.DATE, label: 'Date', icon: 'pi pi-calendar' },
        { type: ElementType.TIME, label: 'Time', icon: 'pi pi-clock' },
        { type: ElementType.FILE, label: 'File Upload', icon: 'pi pi-upload' },
        { type: ElementType.BUTTON, label: 'Button', icon: 'pi pi-box' },
        { type: ElementType.SUBMIT, label: 'Submit', icon: 'pi pi-send' }
    ];
}
