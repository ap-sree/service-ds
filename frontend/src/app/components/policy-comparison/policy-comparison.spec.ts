import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PolicyComparisonComponent } from './policy-comparison';
import { PolicyDiffService } from '../../services/policy-diff';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { describe, beforeEach, it, expect } from 'vitest';

describe('PolicyComparisonComponent', () => {
    let component: PolicyComparisonComponent;
    let fixture: ComponentFixture<PolicyComparisonComponent>;

    beforeEach(async () => {
        const mockDiffService = {
            extractPolicies: () => [],
            comparePolicies: () => ({ id: 'root', status: 'same', children: [] })
        };

        await TestBed.configureTestingModule({
            imports: [PolicyComparisonComponent, NoopAnimationsModule, HttpClientTestingModule],
            providers: [
                { provide: PolicyDiffService, useValue: mockDiffService }
            ]
        })
            .compileComponents();

        fixture = TestBed.createComponent(PolicyComparisonComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should allow comparison when both policies are selected', () => {
        component.selectedPolicyA = { id: 'p1', name: 'P1', data: {} };
        component.selectedPolicyB = { id: 'p2', name: 'P2', data: {} };

        expect(component.canCompare()).toBe(true);
    });
});
