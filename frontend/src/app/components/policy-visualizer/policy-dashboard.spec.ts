import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PolicyDashboardComponent } from './policy-dashboard';
import { PolicyVisualizerService } from '../../services/policy-visualizer';
import { PolicyDiffService } from '../../services/policy-diff';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { FileUploadModule } from 'primeng/fileupload';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { describe, beforeEach, vi, it, expect } from 'vitest';

describe('PolicyDashboardComponent', () => {
    let component: PolicyDashboardComponent;
    let fixture: ComponentFixture<PolicyDashboardComponent>;
    let mockPolicyService: any;
    let mockDiffService: any;

    beforeEach(async () => {
        mockPolicyService = {
            policies$: of([]),
            policyTree$: of(null),
            selectors$: of([]), // Added missing observable
            fragments$: of([]), // Added missing observable
            loadPolicy: vi.fn()
        };

        mockDiffService = {
            visualizePolicy: vi.fn().mockReturnValue({
                id: 'root',
                name: 'Mock',
                status: 'same',
                children: []
            }),
            getNodeName: () => 'MockNode'
        };

        await TestBed.configureTestingModule({
            imports: [PolicyDashboardComponent, FileUploadModule, NoopAnimationsModule, HttpClientTestingModule],
            providers: [
                { provide: PolicyVisualizerService, useValue: mockPolicyService },
                { provide: PolicyDiffService, useValue: mockDiffService },
                MessageService
            ]
        })
            .compileComponents();

        fixture = TestBed.createComponent(PolicyDashboardComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should process uploaded file', fakeAsync(() => {
        const mockFile = {
            text: vi.fn().mockReturnValue(Promise.resolve('{"test": true}'))
        };
        const mockEvent = { files: [mockFile] };

        component.onUpload(mockEvent);
        tick(); // Wait for promise resolution

        expect(mockPolicyService.loadPolicy).toHaveBeenCalledWith({ test: true });
    }));
});
