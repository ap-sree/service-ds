import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PolicyVizComponent } from './policy-viz';
import { CommonModule } from '@angular/common';
import { describe, beforeEach, it, expect } from 'vitest';

describe('PolicyVizComponent', () => {
    let component: PolicyVizComponent;
    let fixture: ComponentFixture<PolicyVizComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CommonModule, PolicyVizComponent]
        })
            .compileComponents();

        fixture = TestBed.createComponent(PolicyVizComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render SVG when data is provided', () => {
        component.data = {
            id: 'root',
            name: 'Root',
            type: 'ROOT',
            status: 'same',
            details: {},
            children: []
        };

        component.ngOnChanges({
            data: {
                previousValue: null,
                currentValue: component.data,
                firstChange: true,
                isFirstChange: () => true
            }
        });

        fixture.detectChanges();

        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });
});
