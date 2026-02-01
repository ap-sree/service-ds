import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { DividerModule } from 'primeng/divider';
import { PanelModule } from 'primeng/panel';
import { ListboxModule } from 'primeng/listbox';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { AccordionModule } from 'primeng/accordion';
import { TagModule } from 'primeng/tag';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { PolicyComparisonCardComponent } from './policy-comparison-card.component';

interface PolicyData {
    items: any[];
    selectedItem: any;
    raw: any;
}

interface ComparisonRow {
    feature: string;
    policyA: string;
    policyB: string;
    policyC: string;
    matches: boolean;
    level: number;
    isGroupHeader?: boolean;
}

export interface ComparisonCard {
    context: string;
    level: number;
    status: 'identical' | 'modified' | 'new-in-b' | 'new-in-c' | 'missing-in-b' | 'missing-in-c';
    details: {
        type: { a: string; b: string; c: string };
        action: { a: string; b: string; c: string };
        mappings: { a: string; b: string; c: string };
    };
    children: ComparisonCard[];
}

@Component({
    selector: 'app-policy-comparison',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CardModule,
        ButtonModule,
        FileUploadModule,
        DividerModule,
        PanelModule,
        ListboxModule,
        DialogModule,
        TableModule,
        AccordionModule,
        TagModule,
        TreeModule,
        PolicyComparisonCardComponent
    ],
    templateUrl: './policy-comparison.html',
    styleUrls: ['./policy-comparison.scss']
})
export class PolicyComparisonComponent {
    leftData: PolicyData | null = null;
    centerData: PolicyData | null = null;
    rightData: PolicyData | null = null;

    onLeftPolicyUpload(event: any) {
        this.processFile(event.files[0], (data) => this.leftData = data);
    }

    onCenterPolicyUpload(event: any) {
        this.processFile(event.files[0], (data) => this.centerData = data);
    }

    onRightPolicyUpload(event: any) {
        this.processFile(event.files[0], (data) => this.rightData = data);
    }

    private processFile(file: File, callback: (data: PolicyData) => void) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
            try {
                const json = JSON.parse(e.target.result);
                const policies = this.extractPolicies(json);
                const fragments = this.extractFragments(json);
                const items = [...policies, ...fragments];

                callback({
                    items: items,
                    selectedItem: items.length > 0 ? items[0] : null,
                    raw: json
                });
            } catch (error) {
                console.error('Error parsing policy JSON:', error);
            }
        };
        reader.readAsText(file);
    }

    private extractPolicies(json: any): any[] {
        let policies: any[] = [];
        if (json.authnSelectionTrees && Array.isArray(json.authnSelectionTrees)) {
            policies = json.authnSelectionTrees;
        } else if (json.rootNode) {
            policies = [json]; // Single policy export
        }

        return policies.map(p => ({
            label: this.getDisplayName(p),
            value: p,
            icon: 'pi pi-sitemap',
            type: 'policy'
        }));
    }

    private extractFragments(json: any): any[] {
        let fragments: any[] = [];
        if (json.authenticationPolicyFragments && Array.isArray(json.authenticationPolicyFragments)) {
            fragments = json.authenticationPolicyFragments;
        }

        return fragments.map(f => ({
            label: f.name || f.id || 'Fragment',
            value: f,
            icon: 'pi pi-bolt',
            type: 'fragment'
        }));
    }

    getDisplayName(policy: any): string {
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

    clearComparison() {
        this.leftData = null;
        this.centerData = null;
        this.rightData = null;
        this.showComparisonDialog = false;
        this.comparisonRows = [];
    }

    showComparisonDialog: boolean = false;
    comparisonRows: ComparisonRow[] = [];
    activeView: 'table' | 'cards' | 'tree' = 'table';
    comparisonCards: ComparisonCard[] = [];
    treeNodes: TreeNode[] = [];

    switchView(view: 'table' | 'cards' | 'tree') {
        this.activeView = view;
    }

    comparePolicies() {
        this.comparisonRows = [];

        // Initial high-level details
        this.addHeaderRow('Policy Details');
        this.addRow('ID',
            this.leftData?.selectedItem?.id,
            this.centerData?.selectedItem?.id,
            this.rightData?.selectedItem?.id,
            0
        );
        this.addRow('Name',
            this.leftData?.selectedItem?.name,
            this.centerData?.selectedItem?.name,
            this.rightData?.selectedItem?.name,
            0
        );

        this.addHeaderRow('Structure Comparison');

        // Start recursive comparison from Root Node
        this.compareNodes(
            this.leftData?.selectedItem?.rootNode,
            this.centerData?.selectedItem?.rootNode,
            this.rightData?.selectedItem?.rootNode,
            'Root',
            0
        );

        // Build card view data
        this.buildCardComparison();

        // Build tree view data
        this.buildTree();

        this.showComparisonDialog = true;
    }

    private compareNodes(nodeA: any, nodeB: any, nodeC: any, context: string, level: number) {
        if (!nodeA && !nodeB && !nodeC) return;

        // Group Header
        this.addRow(context, '', '', '', level, true);

        // Compare Action Type
        this.addRow('Type',
            nodeA?.action?.type,
            nodeB?.action?.type,
            nodeC?.action?.type,
            level + 1
        );

        // Compare Action ID
        const idA = this.getActionId(nodeA?.action);
        const idB = this.getActionId(nodeB?.action);
        const idC = this.getActionId(nodeC?.action);
        if (idA || idB || idC) {
            this.addRow('Action', idA, idB, idC, level + 1);
        }

        // Mapping Comparisons
        this.compareMappings(nodeA, nodeB, nodeC, level + 1);

        // Process Children
        const mapA = this.getChildrenMap(nodeA);
        const mapB = this.getChildrenMap(nodeB);
        const mapC = this.getChildrenMap(nodeC);

        const allContexts = new Set([...Array.from(mapA.keys()), ...Array.from(mapB.keys()), ...Array.from(mapC.keys())]);
        const sortedContexts = Array.from(allContexts).sort();

        for (const childContext of sortedContexts) {
            this.compareNodes(
                mapA.get(childContext),
                mapB.get(childContext),
                mapC.get(childContext),
                childContext,
                level + 1 // Children are next level down (header will be at level + 1, data at level + 2)
            );
        }
    }

    private compareMappings(nodeA: any, nodeB: any, nodeC: any, level: number) {
        // Input Mapping (Attribute Rules)
        const inputsA = this.getInputMappings(nodeA);
        const inputsB = this.getInputMappings(nodeB);
        const inputsC = this.getInputMappings(nodeC);
        if (inputsA || inputsB || inputsC) {
            this.addRow('Input Mapping', inputsA, inputsB, inputsC, level);
        }

        // Fragment Mapping
        const fragMapA = this.getFragmentMappings(nodeA);
        const fragMapB = this.getFragmentMappings(nodeB);
        const fragMapC = this.getFragmentMappings(nodeC);
        if (fragMapA || fragMapB || fragMapC) {
            this.addRow('Frag Mapping', fragMapA, fragMapB, fragMapC, level);
        }

        // APC Mapping
        const apcMapA = this.getAPCMappings(nodeA);
        const apcMapB = this.getAPCMappings(nodeB);
        const apcMapC = this.getAPCMappings(nodeC);
        if (apcMapA || apcMapB || apcMapC) {
            this.addRow('APC Mapping', apcMapA, apcMapB, apcMapC, level);
        }
    }

    private getInputMappings(node: any): string {
        const attrRules = node?.action?.attributeRules;
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

    private getFragmentMappings(node: any): string {
        return this.formatMapping(node?.action?.fragmentMapping?.attributeContractFulfillment);
    }

    private getAPCMappings(node: any): string {
        return this.formatMapping(node?.action?.attributeMapping?.attributeContractFulfillment);
    }

    private formatMapping(fulfillment: any): string {
        if (!fulfillment) return '';
        return Object.keys(fulfillment).map(key => {
            const source = fulfillment[key].source;
            const value = fulfillment[key].value;
            if (source?.type === 'NO_MAPPING') return `${key}: [No Mapping]`;
            const sourceId = source?.id ? ` (${source.id})` : '';
            return `${key}: [${source?.type}${sourceId}] ${value || ''}`;
        }).join('\n');
    }

    private getChildrenMap(node: any): Map<string, any> {
        const map = new Map<string, any>();
        if (node?.children && Array.isArray(node.children)) {
            node.children.forEach((child: any) => {
                const context = child.action?.context || 'Next';
                map.set(context, child);
            });
        }
        return map;
    }

    private getActionId(action: any): string | null {
        if (!action) return null;
        if (action.fragment?.id) return action.fragment.id;
        if (action.authenticationSelectorRef?.id) return action.authenticationSelectorRef.id;
        if (action.authenticationSource?.sourceRef?.id) return action.authenticationSource.sourceRef.id;
        if (action.authenticationPolicyContractRef?.id) return action.authenticationPolicyContractRef.id;
        return null; // DONE, RESTART, etc. might not have IDs
    }

    private addRow(feature: string, valA: any, valB: any, valC: any, level: number, isGroupHeader: boolean = false) {
        valA = valA || '';
        valB = valB || '';
        valC = valC || '';

        let matches = false;
        if (!isGroupHeader) {
            const values = [valA, valB, valC].filter(v => v !== '' && v !== '-');
            matches = values.length > 1 && values.every(v => v === values[0]);
        }

        this.comparisonRows.push({
            feature: feature,
            policyA: valA || (isGroupHeader ? '' : '-'),
            policyB: valB || (isGroupHeader ? '' : '-'),
            policyC: valC || (isGroupHeader ? '' : '-'),
            matches: matches,
            level: level,
            isGroupHeader: isGroupHeader
        });
    }

    private addHeaderRow(title: string) {
        this.comparisonRows.push({
            feature: title,
            policyA: '',
            policyB: '',
            policyC: '',
            matches: false,
            level: 0,
            isGroupHeader: true
        });
    }

    buildCardComparison() {
        this.comparisonCards = [];
        const rootCard = this.buildCardNode(
            this.leftData?.selectedItem?.rootNode,
            this.centerData?.selectedItem?.rootNode,
            this.rightData?.selectedItem?.rootNode,
            'Root',
            0
        );
        if (rootCard) {
            this.comparisonCards.push(rootCard);
        }
    }

    private buildCardNode(nodeA: any, nodeB: any, nodeC: any, context: string, level: number): ComparisonCard | null {
        if (!nodeA && !nodeB && !nodeC) return null;

        const status = this.getNodeStatus(nodeA, nodeB, nodeC);

        const card: ComparisonCard = {
            context,
            level,
            status,
            details: {
                type: {
                    a: nodeA?.action?.type || '-',
                    b: nodeB?.action?.type || '-',
                    c: nodeC?.action?.type || '-'
                },
                action: {
                    a: this.getActionId(nodeA?.action) || '-',
                    b: this.getActionId(nodeB?.action) || '-',
                    c: this.getActionId(nodeC?.action) || '-'
                },
                mappings: {
                    a: this.getAllMappingsForCard(nodeA),
                    b: this.getAllMappingsForCard(nodeB),
                    c: this.getAllMappingsForCard(nodeC)
                }
            },
            children: []
        };

        // Process children
        const mapA = this.getChildrenMap(nodeA);
        const mapB = this.getChildrenMap(nodeB);
        const mapC = this.getChildrenMap(nodeC);

        const allContexts = new Set([...Array.from(mapA.keys()), ...Array.from(mapB.keys()), ...Array.from(mapC.keys())]);
        const sortedContexts = Array.from(allContexts).sort();

        for (const childContext of sortedContexts) {
            const childCard = this.buildCardNode(
                mapA.get(childContext),
                mapB.get(childContext),
                mapC.get(childContext),
                childContext,
                level + 1
            );
            if (childCard) {
                card.children.push(childCard);
            }
        }

        return card;
    }

    private getNodeStatus(nodeA: any, nodeB: any, nodeC: any): ComparisonCard['status'] {
        const hasA = !!nodeA;
        const hasB = !!nodeB;
        const hasC = !!nodeC;

        if (this.isCenterVisible) {
            if (!hasB && hasA) return 'missing-in-b';
            if (hasB && !hasA) return 'new-in-b';
        }

        if (this.isRightVisible) {
            if (!hasC && hasA) return 'missing-in-c';
            if (hasC && !hasA) return 'new-in-c';
        }

        // Check if modified
        const typeA = nodeA?.action?.type;
        const typeB = nodeB?.action?.type;
        const typeC = nodeC?.action?.type;
        const actionA = this.getActionId(nodeA?.action);
        const actionB = this.getActionId(nodeB?.action);
        const actionC = this.getActionId(nodeC?.action);

        let isModified = false;

        if (this.isCenterVisible && hasA && hasB) {
            if (typeA !== typeB || actionA !== actionB) isModified = true;
        }

        if (this.isRightVisible && hasA && hasC) {
            if (typeA !== typeC || actionA !== actionC) isModified = true;
        }

        // Also compare B and C if both are visible and independent of A? 
        // Typically we compare everything against everything or against A.
        // Current logic prioritizes A-based comparison.

        if (isModified) {
            return 'modified';
        }

        return 'identical';
    }

    private getAllMappingsForCard(node: any): string {
        const parts: string[] = [];

        const inputs = this.getInputMappings(node);
        if (inputs) parts.push('Input:\n' + inputs);

        const fragMap = this.getFragmentMappings(node);
        if (fragMap) parts.push('Fragment:\n' + fragMap);

        const apcMap = this.getAPCMappings(node);
        if (apcMap) parts.push('APC:\n' + apcMap);

        return parts.join('\n\n') || '-';
    }



    getSeverity(status: ComparisonCard['status']): 'success' | 'warn' | 'info' | 'danger' {
        switch (status) {
            case 'identical': return 'success';
            case 'modified': return 'warn';
            case 'new-in-b':
            case 'new-in-c': return 'info';
            case 'missing-in-b':
            case 'missing-in-c': return 'danger';
        }
    }

    getStatusLabel(status: ComparisonCard['status']): string {
        switch (status) {
            case 'identical': return '✓ Identical';
            case 'modified': return '⚠ Modified';
            case 'new-in-b': return '+ New in B';
            case 'new-in-c': return '+ New in C';
            case 'missing-in-b': return '− Missing in B';
            case 'missing-in-c': return '− Missing in C';
        }
    }

    get isLeftVisible(): boolean {
        return !!this.leftData;
    }

    get isCenterVisible(): boolean {
        return !!this.centerData;
    }

    get isRightVisible(): boolean {
        return !!this.rightData;
    }

    get visiblePolicyCount(): number {
        return (this.isLeftVisible ? 1 : 0) +
            (this.isCenterVisible ? 1 : 0) +
            (this.isRightVisible ? 1 : 0);
    }

    get policyColumnWidth(): string {
        const count = this.visiblePolicyCount;
        if (count === 0) return '0%';
        // 25% reserved for Feature + Match (20 + 5)
        // 75% remaining for policies
        return (75 / count) + '%';
    }

    get gridColsClass(): string {
        const count = this.visiblePolicyCount;
        switch (count) {
            case 1: return 'grid-cols-1';
            case 2: return 'grid-cols-2';
            case 3: return 'grid-cols-3';
            default: return 'grid-cols-3';
        }
    }

    buildTree() {
        this.treeNodes = this.comparisonCards.map(card => this.mapCardToNode(card));
    }

    private mapCardToNode(card: ComparisonCard): TreeNode {
        return {
            label: card.context,
            expanded: true,
            styleClass: this.getTreeStyleClass(card.status),
            children: card.children.map(child => this.mapCardToNode(child)),
            data: card,
            type: 'default'
        };
    }

    private getTreeStyleClass(status: ComparisonCard['status']): string {
        switch (status) {
            case 'missing-in-b':
            case 'missing-in-c':
                return 'diff-node-missing text-red-500 font-bold';
            case 'new-in-b':
            case 'new-in-c':
                return 'diff-node-new text-blue-500 font-bold';
            case 'modified':
                return 'diff-node-modified text-orange-500 font-bold';
            default:
                return '';
        }
    }
}
