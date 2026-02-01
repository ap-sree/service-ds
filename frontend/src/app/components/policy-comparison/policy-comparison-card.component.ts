import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionModule } from 'primeng/accordion';
import { TagModule } from 'primeng/tag';
import { ComparisonCard } from './policy-comparison';

@Component({
    selector: 'app-policy-comparison-card',
    standalone: true,
    imports: [CommonModule, AccordionModule, TagModule],
    template: `
        <p-accordion-panel [value]="card.context">
            <p-accordion-header>
                <div class="flex align-items-center justify-content-between w-full pr-3">
                    <span class="font-semibold">{{ card.context }}</span>
                    <p-tag [value]="getStatusLabel(card.status)" [severity]="getSeverity(card.status)" [rounded]="true"></p-tag>
                </div>
            </p-accordion-header>
            <p-accordion-content>
                <div class="card-content">
                    <div class="mb-2"><strong>Type:</strong> {{ getType() }}</div>
                    <div class="mb-2"><strong>Action:</strong> {{ getAction() }}</div>
                    <div class="mb-2">
                        <strong>Mappings:</strong>
                        <pre class="text-sm mt-1 bg-gray-50 p-2 rounded">{{ getMappings() }}</pre>
                    </div>
                    <div class="mt-3" *ngIf="card.children.length > 0">
                        <strong>Children:</strong>
                        <p-accordion [multiple]="true" styleClass="mt-2">
                            <app-policy-comparison-card *ngFor="let child of card.children" 
                                                        [card]="child" 
                                                        [column]="column">
                            </app-policy-comparison-card>
                        </p-accordion>
                    </div>
                </div>
            </p-accordion-content>
        </p-accordion-panel>
    `,
    styles: [`
        .card-content {
            font-size: 0.9rem;
        }
    `]
})
export class PolicyComparisonCardComponent {
    @Input() card!: ComparisonCard;
    @Input() column!: 'a' | 'b' | 'c';

    getType(): string {
        return this.card.details.type[this.column];
    }

    getAction(): string {
        return this.card.details.action[this.column];
    }

    getMappings(): string {
        return this.card.details.mappings[this.column];
    }

    getSeverity(status: ComparisonCard['status']): 'success' | 'warn' | 'info' | 'danger' {
        switch (status) {
            case 'identical': return 'success';
            case 'modified': return 'warn';
            case 'new-in-b':
            case 'new-in-c': return 'info';
            case 'missing-in-b':
            case 'missing-in-c': return 'danger';
        }
    }

    getStatusLabel(status: ComparisonCard['status']): string {
        switch (status) {
            case 'identical': return '✓ Identical';
            case 'modified': return '⚠ Modified';
            case 'new-in-b': return '+ New in B';
            case 'new-in-c': return '+ New in C';
            case 'missing-in-b': return '− Missing in B';
            case 'missing-in-c': return '− Missing in C';
        }
    }
}
