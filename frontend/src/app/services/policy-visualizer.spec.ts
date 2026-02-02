import { TestBed } from '@angular/core/testing';
import { PolicyVisualizerService } from './policy-visualizer';
import { describe, beforeEach, it, expect } from 'vitest';
describe('PolicyVisualizerService', () => {
    let service: PolicyVisualizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(PolicyVisualizerService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should load a policy tree', async () => {
        const mockPolicy = {
            authnSelectionTrees: [
                { id: 'policy1', name: 'Test Policy', rootNode: {} }
            ]
        };

        service.policyTree$.subscribe(tree => {
            if (tree) {
                expect(tree.name).toBe('Test Policy');
                ;
            }
        });

        service.loadPolicy(mockPolicy);
    });

    it('should load a specialized policy (Fragment)', async () => {
        const mockFragment = {
            rootNode: { id: 'frag1', action: { type: 'AUTHN_SOURCE' } }
        };

        service.policyTree$.subscribe(tree => {
            if (tree) {
                expect(tree).toBeDefined();
                ;
            }
        });
        service.loadPolicy(mockFragment);
    });
});
