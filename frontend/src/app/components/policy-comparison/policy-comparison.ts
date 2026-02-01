
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileUploadModule } from 'primeng/fileupload';
import { ListboxModule } from 'primeng/listbox';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { AccordionModule } from 'primeng/accordion';
import { DiffNode, PolicySummary, PolicyDiffService } from '../../services/policy-diff';
import { PolicyVizComponent } from '../policy-viz/policy-viz';
import { PolicyComparisonCardComponent } from './policy-comparison-card.component';
import { ComparisonCard } from './policy-comparison.model';

@Component({
    selector: 'app-policy-comparison',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        FileUploadModule,
        ListboxModule,
        ButtonModule,
        CardModule,
        TagModule,
        PolicyVizComponent,
        DialogModule,
        TableModule,
        AccordionModule,
        PolicyComparisonCardComponent
    ],
    templateUrl: './policy-comparison.html',
    styleUrl: './policy-comparison.scss'
})
export class PolicyComparisonComponent {

    
    policiesA = signal<PolicySummary[]>([]);
    policiesB = signal<PolicySummary[]>([]);

    
    selectedPolicyA: PolicySummary | null = null;
    selectedPolicyB: PolicySummary | null = null;

    diffTree = signal<DiffNode | null>(null);
    selectedNode = signal<DiffNode | null>(null);

    showDetails = false; 

    constructor(private diffService: PolicyDiffService) { }

    onUploadA(event: any) {
        this.processFile(event.files[0], (policies) => {
            this.policiesA.set(policies);
            if (policies.length === 1) this.selectedPolicyA = policies[0];
            
            if (event.originalEvent) event.originalEvent.target.value = '';
        });
    }

    onUploadB(event: any) {
        this.processFile(event.files[0], (policies) => {
            this.policiesB.set(policies);
            if (policies.length === 1) this.selectedPolicyB = policies[0];
            if (event.originalEvent) event.originalEvent.target.value = '';
        });
    }

    clearA() {
        this.policiesA.set([]);
        this.selectedPolicyA = null;
    }

    clearB() {
        this.policiesB.set([]);
        this.selectedPolicyB = null;
    }

    private processFile(file: File, callback: (policies: PolicySummary[]) => void) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
            try {
                const json = JSON.parse(e.target.result);
                
                const extracted = this.diffService.extractPolicies(json);
                callback(extracted);
            } catch (error) {
                console.error('Error parsing JSON:', error);
                alert('Failed to parse JSON file.');
            }
        };
        reader.readAsText(file);
    }

    canCompare(): boolean {
        return !!this.selectedPolicyA && !!this.selectedPolicyB;
    }

    compare() {
        if (!this.selectedPolicyA || !this.selectedPolicyB) {
            return;
        }

        try {
            const tree = this.diffService.comparePolicies(this.selectedPolicyA.data, this.selectedPolicyB.data);
            this.diffTree.set(tree);
            this.selectedNode.set(null);
        } catch (e) {
            console.error("Error comparing", e);
            alert("Error comparing policies. Check console.");
        }
    }

    onNodeSelected(node: DiffNode) {
        this.selectedNode.set(node);
        this.showDetails = true; 
    }

    getSeverity(status: string): any {
        switch (status) {
            case 'added': return 'success';
            case 'removed': return 'danger';
            case 'modified': return 'warning';
            case 'same': return 'secondary';
            default: return 'info';
        }
    }

    formatDiffValue(val: any, level: number = 0): string {
        if (val === undefined || val === null) return '';

        const indent = '  '.repeat(level);

        if (typeof val === 'string') return val;
        if (typeof val === 'boolean') return val ? 'True' : 'False';

        if (Array.isArray(val)) {
            if (val.length === 0) return '(empty)';
            
            if (val.every(v => typeof v !== 'object')) {
                return '[' + val.join(', ') + ']';
            }
            return val.map(v => this.formatDiffValue(v, level)).join('\n');
        }

        if (typeof val === 'object') {
            if (Object.keys(val).length === 0) return '(empty)';

            return Object.entries(val)
                .map(([k, v]) => {
                    const valStr = this.formatDiffValue(v, level + 1);
                    
                    if (valStr.includes('\n') || (typeof v === 'object' && v !== null)) {
                        return `${k}:\n${indent}  ${valStr.replace(/\n/g, '\n' + indent + '  ')}`;
                    }
                    return `${k}: ${valStr}`;
                })
                .join(`\n${indent}`);
        }

        return String(val);
    }


    

    getComparisonCard(node: DiffNode): ComparisonCard | null {
        if (!node || !node.comparison) return null;

        const a = node.comparison.a;
        const b = node.comparison.b;

        return {
            context: node.name,
            level: 0,
            status: this.getCardStatus(node.status),
            details: {
                type: {
                    a: a?.action?.type || (a ? 'Node' : '-'),
                    b: b?.action?.type || (b ? 'Node' : '-'),
                    c: '-'
                },
                action: {
                    a: this.getActionId(a?.action) || '-',
                    b: this.getActionId(b?.action) || '-',
                    c: '-'
                },
                mappings: {
                    a: this.getAllMappingsForCard(a),
                    b: this.getAllMappingsForCard(b),
                    c: '-'
                }
            },
            children: []
        };
    }

    getCardStatus(status: string): ComparisonCard['status'] {
        if (status === 'same') return 'identical';
        if (status === 'added') return 'new-in-b';
        if (status === 'removed') return 'missing-in-b';
        return 'modified';
    }

    private getAllMappingsForCard(node: any): string {
        if (!node) return '-';
        const parts: string[] = [];

        
        const action = node.action || node.rootNode?.action;
        if (!action) return '-';

        const inputs = this.getInputMappings(action);
        if (inputs) parts.push('Input:\n' + inputs);

        const fragMap = this.getFragmentMappings(action);
        if (fragMap) parts.push('Fragment:\n' + fragMap);

        const apcMap = this.getAPCMappings(action);
        if (apcMap) parts.push('APC:\n' + apcMap);

        
        if (action.inputUserIdMapping) {
            parts.push('User Key:\n' + this.formatMapping({ "USER_KEY": action.inputUserIdMapping }));
        }

        return parts.join('\n\n') || '-';
    }

    private getInputMappings(action: any): string {
        const attrRules = action?.attributeRules;
        if (!attrRules) return '';

        const lines: string[] = [];
        if (attrRules.items && Array.isArray(attrRules.items)) {
            lines.push(...attrRules.items.map((r: any) => {
                const sourceId = r.attributeSource?.id ? `[${r.attributeSource.id}] ` : '';
                return `${sourceId}${r.attributeName} ${r.condition} ${r.expectedValue}`;
            }));
        }
        if (attrRules.fallbackToSuccess !== undefined) {
            lines.push(`Fallback to Success: ${attrRules.fallbackToSuccess}`);
        }
        return lines.join('\n');
    }

    private getFragmentMappings(action: any): string {
        
        let mapping = action?.fragmentMapping?.attributeContractFulfillment;
        if (!mapping) mapping = action?.fragment?.attributeMapping?.attributeContractFulfillment;
        if (!mapping) mapping = action?.fragment?.attributeMapping;
        return this.formatMapping(mapping);
    }

    private getAPCMappings(action: any): string {
        
        let mapping = action?.attributeContractFulfillment;
        if (!mapping) mapping = action?.attributeMapping?.attributeContractFulfillment;
        if (!mapping) mapping = action?.attributeMapping;
        return this.formatMapping(mapping);
    }

    private formatMapping(fulfillment: any): string {
        if (!fulfillment) return '';
        return Object.keys(fulfillment).map(key => {
            const item = fulfillment[key];
            const source = item.source;
            const val = source?.value || item.value; 

            if (source?.type === 'NO_MAPPING') return `${key}: [No Mapping]`;
            const sourceId = source?.id ? ` (${source.id})` : '';

            return `${key}: [${source?.type}${sourceId}] ${val || ''}`;
        }).join('\n');
    }

    private getActionId(action: any): string | null {
        if (!action) return null;
        if (action.fragment?.id) return action.fragment.id;
        if (action.authenticationSelectorRef?.id) return action.authenticationSelectorRef.id;
        if (action.authenticationSource?.sourceRef?.id) return action.authenticationSource.sourceRef.id;
        if (action.authenticationPolicyContractRef?.id) return action.authenticationPolicyContractRef.id;
        return null; 
    }
}
