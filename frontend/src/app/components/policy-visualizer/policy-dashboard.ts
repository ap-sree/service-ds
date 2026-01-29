import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileUploadModule } from 'primeng/fileupload';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { CardModule } from 'primeng/card';
import { ListboxModule } from 'primeng/listbox';
import { FormsModule } from '@angular/forms';
import { SplitterModule } from 'primeng/splitter';

import { PolicyVisualizerService } from '../../services/policy-visualizer';
import { PolicyVisualizerComponent } from './policy-visualizer';

@Component({
    selector: 'app-policy-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        FileUploadModule,
        TableModule,
        TabsModule,
        CardModule,
        ListboxModule,
        SplitterModule,
        PolicyVisualizerComponent
    ],
    templateUrl: './policy-dashboard.html',
    styles: [`
        :host {
            display: block;
            height: calc(100vh - 4rem); 
        }
    `]
})
export class PolicyDashboardComponent implements OnInit {

    groupedPolicies: any[] = []; // Can be SelectItemGroup[] or just any[]
    selectors: any[] = []; // Store selectors for visualizer lookup
    fragments: any[] = []; // Store fragments for visualizer lookup
    selectedPolicy: any = null;
    currentTab: string = 'policies';
    isGrouped: boolean = false;
    totalItemsCount: number = 0;

    constructor(public policyService: PolicyVisualizerService) {
        // Main list subscription
        this.policyService.policies$.subscribe((items: any[]) => {
            // If we are loading selectors for the visualizer background, we don't want to replace the main list IF we are on policies tab. 
            // But the service currently uses a shared subject.
            // We will refactor service to separate them.
            // For now assume this only receives policies/fragments based on tab.
            if (this.currentTab === 'selectors') {
                // We don't have a selectors tab anymore, so we shouldn't be here.
                // But if we reuse this subject, we need to be careful.
                // We'll fix the service to use a separate subject for Selectors.
            }

            if (items && items.length > 0) {
                this.processItems(items);
                // Auto-select
                if (!this.selectedPolicy) {
                    if (this.isGrouped && this.groupedPolicies.length > 0) {
                        this.selectedPolicy = this.groupedPolicies[0].items[0].value;
                    } else if (!this.isGrouped && this.groupedPolicies.length > 0) {
                        this.selectedPolicy = this.groupedPolicies[0].value;
                    }
                }
            } else {
                this.groupedPolicies = [];
                this.totalItemsCount = 0;
                this.selectedPolicy = null;
            }
        });

        this.policyService.selectors$.subscribe((selectors: any[]) => {
            this.selectors = selectors;
        });

        // Subscribe to fragments separately
        this.policyService.fragments$.subscribe((fragments: any[]) => {
            this.fragments = fragments;
        });
    }

    ngOnInit() {
        // Default load policies
        this.loadTab('policies');
        // Pre-load selectors for the visualizer
        this.policyService.loadSelectorsFromAsset();
        // Pre-load fragments for the visualizer
        this.policyService.loadFragmentsFromAsset(false);
    }

    loadTab(tab: string) {
        this.currentTab = tab;
        this.selectedPolicy = null; // Clear selection on tab switch

        switch (tab) {
            case 'policies':
                this.policyService.loadPoliciesFromAsset();
                break;
            case 'selectors':
                this.policyService.loadSelectorsFromAsset();
                break;
            case 'fragments':
                this.policyService.loadFragmentsFromAsset(true);
                break;
        }
    }

    processItems(items: any[]) {
        this.groupedPolicies = [];
        this.isGrouped = false;
        this.totalItemsCount = items.length;

        // Map items based on type
        this.groupedPolicies = items.map(i => {
            let label = i.name || i.id;
            // Fragments might have a different structure, ensure label is found
            if (!label && i.rootNode) label = 'Fragment ' + i.id;

            // For selectors, we might not have name/id at root if it's just the object
            if (this.currentTab === 'selectors' && !label) {
                label = i.instanceId || i.pluginDescriptorRef?.id || 'Selector';
            }

            // Determine Icon
            let icon = 'pi pi-file';
            if (this.currentTab === 'policies') icon = 'pi pi-sitemap';
            else if (this.currentTab === 'fragments') icon = 'pi pi-bolt';
            else if (this.currentTab === 'selectors') icon = 'pi pi-cog';

            return {
                label: label,
                value: i,
                icon: icon
            };
        });
    }

    getPolicyDisplayName(policy: any): string {
        if (!policy) return '';
        let displayName = policy.name || policy.id;
        if (!displayName && policy.rootNode?.action) {
            displayName = policy.rootNode.action.name || policy.rootNode.action.id;
            if (!displayName && policy.rootNode.action.authenticationSelectorRef) {
                displayName = policy.rootNode.action.authenticationSelectorRef.id;
            }
        }
        return displayName || 'Untitled Policy';
    }

    findContractId(node: any): string | null {
        if (!node?.action) return null;
        const action = node.action;

        if (action.type === 'APC_MAPPING' && action.authenticationPolicyContractRef?.id) {
            return action.authenticationPolicyContractRef.id;
        }

        // Ensure robust access to children on the node object, not the action
        // Use 'any' cast if necessary to bypass stale type checks or interface mismatch during compilation
        const children = node.children;
        if (children && Array.isArray(children)) {
            for (const childWrapper of children) {
                const res = this.findContractId(childWrapper);
                if (res) return res;
            }
        }
        return null;
    }

    onUpload(event: any) {
        const file = event.files[0];
        file.text().then((text: string) => {
            try {
                const json = JSON.parse(text);
                this.policyService.loadPolicy(json);
            } catch (error) {
                console.error('Error parsing JSON', error);
            }
        });
    }
}
