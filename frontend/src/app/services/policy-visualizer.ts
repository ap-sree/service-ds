import { Injectable } from '@angular/core';

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

    constructor() { }

    

    loadPolicy(policy: any) {
        const response = policy as PolicyResponse;

        
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

        
        if (response.authnSelectionTrees && response.authnSelectionTrees.length > 0) {
            allPolicies = response.authnSelectionTrees;
            
            tree = response.authnSelectionTrees[0];
            console.log('Loaded Policy Trees:', allPolicies.length);
        } else if (policy.items && Array.isArray(policy.items)) {
            
            allPolicies = policy.items;
            if (allPolicies.length > 0) tree = allPolicies[0];
            console.log('Loaded Items (Fragments/Policies):', allPolicies.length);
        } else if (policy.rootNode) {
            
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
