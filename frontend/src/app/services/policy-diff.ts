
import { Injectable } from '@angular/core';

export type DiffStatus = 'same' | 'added' | 'removed' | 'modified';

export interface DiffNode {
    id: string; 
    name: string;
    type: string;
    status: DiffStatus;
    details: any; 
    comparison?: { a: any, b: any }; 
    diffs?: { key: string; oldVal: any; newVal: any }[];
    children: DiffNode[];
    _collapsed?: boolean;
}

export interface PolicySummary {
    id: string;
    name: string;
    data: any;
}

@Injectable({
    providedIn: 'root'
})
export class PolicyDiffService {
    private nodeIdCounter = 0;

    constructor() { }

    extractPolicies(jsonInput: any): PolicySummary[] {
        try {
            const data = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
            if (!data) return [];

            
            if (Array.isArray(data.items)) {
                return data.items.map((t: any) => ({
                    id: t.id || t._id || 'unknown',
                    name: t.name || t.id || 'Unknown Item',
                    data: t
                })).sort((a: any, b: any) => a.name.localeCompare(b.name));
            }

            
            if (Array.isArray(data.authnSelectionTrees)) {
                return data.authnSelectionTrees.map((t: any) => ({
                    id: t._id || t.id || 'unknown',
                    name: t.name || t._id || 'Unknown Policy',
                    data: t
                })).sort((a: any, b: any) => a.name.localeCompare(b.name));
            }

            
            
            
            
            
            const isSingle = data.rootNode || data.entryNode || data.coreAttributes || data.configuration || data.id;

            if (isSingle) {
                return [{
                    id: data._id || data.id || 'single',
                    name: data.name || data._id || 'Single Item',
                    data: data
                }];
            }

            return [];
        } catch (e) {
            return [];
        }
    }

    comparePolicies(jsonA: any, jsonB: any): DiffNode {
        this.nodeIdCounter = 0;

        const objA = typeof jsonA === 'string' ? JSON.parse(jsonA) : jsonA;
        const objB = typeof jsonB === 'string' ? JSON.parse(jsonB) : jsonB;

        
        if (this.isContract(objA)) return this.compareContracts(objA, objB);
        if (this.isFragment(objA)) return this.compareFragments(objA, objB);
        if (this.isSelector(objA)) return this.compareSelectors(objA, objB);

        
        const isBundleA = Array.isArray(objA?.authnSelectionTrees);
        const isBundleB = Array.isArray(objB?.authnSelectionTrees);

        if (isBundleA && isBundleB) {
            return this.compareBundles(objA, objB);
        } else {
            return this.compareSingleTrees(objA, objB);
        }
    }

    visualizePolicy(json: any): DiffNode {
        
        return this.comparePolicies(json, json);
    }

    
    private isContract(obj: any): boolean {
        return !!(obj?.coreAttributes || obj?.extendedAttributes);
    }

    private isFragment(obj: any): boolean {
        
        return !!(obj?.rootNode && (obj?.inputs || obj?.outputs));
    }

    private isSelector(obj: any): boolean {
        
        return !!(obj?.configuration) && !obj?.rootNode;
    }


    

    private compareContracts(objA: any, objB: any): DiffNode {
        const root: DiffNode = {
            id: `node-${this.nodeIdCounter++}`,
            name: objB?.name || objA?.name || 'Contract',
            type: 'CONTRACT',
            status: 'same',
            details: objB || objA,
            comparison: { a: objA, b: objB },
            children: []
        };

        const coreA = objA?.coreAttributes || [];
        const coreB = objB?.coreAttributes || [];
        root.children.push(this.compareAttributeList('Core Attributes', coreA, coreB));

        const extA = objA?.extendedAttributes || [];
        const extB = objB?.extendedAttributes || [];
        root.children.push(this.compareAttributeList('Extended Attributes', extA, extB));

        root.children = root.children.filter(c => c.children.length > 0 || c.status !== 'same');
        if (this.hasChanges(root)) root.status = 'modified';

        return root;
    }

    private compareAttributeList(label: string, listA: any[], listB: any[]): DiffNode {
        const node: DiffNode = {
            id: `node-${this.nodeIdCounter++}`,
            name: label,
            type: 'SECTION',
            status: 'same',
            details: {},
            children: []
        };

        const mapA = new Set(listA.map(i => i.name));
        const mapB = new Set(listB.map(i => i.name));
        const all = new Set([...mapA, ...mapB]);

        for (const name of all) {
            const inA = mapA.has(name);
            const inB = mapB.has(name);
            let status: DiffStatus = 'same';

            if (inA && !inB) status = 'removed';
            else if (!inA && inB) status = 'added';

            node.children.push({
                id: `node-${this.nodeIdCounter++}`,
                name: name,
                type: 'ATTRIBUTE',
                status: status,
                details: { name },
                children: []
            });
        }

        if (node.children.some(c => c.status !== 'same')) node.status = 'modified';
        return node;
    }

    private compareSelectors(objA: any, objB: any): DiffNode {
        const diffs = this.getShallowDiffs(objA?.configuration, objB?.configuration);
        const status: DiffStatus = diffs.length > 0 ? 'modified' : 'same';

        
        const cleanDiffs = diffs.map(d => ({ ...d, key: `config.${d.key}` }));

        return {
            id: `node-${this.nodeIdCounter++}`,
            name: objB?.name || objA?.name || 'Selector',
            type: 'SELECTOR',
            status: status,
            details: objB,
            comparison: { a: objA, b: objB },
            diffs: cleanDiffs,
            children: []
        };
    }

    private compareFragments(objA: any, objB: any): DiffNode {
        
        const root = this.compareSingleTrees(objA, objB);
        root.type = 'FRAGMENT';

        
        const inputsDiff = this.compareIO('Inputs', objA?.inputs, objB?.inputs);
        const outputsDiff = this.compareIO('Outputs', objA?.outputs, objB?.outputs);

        if (inputsDiff) {
            root.children.unshift(inputsDiff);
            if (inputsDiff.status !== 'same') root.status = 'modified';
        }
        if (outputsDiff) {
            root.children.push(outputsDiff);
            if (outputsDiff.status !== 'same') root.status = 'modified';
        }

        return root;

    }

    private compareIO(label: string, objA: any, objB: any): DiffNode | null {
        
        
        
        const diffs = this.getShallowDiffs(objA, objB);
        if (diffs.length === 0) return null;

        return {
            id: `node-${this.nodeIdCounter++}`,
            name: label,
            type: 'IO',
            status: 'modified',
            details: objB,
            comparison: { a: objA, b: objB },
            diffs: diffs,
            children: []
        };
    }


    private compareBundles(jsonA: any, jsonB: any): DiffNode {
        const root: DiffNode = {
            id: `node-${this.nodeIdCounter++}`,
            name: 'Policy Bundle',
            type: 'ROOT',
            status: 'same',
            details: {},
            children: []
        };

        const treesA = jsonA?.authnSelectionTrees || [];
        const treesB = jsonB?.authnSelectionTrees || [];

        
        const mapA = new Map<string, any>(treesA.map((t: any) => [t._id || t.id, t]));
        const mapB = new Map<string, any>(treesB.map((t: any) => [t._id || t.id, t]));

        const allIds = new Set([...mapA.keys(), ...mapB.keys()]);

        for (const policyId of allIds) {
            const policyA = mapA.get(policyId);
            const policyB = mapB.get(policyId);

            if (policyA && !policyB) {
                root.children.push(this.mapNode(policyA, 'removed', 'POLICY'));
            } else if (!policyA && policyB) {
                root.children.push(this.mapNode(policyB, 'added', 'POLICY'));
            } else if (policyA && policyB) {
                const diffs = this.getShallowDiffs(policyA, policyB, ['rootNode', 'children', 'entryNode']);
                const status = diffs.length > 0 ? 'modified' : 'same';

                const policyNode: DiffNode = {
                    id: `node-${this.nodeIdCounter++}`,
                    name: policyA.name || policyId,
                    type: 'POLICY',
                    status: status,
                    details: policyB,
                    diffs: diffs,
                    children: []
                };

                
                const rootA = policyA.rootNode || policyA.entryNode;
                const rootB = policyB.rootNode || policyB.entryNode;

                if (rootA || rootB) {
                    const childDiff = this.compareRecursive(rootA, rootB);
                    policyNode.children.push(childDiff);
                    if (status === 'same' && this.hasChanges(childDiff)) {
                        policyNode.status = 'modified';
                    }
                }

                root.children.push(policyNode);
            }
        }
        return root;
    }

    private compareSingleTrees(objA: any, objB: any): DiffNode {
        
        
        if (objA?.rootNode || objB?.rootNode || objA?.entryNode || objB?.entryNode) {
            const name = objB?.name || objA?.name || 'Policy';
            const root: DiffNode = {
                id: `node-${this.nodeIdCounter++}`,
                name: name,
                type: 'ROOT', 
                status: 'same',
                details: objB || objA,
                children: []
            };

            const rootNodeA = objA?.rootNode || objA?.entryNode;
            const rootNodeB = objB?.rootNode || objB?.entryNode;

            if (rootNodeA || rootNodeB) {
                const childDiff = this.compareRecursive(rootNodeA, rootNodeB);
                root.children.push(childDiff);
                if (this.hasChanges(childDiff)) root.status = 'modified';
            }

            return root;
        }

        
        
        if (!objA && !objB) {
            return {
                id: `node-${this.nodeIdCounter++}`,
                name: 'Empty',
                type: 'ROOT',
                status: 'same',
                details: {},
                children: []
            };
        }

        const diff = this.compareRecursive(objA, objB);

        
        if (objA?.name || objB?.name) {
            diff.name = objB?.name || objA?.name || diff.name;
        }

        return diff;
    }

    private hasChanges(node: DiffNode): boolean {
        if (node.status !== 'same') return true;
        return node.children.some(c => this.hasChanges(c));
    }

    private compareRecursive(nodeA: any, nodeB: any): DiffNode {
        if (!nodeA && nodeB) return this.mapNode(nodeB, 'added');
        if (nodeA && !nodeB) return this.mapNode(nodeA, 'removed');

        
        
        const structureKeys = ['children', 'next', 'nodes', 'transitions', 'outcomes'];
        const diffs = this.getShallowDiffs(nodeA, nodeB, structureKeys);

        
        
        if (nodeA.action && nodeB.action) {
            const actionDiffs = this.getShallowDiffs(nodeA.action, nodeB.action);
            if (actionDiffs.length) {
                diffs.push(...actionDiffs.map(d => ({ ...d, key: `action.${d.key}` })));
            }
        }

        let status: DiffStatus = diffs.length > 0 ? 'modified' : 'same';

        const diffNode: DiffNode = {
            id: `node-${this.nodeIdCounter++}`,
            name: this.getNodeName(nodeB),
            type: this.getNodeType(nodeB),
            status: status,
            details: nodeB || nodeA, 
            comparison: { a: nodeA, b: nodeB },
            diffs: diffs,
            children: []
        };

        
        
        
        const getChildren = (n: any) => {
            if (!n) return [];
            if (Array.isArray(n.children)) {
                return n.children.map((c: any) => ({
                    ...c,
                    _outcomeName: c.action?.context || c.context
                }));
            }

            
            if (n.transitions && typeof n.transitions === 'object') {
                return Object.keys(n.transitions).map(k => ({
                    ...n.transitions[k],
                    _outcomeName: k
                }));
            }

            
            if (Array.isArray(n.nodes)) {
                return n.nodes.map((c: any) => ({
                    ...c,
                    _outcomeName: c.action?.context || c.context
                }));
            }

            return [];
        };

        const childrenA = getChildren(nodeA);
        const childrenB = getChildren(nodeB);

        
        const isOutcomeBased = childrenA.some((c: any) => c._outcomeName) || childrenB.some((c: any) => c._outcomeName);

        if (isOutcomeBased) {
            const mapChildA = new Map(childrenA.map((c: any) => [c._outcomeName, c]));
            const mapChildB = new Map(childrenB.map((c: any) => [c._outcomeName, c]));
            const outcomes = new Set([...mapChildA.keys(), ...mapChildB.keys()]);

            for (const out of outcomes) {
                const cA = mapChildA.get(out);
                const cB = mapChildB.get(out);
                
                const childDiff = this.compareRecursive(cA || null, cB || null);
                
                
                childDiff.name = `${out} -> ${childDiff.name}`;
                diffNode.children.push(childDiff);
                if (childDiff.status !== 'same' && status === 'same') {
                    
                }
            }
        } else {
            
            const maxLen = Math.max(childrenA.length, childrenB.length);
            for (let i = 0; i < maxLen; i++) {
                const childDiff = this.compareRecursive(childrenA[i] || null, childrenB[i] || null);
                diffNode.children.push(childDiff);
            }
        }

        return diffNode;
    }

    private mapNode(data: any, status: DiffStatus, typeOverride?: string): DiffNode {
        if (!data) return {
            id: `node-${this.nodeIdCounter++}`, name: 'Empty', type: 'NULL', status, details: {}, children: []
        };

        const node: DiffNode = {
            id: `node-${this.nodeIdCounter++}`,
            name: this.getNodeName(data),
            type: typeOverride || this.getNodeType(data),
            status: status,
            details: data,
            comparison: status === 'added' ? { a: undefined, b: data } : (status === 'removed' ? { a: data, b: undefined } : undefined),
            children: []
        };

        
        if (data.rootNode) {
            node.children.push(this.mapNode(data.rootNode, status));
        }
        else {
            
            let children: any[] = [];
            if (Array.isArray(data.children)) {
                children = data.children.map((c: any) => ({
                    ...c,
                    _outcomeName: c.action?.context || c.context
                }));
            }
            else if (Array.isArray(data.nodes)) {
                children = data.nodes.map((c: any) => ({
                    ...c,
                    _outcomeName: c.action?.context || c.context
                }));
            }
            else if (data.transitions) {
                children = Object.keys(data.transitions).map(k => ({ ...data.transitions[k], _outcomeName: k }));
            }

            children.forEach(c => {
                const cNode = this.mapNode(c, status);
                if (c._outcomeName && cNode.name) {
                    
                    
                    cNode.name = `${c._outcomeName} -> ${cNode.name}`;
                }
                node.children.push(cNode);
            });
        }

        return node;
    }

    private getNodeName(data: any): string {
        if (!data) return 'None';
        if (data.displayName) return data.displayName;
        if (data.name) return data.name;

        
        if (data.action) {
            
            if (data.action.fragment?.id) return data.action.fragment.id;
            if (data.action.authenticationSelectorRef?.id) return data.action.authenticationSelectorRef.id;
            if (data.action.authenticationPolicyContractRef?.id) return data.action.authenticationPolicyContractRef.id;
            if (data.action.authenticationSource?.sourceRef?.id) return data.action.authenticationSource.sourceRef.id;

            
            
            
        }

        if (data._outcomeName) return data._outcomeName; 

        if (data.action && data.action.type) return data.action.type;

        return 'Unknown';
    }

    private getNodeType(data: any): string {
        return data?.nodeType || data?.action?.type || 'NODE';
    }

    private getShallowDiffs(objA: any, objB: any, ignoreKeys: string[] = []): { key: string, oldVal: any, newVal: any }[] {
        if (!objA || !objB) return [];

        const diffs: { key: string, oldVal: any, newVal: any }[] = [];
        const keys = new Set([...Object.keys(objA || {}), ...Object.keys(objB || {})]);
        
        const allIgnoreKeys = ['id', 'location', ...ignoreKeys];

        for (const key of keys) {
            if (allIgnoreKeys.includes(key)) continue;

            const valA = objA[key];
            const valB = objB[key];

            
            
            const replacer = (k: string, v: any) => (k === 'id' || k === 'location' ? undefined : v);

            if (JSON.stringify(valA, replacer) !== JSON.stringify(valB, replacer)) {
                diffs.push({
                    key,
                    oldVal: valA,
                    newVal: valB
                });
            }
        }
        return diffs;
    }
}
