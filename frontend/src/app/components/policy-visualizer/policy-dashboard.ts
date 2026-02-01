import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FileUploadModule } from 'primeng/fileupload';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { CardModule } from 'primeng/card';
import { ListboxModule } from 'primeng/listbox';
import { SplitterModule } from 'primeng/splitter';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { BadgeModule } from 'primeng/badge';
import { DialogModule } from 'primeng/dialog';

import { PolicyVisualizerService } from '../../services/policy-visualizer';
import { PolicyDiffService, DiffNode } from '../../services/policy-diff';
import { PolicyVizComponent } from '../../components/policy-viz/policy-viz';

@Component({
    selector: 'app-policy-dashboard',
    standalone: true,
    imports: [
        FormsModule,
        FileUploadModule,
        TableModule,
        TabsModule,
        CardModule,
        ListboxModule,
        SplitterModule,
        ButtonModule,
        InputTextModule,
        BadgeModule,
        DialogModule,
        PolicyVizComponent
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

    groupedPolicies: any[] = [];
    selectors: any[] = [];
    fragments: any[] = [];
    selectedPolicy: any = null;
    currentTab: string = 'policies';
    isGrouped: boolean = false;
    totalItemsCount: number = 0;
    searchText: string = '';

    currentTree: DiffNode | null = null; 

    constructor(
        public policyService: PolicyVisualizerService,
        private diffService: PolicyDiffService
    ) {
        this.policyService.policies$.subscribe((items: any[]) => {
            if (items && items.length > 0) {
                this.processItems(items);
                if (!this.selectedPolicy) {
                    
                    const first = this.isGrouped && this.groupedPolicies.length > 0 ? this.groupedPolicies[0].items[0].value : (this.groupedPolicies.length > 0 ? this.groupedPolicies[0].value : null);
                    if (first) this.onSelectPolicy(first);
                }
            } else {
                this.groupedPolicies = [];
                this.totalItemsCount = 0;
                this.selectedPolicy = null;
                this.currentTree = null;
            }
        });

        this.policyService.selectors$.subscribe((selectors: any[]) => {
            this.selectors = selectors;
        });

        this.policyService.fragments$.subscribe((fragments: any[]) => {
            this.fragments = fragments;
        });
    }

    ngOnInit() {
        
        this.loadTab('policies');
    }

    filteredPolicies() {
        if (!this.searchText) return this.groupedPolicies;
        return this.groupedPolicies.filter(p =>
            p.label.toLowerCase().includes(this.searchText.toLowerCase())
        );
    }

    loadTab(tab: string) {
        this.currentTab = tab;
        this.selectedPolicy = null;
        
    }

    loadPolicies() {
        this.loadTab('policies');
    }

    onSearchChange(event: any) {
        this.searchText = event.target.value;
    }

    onSelectPolicy(policy: any) {
        console.log('PolicyVisualizer: onSelectPolicy', policy);
        this.selectedPolicy = policy;
        if (policy) {
            
            const dataToVisualize = policy.data || policy;
            console.log('PolicyVisualizer: visualizing data', dataToVisualize);
            this.currentTree = this.diffService.visualizePolicy(dataToVisualize);
            console.log('PolicyVisualizer: currentTree generated', this.currentTree);
        } else {
            this.currentTree = null;
        }
    }

    detailsVisible: boolean = false;
    selectedNode: DiffNode | null = null;
    mappingData: any[] = [];

    onNodeSelected(node: DiffNode) {
        this.selectedNode = node;
        this.mappingData = [];

        if (!node || !node.details) {
            this.detailsVisible = !!node;
            return;
        }

        
        const action = node.details.action || node.details.rootNode?.action;

        if (!action) {
            this.detailsVisible = !!node;
            return;
        }
        let mapping = null;

        
        if (action.attributeContractFulfillment) {
            mapping = action.attributeContractFulfillment;
        }
        
        else if (action.fragmentMapping?.attributeContractFulfillment) {
            mapping = action.fragmentMapping.attributeContractFulfillment;
        }
        
        else if (action.fragment?.attributeMapping?.attributeContractFulfillment) {
            mapping = action.fragment.attributeMapping.attributeContractFulfillment;
        }
        
        else if (action.fragment?.attributeMapping) {
            mapping = action.fragment.attributeMapping;
        }
        
        else if (action.attributeMapping?.attributeContractFulfillment) {
            mapping = action.attributeMapping.attributeContractFulfillment;
        }
        
        else if (action.attributeMapping) {
            mapping = action.attributeMapping;
        }
        
        else if (action.inputUserIdMapping) {
            mapping = { "USER_KEY": action.inputUserIdMapping };
        }

        if (mapping) {
            this.mappingData = Object.keys(mapping).map(key => {
                const item = mapping[key];
                
                const sourceObj = item?.source;
                let displayValue = '';

                if (sourceObj) {
                    if (sourceObj.type === 'TEXT') displayValue = sourceObj.value;
                    else if (sourceObj.type === 'EXPRESSION') displayValue = '${' + sourceObj.value + '}';
                    else {
                        let prefix = sourceObj.type;
                        if (sourceObj.id) prefix += ` (${sourceObj.id})`;

                        
                        const val = sourceObj.value || item.value;
                        displayValue = val ? `${prefix}: ${val}` : prefix;
                    }
                } else {
                    
                    displayValue = typeof item === 'object' ? JSON.stringify(item) : item;
                }

                return {
                    target: key,
                    source: displayValue
                };
            });
        }

        this.detailsVisible = true;
    }

    processItems(items: any[]) {
        this.groupedPolicies = [];
        this.isGrouped = false;
        this.totalItemsCount = items.length;

        this.groupedPolicies = items.map(i => {
            let label = i.name || i.id;
            if (!label && i.rootNode) label = 'Fragment ' + i.id;

            if (this.currentTab === 'selectors' && !label) {
                label = i.instanceId || i.pluginDescriptorRef?.id || 'Selector';
            }

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
