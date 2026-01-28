import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { PolicyResponse, AuthenticationPolicyTree, AuthenticationPolicyFragment } from '../models/policy-visualizer';

@Injectable({
    providedIn: 'root'
})
export class PolicyVisualizerService {
    private policyTreeSubject = new BehaviorSubject<AuthenticationPolicyTree | null>(null);
    policyTree$ = this.policyTreeSubject.asObservable();

    private policiesSubject = new BehaviorSubject<AuthenticationPolicyTree[]>([]);
    policies$ = this.policiesSubject.asObservable();

    private fragmentsMap = new Map<string, AuthenticationPolicyFragment>();
    private fragmentsSubject = new BehaviorSubject<AuthenticationPolicyFragment[]>([]);
    fragments$ = this.fragmentsSubject.asObservable();

    private selectorsSubject = new BehaviorSubject<any[]>([]);
    selectors$ = this.selectorsSubject.asObservable();

    constructor(private http: HttpClient) { }

    loadSampleData() {
        this.http.get<any>('/sample-data/policy.json').subscribe({
            next: (data) => {
                console.log('Loaded sample data automatically');
                this.loadPolicy(data);
            },
            error: (err) => console.error('Failed to load sample data', err)
        });
    }

    loadPoliciesFromAsset() {
        this.http.get<any>('/assets/policy-tree.json').subscribe({
            next: (data) => {
                const policies = data.authnSelectionTrees || [];
                // Handle different JSON structures if necessary
                this.policiesSubject.next(policies);
                if (policies.length > 0) {
                    this.policyTreeSubject.next(policies[0]);
                }
            },
            error: (err) => console.error('Failed to load policies', err)
        });
    }

    loadFragmentsFromAsset(updatePolicies: boolean = false) {
        this.http.get<any>('/assets/policy-fragment.json').subscribe({
            next: (data) => {
                const fragments = (data.items || []).map((item: any) => ({
                    ...item,
                    // Treat fragments as trees for visualization
                }));
                this.fragmentsSubject.next(fragments);

                if (updatePolicies) {
                    this.policiesSubject.next(fragments);
                    if (fragments.length > 0) {
                        this.policyTreeSubject.next(fragments[0]);
                    }
                }
            },
            error: (err) => console.error('Failed to load fragments', err)
        });
    }

    loadSelectorsFromAsset() {
        this.http.get<any>('/assets/policy-selectors.json').subscribe({
            next: (data) => {
                // Selectors are flat list items, we wrap them in a pseudo-tree node to visualize
                const selectors = data.items || [];
                this.selectorsSubject.next(selectors);
                // Also optionally emit to policiesSubject if we want them in the generic list, but we removed the tab.
                // this.policiesSubject.next(selectors); 
            },
            error: (err) => console.error('Failed to load selectors', err)
        });
    }

    loadPolicy(policy: any) {
        const response = policy as PolicyResponse;

        // Store Fragments if available
        if (response.authenticationPolicyFragments) {
            response.authenticationPolicyFragments.forEach((frag: AuthenticationPolicyFragment) => {
                if (frag.id) {
                    this.fragmentsMap.set(frag.id, frag);
                }
            });
            this.fragmentsSubject.next(Array.from(this.fragmentsMap.values()));
        }

        let tree: AuthenticationPolicyTree | null = null;
        let allPolicies: AuthenticationPolicyTree[] = [];

        // Check for new structure: authnSelectionTrees
        if (response.authnSelectionTrees && response.authnSelectionTrees.length > 0) {
            allPolicies = response.authnSelectionTrees;
            // Default to the first tree for now
            tree = response.authnSelectionTrees[0];
            console.log('Loaded Policy Trees:', allPolicies.length);
        } else if (policy.rootNode) {
            // Fallback for direct Tree object or Fragment
            tree = policy as AuthenticationPolicyTree;
            allPolicies = [tree];
        }

        this.policiesSubject.next(allPolicies);

        if (tree) {
            this.policyTreeSubject.next(tree);
        } else {
            console.error('Could not identify Policy Tree in the uploaded JSON');
        }
    }

    getFragment(id: string): AuthenticationPolicyFragment | undefined {
        return this.fragmentsMap.get(id);
    }

    clearPolicy() {
        this.policyTreeSubject.next(null);
        this.fragmentsMap.clear();
        this.fragmentsSubject.next([]);
    }
}
