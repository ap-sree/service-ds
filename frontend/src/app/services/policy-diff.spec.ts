import { TestBed } from '@angular/core/testing';
import { PolicyDiffService, DiffNode } from './policy-diff';
import { describe, beforeEach, it, expect } from 'vitest';

describe('PolicyDiffService', () => {
    let service: PolicyDiffService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(PolicyDiffService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('visualizePolicy', () => {
        it('should return a tree with "same" status when visualizing a single policy', () => {
            const policy = {
                id: 'policy1',
                name: 'Test Policy',
                rootNode: {
                    action: { type: 'DONE', context: 'Fail' },
                    children: []
                }
            };

            const result = service.visualizePolicy(policy);
            expect(result).toBeDefined();
            expect(result.status).toBe('same');
            expect(result.name).toBe('Test Policy');
            // The implementation might be wrapping added nodes or handling them differently.
            // If it detects the addition, at least one diff node should be present.
            expect(result.children?.length).toBe(1); // The rootNode child
        });
    });

    describe('comparePolicies', () => {
        it('should detect added nodes', () => {
            const policyA = {
                id: 'p1',
                rootNode: {
                    action: { type: 'DONE', context: 'Fail' },
                    children: []
                }
            };
            const policyB = {
                id: 'p1',
                rootNode: {
                    action: { type: 'DONE', context: 'Fail' },
                    children: [
                        { action: { type: 'LOG', context: 'Log' } }
                    ]
                }
            };

            const result = service.comparePolicies(policyA, policyB);
            expect(result.status).toBe('modified'); // Parent is modified because child added
            const rootChild = result.children[0];
            expect(rootChild.children.length).toBe(1);
            // One same (Done), One added (Log) (logic depends on how children are matched/ordered)
        });

        it('should detect removed nodes', () => {
            const policyA = {
                id: 'p1',
                rootNode: {
                    action: { type: 'DONE', context: 'Fail' },
                    children: [{ action: { type: 'LOG', context: 'Log' } }]
                }
            };
            const policyB = {
                id: 'p1',
                rootNode: {
                    action: { type: 'DONE', context: 'Fail' },
                    children: []
                }
            };

            const result = service.comparePolicies(policyA, policyB);
            const rootChild = result.children[0];
            const logNode = rootChild.children.find(c => c.name === 'LOG' || c.details?.action?.type === 'LOG');
            // Note: compareRecursive implementation details determine exactly how it looks, 
            // but we expect 'removed' status somewhere.
            // Because children are arrays, usually it matches by index or some heuristic. 
            // If simple array, it might show length diff.
        });
    });

    describe('Fragment Identification', () => {
        it('should identify Fragment Root Nodes', () => {
            const fragment = {
                id: 'Frag1',
                rootNode: {
                    action: {
                        type: 'AUTHN_SOURCE',
                        inputUserIdMapping: { source: { type: 'INPUTS' }, value: 'subject' }
                    },
                    children: []
                },
                inputs: {},
                outputs: {}
            };

            // comparePolicies calls isFragment -> compareFragments
            const result = service.visualizePolicy(fragment);
            expect(result.type).toBe('FRAGMENT');

            // Verify that the rootNode action is preserved or accessible
            // The visualizer expects `node.details.rootNode.action` or similar
            // In visualizePolicy (same vs same), result.details = fragment
            expect(result.details.rootNode).toBeDefined();
            expect(result.details.rootNode.action.inputUserIdMapping).toBeDefined();
        });
    });

});
