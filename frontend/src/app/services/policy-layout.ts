import { Injectable } from '@angular/core';
import { AuthenticationPolicyFragment, AuthenticationSelector, Connection, FlowNode, PolicyAction, PolicyChildNode, PolicyNodeData } from '../models/policy-visualizer';


@Injectable({
    providedIn: 'root'
})
export class PolicyLayoutService {

    constructor() { }

    public convertPolicyToFlow(rootAction: PolicyAction | null, rootChildren: PolicyChildNode[], flowId: string, selectors: AuthenticationSelector[] = [], fragments: AuthenticationPolicyFragment[] = []): { nodes: FlowNode[], connections: Connection[] } {
        const nodes: FlowNode[] = [];
        const connections: Connection[] = [];

        if (!rootAction) return { nodes: [], connections: [] };

        let idCounter = 0;
        let yCursor = 50;

        const buildAndLayout = (action: PolicyAction, children: PolicyChildNode[], depth: number, parentId: string | null): string => {
            const myId = flowId + '_node_' + (++idCounter);

            // Recurse first to determine children Y
            let myY = 0;

            if (children && children.length > 0) {
                const childYs: number[] = [];
                children.forEach(child => {
                    if (child.action) {
                        const cId = buildAndLayout(child.action, child.children || [], depth + 1, myId);
                        // Find the Y of that child
                        const childNode = nodes.find(n => n.id === cId);
                        if (childNode && !Number.isNaN(childNode.position.y)) {
                            childYs.push(childNode.position.y);
                        }
                    }
                });
                if (childYs.length > 0) {
                    myY = (Math.min(...childYs) + Math.max(...childYs)) / 2;
                } else {
                    myY = yCursor;
                    yCursor += 150;
                }
            } else {
                myY = yCursor;
                yCursor += 150;
            }

            // Validate Coordinates to prevent SVG NaN errors
            let finalX = 50 + (depth * 350);

            if (Number.isNaN(finalX)) {
                console.warn(`[Visualizer] Invalid X for ${action.type}, defaulting to 0`);
                finalX = 0;
            }
            if (Number.isNaN(myY)) {
                console.warn(`[Visualizer] Invalid Y for ${action.type}, defaulting to 0`);
                myY = 0;
            }

            const config = this.getNodeConfig(action, selectors, fragments);

            nodes.push({
                id: myId,
                label: config.label,
                type: action.type,
                context: action.context,
                data: config,
                position: {
                    x: finalX,
                    y: myY
                }
            });

            if (parentId) {
                connections.push({
                    source: parentId,
                    target: myId,
                    label: action.context // Label on the connector
                });
            }

            return myId;
        };

        buildAndLayout(rootAction, rootChildren, 0, null);
        console.log(`[Visualizer ${flowId}] Nodes generated: ${nodes.length}`);
        return { nodes, connections };
    }

    private getNodeConfig(action: PolicyAction, selectors: AuthenticationSelector[], fragments: AuthenticationPolicyFragment[]): PolicyNodeData {
        let icon = 'pi-cog';
        let colorClass = 'neutral-node';
        let subLabel = '';
        let label = action.name || action.type;

        let selectorConfig: AuthenticationSelector | null = null;
        let fragmentStructure: AuthenticationPolicyFragment | null = null;
        const attributeRules = action.attributeRules || null;
        const fragmentMapping = action.fragmentMapping || action.attributeMapping || null;

        switch (action.type) {
            case 'AUTHN_SELECTOR':
                icon = 'pi-th-large';
                colorClass = 'selector-node'; // Blue
                label = action.authenticationSelectorRef?.id || 'Selector';
                subLabel = 'Selector';

                // Look up selector configuration
                if (selectors && selectors.length > 0 && action.authenticationSelectorRef?.id) {
                    const found = selectors.find(s => s.id === action.authenticationSelectorRef!.id);
                    if (found) selectorConfig = found;
                }
                break;
            case 'AUTHN_SOURCE':
                icon = 'pi-box';
                colorClass = 'source-node'; // Green
                label = action.authenticationSource?.sourceRef?.id || 'Adapter';
                subLabel = action.authenticationSource?.type === 'IDP_ADAPTER' ? 'Adapter' : 'Source';
                break;
            case 'DONE': {
                const isSuccess = action.context?.toLowerCase().includes('success');
                icon = 'pi-stop-circle';
                colorClass = isSuccess ? 'success-node' : 'fail-node';
                label = isSuccess ? 'Success' : 'Fail';
                break;
            }
            case 'CONTINUE':
                icon = 'pi-arrow-right';
                colorClass = 'neutral-node';
                label = 'Continue';
                break;
            case 'RESTART':
                icon = 'pi-undo';
                colorClass = 'restart-node'; // Orange
                label = 'Restart';
                break;
            case 'FRAGMENT':
                icon = 'pi-sitemap';
                colorClass = 'fragment-node'; // Purple
                label = action.fragment?.id || 'Fragment'; // Corrected property access based on JSON
                subLabel = 'Fragment';

                // Look up fragment structure
                if (fragments && fragments.length > 0 && action.fragment?.id) {
                    const found = fragments.find(f => f.id === action.fragment!.id);
                    if (found) fragmentStructure = found;
                }
                break;
            case 'APC_MAPPING':
            case 'LOCAL_IDENTITY_MAPPING':
                icon = 'pi-wrench';
                colorClass = 'mapping-node'; // Indigo
                label = action.authenticationPolicyContractRef?.id || 'Contract Mapping';
                subLabel = 'Mapping';
                break;
        }

        return {
            label,
            icon,
            colorClass,
            subLabel,
            attributeRules,
            fragmentMapping,
            selectorConfig,
            fragmentStructure
        };
    }
}
