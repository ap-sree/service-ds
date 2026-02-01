
import { Injectable } from '@angular/core';

export type DiffStatus = 'same' | 'added' | 'removed' | 'modified';

export interface DiffNode {
    id: string; // unique ID for D3
    name: string;
    type: string;
    status: DiffStatus;
    details: any; // The original data object (or combined)
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

            // Case 1: "items" array (Common in IDP/Contract/Fragment bundles)
            if (Array.isArray(data.items)) {
                return data.items.map((t: any) => ({
                    id: t.id || t._id || 'unknown',
                    name: t.name || t.id || 'Unknown Item',
                    data: t
                })).sort((a: any, b: any) => a.name.localeCompare(b.name));
            }

            // Case 2: "authnSelectionTrees" array (Policy Bundles)
            if (Array.isArray(data.authnSelectionTrees)) {
                return data.authnSelectionTrees.map((t: any) => ({
                    id: t._id || t.id || 'unknown',
                    name: t.name || t._id || 'Unknown Policy',
                    data: t
                })).sort((a: any, b: any) => a.name.localeCompare(b.name));
            }

            // Case 3: Single Object (Policy, Fragment, etc.)
            // Heuristics:
            // - Policy: rootNode, entryNode
            // - Contract: coreAttributes, extendedAttributes
            // - Selector: configuration
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

        // Detect Type based on A (assuming A and B are same type usually)
        if (this.isContract(objA)) return this.compareContracts(objA, objB);
        if (this.isFragment(objA)) return this.compareFragments(objA, objB);
        if (this.isSelector(objA)) return this.compareSelectors(objA, objB);

        // Default to Tree/Bundle Comparison
        const isBundleA = Array.isArray(objA?.authnSelectionTrees);
        const isBundleB = Array.isArray(objB?.authnSelectionTrees);

        if (isBundleA && isBundleB) {
            return this.compareBundles(objA, objB);
        } else {
            return this.compareSingleTrees(objA, objB);
        }
    }

    // --- Type Guards ---
    private isContract(obj: any): boolean {
        return !!(obj?.coreAttributes || obj?.extendedAttributes);
    }

    private isFragment(obj: any): boolean {
        // Fragments look like policies but often have separate inputs/outputs definitions
        return !!(obj?.rootNode && (obj?.inputs || obj?.outputs));
    }

    private isSelector(obj: any): boolean {
        // Selectors have configuration and resultAttributeName, but NOT rootNode
        return !!(obj?.configuration) && !obj?.rootNode;
    }


    // --- Comparison Implementations ---

    private compareContracts(objA: any, objB: any): DiffNode {
        const root: DiffNode = {
            id: `node-${this.nodeIdCounter++}`,
            name: objB?.name || objA?.name || 'Contract',
            type: 'CONTRACT',
            status: 'same',
            details: objB || objA,
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

        // Re-map diff keys to be cleaner
        const cleanDiffs = diffs.map(d => ({ ...d, key: `config.${d.key}` }));

        return {
            id: `node-${this.nodeIdCounter++}`,
            name: objB?.name || objA?.name || 'Selector',
            type: 'SELECTOR',
            status: status,
            details: objB,
            diffs: cleanDiffs,
            children: []
        };
    }

    private compareFragments(objA: any, objB: any): DiffNode {
        // Compare the Main Flow exactly like a Policy
        const root = this.compareSingleTrees(objA, objB);
        root.type = 'FRAGMENT';

        // Add Inputs/Outputs Check
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
        // Inputs/Outputs can be simple ID references or objects
        // In the sample, they seem to be objects with IDs?
        // Let's assume shallow diff of whatever properties exist
        const diffs = this.getShallowDiffs(objA, objB);
        if (diffs.length === 0) return null;

        return {
            id: `node-${this.nodeIdCounter++}`,
            name: label,
            type: 'IO',
            status: 'modified',
            details: objB,
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

        // Explicitly type the Maps to ensure values are 'any' and not 'unknown'
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

                // Determine entry point (rootNode or entryNode)
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
        // Create a wrapper root
        const root: DiffNode = {
            id: `node-${this.nodeIdCounter++}`,
            name: 'Comparison Root',
            type: 'ROOT',
            status: 'same',
            details: {},
            children: []
        };

        // Usually single tree JSONs might be the policy object itself or the root node
        // We assume it's the root node structure if it has 'children' or 'next'
        // If it looks like a policy container (has rootNode), drill down.

        let rootNodeA = objA?.rootNode || objA?.entryNode || objA;
        let rootNodeB = objB?.rootNode || objB?.entryNode || objB;

        // Special case: if inputs are null/empty
        if (!rootNodeA && !rootNodeB) return root;

        const diff = this.compareRecursive(rootNodeA, rootNodeB);

        // If the top level objects had names, label the root
        if (objA?.name || objB?.name) {
            diff.name = objB?.name || objA?.name || diff.name;
        }

        root.children.push(diff);

        if (this.hasChanges(diff)) {
            root.status = 'modified';
        }

        return root;
    }

    private hasChanges(node: DiffNode): boolean {
        if (node.status !== 'same') return true;
        return node.children.some(c => this.hasChanges(c));
    }

    private compareRecursive(nodeA: any, nodeB: any): DiffNode {
        if (!nodeA && nodeB) return this.mapNode(nodeB, 'added');
        if (nodeA && !nodeB) return this.mapNode(nodeA, 'removed');

        // Compare Node Properties (ignoring structure keys)
        // Structure keys: children, next, nodes, transitions
        const structureKeys = ['children', 'next', 'nodes', 'transitions', 'outcomes'];
        const diffs = this.getShallowDiffs(nodeA, nodeB, structureKeys);

        // Also compare 'action' or 'nodeType' specifically if they exist as nested objects
        // Assuming flat-ish node structure common in AM trees, or nested 'action' objects
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
            details: nodeB,
            diffs: diffs,
            children: []
        };

        // Normalize children access
        // AM Trees usually have 'children' or 'transitions' (outcomes)
        const getChildren = (n: any) => {
            if (!n) return [];
            if (Array.isArray(n.children)) return n.children;

            // Handle Map-like transitions { "true": { ... }, "false": { ... } }
            if (n.transitions && typeof n.transitions === 'object') {
                return Object.keys(n.transitions).map(k => ({
                    ...n.transitions[k],
                    _outcomeName: k
                }));
            }

            // Handle array-like outcomes/nodes
            if (Array.isArray(n.nodes)) return n.nodes;

            return [];
        };

        const childrenA = getChildren(nodeA);
        const childrenB = getChildren(nodeB);

        // Try to align by _outcomeName if present
        const isOutcomeBased = childrenA.some((c: any) => c._outcomeName) || childrenB.some((c: any) => c._outcomeName);

        if (isOutcomeBased) {
            const mapChildA = new Map(childrenA.map((c: any) => [c._outcomeName, c]));
            const mapChildB = new Map(childrenB.map((c: any) => [c._outcomeName, c]));
            const outcomes = new Set([...mapChildA.keys(), ...mapChildB.keys()]);

            for (const out of outcomes) {
                const cA = mapChildA.get(out);
                const cB = mapChildB.get(out);
                // Pass pure null if undefined
                const childDiff = this.compareRecursive(cA || null, cB || null);
                // Append outcome name to label if useful
                // Important: We encode the outcome in the name so the Viz can extract it for the edge label
                childDiff.name = `${out} -> ${childDiff.name}`;
                diffNode.children.push(childDiff);
                if (childDiff.status !== 'same' && status === 'same') {
                    // status = 'modified'; // Optional: Propagate modified status up? 
                }
            }
        } else {
            // Index based alignment
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
            children: []
        };

        // If it has a rootNode (is a Policy object)
        if (data.rootNode) {
            node.children.push(this.mapNode(data.rootNode, status));
        }
        else {
            // Check children
            let children: any[] = [];
            if (Array.isArray(data.children)) children = data.children;
            else if (data.transitions) {
                children = Object.keys(data.transitions).map(k => ({ ...data.transitions[k], _outcomeName: k }));
            }

            children.forEach(c => {
                const cNode = this.mapNode(c, status);
                if (c._outcomeName) cNode.name = `${c._outcomeName} -> ${cNode.name}`;
                node.children.push(cNode);
            });
        }

        return node;
    }

    private getNodeName(data: any): string {
        if (!data) return 'None';
        if (data.displayName) return data.displayName;
        if (data.name) return data.name;
        if (data._outcomeName) return data._outcomeName; // Fallback if it's just a connector
        if (data.action?.type) return data.action.type;
        if (data.nodeType) return data.nodeType;
        return 'Node';
    }

    private getNodeType(data: any): string {
        return data?.nodeType || data?.action?.type || 'NODE';
    }

    private getShallowDiffs(objA: any, objB: any, ignoreKeys: string[] = []): { key: string, oldVal: any, newVal: any }[] {
        if (!objA || !objB) return [];

        const diffs: { key: string, oldVal: any, newVal: any }[] = [];
        const keys = new Set([...Object.keys(objA || {}), ...Object.keys(objB || {})]);

        for (const key of keys) {
            if (ignoreKeys.includes(key)) continue;

            const valA = objA[key];
            const valB = objB[key];

            // Simple equality check
            // For arrays/objects, we do a quick JSON stringify comparison to avoid false positives on references
            if (JSON.stringify(valA) !== JSON.stringify(valB)) {
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
