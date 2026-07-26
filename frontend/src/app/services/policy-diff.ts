
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

        const cleanDiffs = diffs.map(d => ({ ...d, key: `config.${d.key}` }));

        const typeA = objA?.pluginDescriptorRef?.id || objA?.type;
        const typeB = objB?.pluginDescriptorRef?.id || objB?.type;
        if (typeA !== typeB) {
            cleanDiffs.unshift({ key: 'selectorType', oldVal: typeA, newVal: typeB });
        }

        const status: DiffStatus = cleanDiffs.length > 0 ? 'modified' : 'same';

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
        if (!objA && !objB) return null;

        const refA = objA?.id ?? null;
        const refB = objB?.id ?? null;

        const diffs: { key: string; oldVal: any; newVal: any }[] = [];
        if (refA !== refB) {
            diffs.push({ key: 'contractRef', oldVal: refA, newVal: refB });
        }
        if (objA && objB) {
            diffs.push(...this.getShallowDiffs(objA, objB));
        }

        if (diffs.length === 0) return null;

        const status: DiffStatus = !objA ? 'added' : (!objB ? 'removed' : 'modified');

        return {
            id: `node-${this.nodeIdCounter++}`,
            name: label,
            type: 'IO',
            status: status,
            details: objB || objA,
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

        const settingsDiffs = this.getShallowDiffs(jsonA, jsonB, ['authnSelectionTrees']);
        if (settingsDiffs.length > 0) {
            root.children.push({
                id: `node-${this.nodeIdCounter++}`,
                name: 'Policy Settings',
                type: 'SETTINGS',
                status: 'modified',
                details: { a: jsonA, b: jsonB },
                comparison: { a: jsonA, b: jsonB },
                diffs: settingsDiffs,
                children: []
            });
            root.status = 'modified';
        }

        const getId = (t: any): string => t?._id || t?.id || '';
        const normName = (t: any): string => (t?.name || '').trim().toLowerCase();

        // Pass 1: match by ID
        const mapB = new Map<string, any>(treesB.map((t: any) => [getId(t), t]));
        const pairs: { a: any | null, b: any | null, matchedBy: 'id' | 'name' | null }[] = [];
        const unmatchedA: any[] = [];
        const matchedB = new Set<any>();

        for (const policyA of treesA) {
            const policyB = mapB.get(getId(policyA));
            if (policyB) {
                pairs.push({ a: policyA, b: policyB, matchedBy: 'id' });
                matchedB.add(policyB);
            } else {
                unmatchedA.push(policyA);
            }
        }

        // Pass 2: match remaining by name (cross-environment: same policy, different IDs)
        const remainingB = treesB.filter((t: any) => !matchedB.has(t));
        const nameMapB = new Map<string, any>();
        for (const t of remainingB) {
            const key = normName(t);
            if (key && !nameMapB.has(key)) nameMapB.set(key, t);
        }

        for (const policyA of unmatchedA) {
            const policyB = nameMapB.get(normName(policyA));
            if (policyB) {
                pairs.push({ a: policyA, b: policyB, matchedBy: 'name' });
                matchedB.add(policyB);
                nameMapB.delete(normName(policyA));
            } else {
                pairs.push({ a: policyA, b: null, matchedBy: null });
            }
        }

        // Leftovers in B are additions
        for (const policyB of treesB) {
            if (!matchedB.has(policyB)) pairs.push({ a: null, b: policyB, matchedBy: null });
        }

        for (const { a: policyA, b: policyB, matchedBy } of pairs) {
            if (policyA && !policyB) {
                root.children.push(this.mapNode(policyA, 'removed', 'POLICY'));
            } else if (!policyA && policyB) {
                root.children.push(this.mapNode(policyB, 'added', 'POLICY'));
            } else if (policyA && policyB) {
                const diffs = this.getShallowDiffs(policyA, policyB, ['rootNode', 'children', 'entryNode']);

                // Surface the ID difference when the pair was matched by name
                if (matchedBy === 'name' && getId(policyA) !== getId(policyB)) {
                    diffs.unshift({
                        key: 'id (matched by name)',
                        oldVal: getId(policyA),
                        newVal: getId(policyB)
                    });
                }

                const status = diffs.length > 0 ? 'modified' : 'same';

                const policyNode: DiffNode = {
                    id: `node-${this.nodeIdCounter++}`,
                    name: policyA.name || getId(policyA),
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
                if (childDiff.status !== 'same' && diffNode.status === 'same') {
                    diffNode.status = 'modified';
                }
            }
        } else {
            const keyOf = (c: any) => `${this.getNodeType(c)}|${this.getNodeName(c)}`;
            const usedB = new Array(childrenB.length).fill(false);
            const childPairs: { a: any, b: any }[] = [];
            const leftoverA: any[] = [];

            for (const cA of childrenA) {
                const idx = childrenB.findIndex((cB: any, i: number) => !usedB[i] && keyOf(cB) === keyOf(cA));
                if (idx >= 0) {
                    usedB[idx] = true;
                    childPairs.push({ a: cA, b: childrenB[idx] });
                } else {
                    leftoverA.push(cA);
                }
            }

            const leftoverB = childrenB.filter((_: any, i: number) => !usedB[i]);
            const maxLen = Math.max(leftoverA.length, leftoverB.length);
            for (let i = 0; i < maxLen; i++) {
                childPairs.push({ a: leftoverA[i] || null, b: leftoverB[i] || null });
            }

            for (const { a: cA, b: cB } of childPairs) {
                const childDiff = this.compareRecursive(cA || null, cB || null);
                diffNode.children.push(childDiff);
                if (childDiff.status !== 'same' && diffNode.status === 'same') {
                    diffNode.status = 'modified';
                }
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
            if (data.action.localIdentityRef?.id) return data.action.localIdentityRef.id;
            if (data.action.authenticationSource?.sourceRef?.id) return data.action.authenticationSource.sourceRef.id;
        }

        if (data._outcomeName) return data._outcomeName;

        if (data.action && data.action.type) return data.action.type;

        return 'Unknown';
    }

    private getNodeType(data: any): string {
        return data?.nodeType || data?.action?.type || 'NODE';
    }

    private isRefObject(o: any): boolean {
        return !!o && typeof o === 'object' && !Array.isArray(o)
            && 'id' in o
            && Object.keys(o).every(k => k === 'id' || k === 'location');
    }

    private isEqualIgnoringKeys(a: any, b: any, ignoreKeys: string[]): boolean {
        if (a === b) return true;
        if (a === null || b === null || a === undefined || b === undefined) return a === b;
        if (typeof a !== typeof b) return false;

        if (Array.isArray(a)) {
            if (!Array.isArray(b) || a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (!this.isEqualIgnoringKeys(a[i], b[i], ignoreKeys)) return false;
            }
            return true;
        }

        if (typeof a === 'object') {
            const refA = this.isRefObject(a);
            const refB = this.isRefObject(b);
            if (refA && refB) return String(a.id) === String(b.id);
            if (refA !== refB) return false;

            const keysA = Object.keys(a).filter(k => !ignoreKeys.includes(k));
            const keysB = Object.keys(b).filter(k => !ignoreKeys.includes(k));
            if (keysA.length !== keysB.length) return false;

            const setB = new Set(keysB);
            for (const key of keysA) {
                if (!setB.has(key)) return false;
                if (!this.isEqualIgnoringKeys(a[key], b[key], ignoreKeys)) return false;
            }
            return true;
        }

        return String(a) === String(b);
    }

    private getShallowDiffs(objA: any, objB: any, ignoreKeys: string[] = []): { key: string, oldVal: any, newVal: any }[] {
        if (!objA || !objB) return [];

        const diffs: { key: string, oldVal: any, newVal: any }[] = [];
        const keys = new Set([...Object.keys(objA || {}), ...Object.keys(objB || {})]);

        const finalIgnore = [...ignoreKeys, 'id', 'location'];

        for (const key of keys) {
            if (finalIgnore.includes(key)) continue;

            const valA = objA[key];
            const valB = objB[key];

            if (!this.isEqualIgnoringKeys(valA, valB, ['id', 'location'])) {
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
