export interface PolicyResponse {
    authnSelectionTrees: AuthenticationPolicyTree[];
    items?: any[]; // For contracts.json
    authenticationPolicyFragments?: AuthenticationPolicyFragment[];
}

export interface AuthenticationPolicyTree {
    id?: string;
    name?: string;
    description?: string;
    enabled?: boolean;
    rootNode: PolicyRootNode;
}

export interface PolicyRootNode {
    action: PolicyAction;
    children: PolicyChildNode[];
}

export interface PolicyAction {
    id: string;
    name: string;
    type: string; // e.g. "AUTHN_SELECTOR", "AUTHN_SOURCE", "DONE", "APC_MAPPING"
    context?: string; // e.g. "Success", "Fail", "Identity_Sign_On"
    description?: string;
    authenticationSelectorRef?: ResourceLink;
    authenticationSource?: AuthenticationSource;
    authenticationPolicyContractRef?: ResourceLink;
    policyFragmentRef?: ResourceLink;
    fragment?: ResourceLink; // For FRAGMENT type
    attributeRules?: AttributeRule;
    fragmentMapping?: FragmentMapping;
    attributeMapping?: any;
    // children moved to PolicyChildNode to match JSON structure
}

export interface PolicyChildNode {
    action: PolicyAction;
    children?: PolicyChildNode[];
}

export interface AuthenticationSource {
    type: string; // e.g. "IDP_ADAPTER"
    sourceRef?: ResourceLink;
    id?: string;
}

export interface ResourceLink {
    id: string; // e.g. "CheckDisabledLogin"
    location?: string;
}

// Keep Fragment Support for backward compatibility or future use
export interface AuthenticationPolicyFragment {
    id: string;
    name: string;
    description?: string;
    inputs?: any;
    outputs?: any;
    rootNode: PolicyRootNode; // Updated to match new structure
}


export interface AuthenticationSelector {
    id: string;
    type: string;
    name?: string;
    pluginDescriptorRef?: ResourceLink;
    configuration?: any; // Define strict config structure if known, or keep generic for now
}

export interface PolicyNodeData {
    label: string;
    icon: string;
    colorClass: string;
    subLabel: string;
    attributeRules?: AttributeRule | null;
    fragmentMapping?: FragmentMapping | null;
    selectorConfig?: AuthenticationSelector | null;
    fragmentStructure?: AuthenticationPolicyFragment | null;
}

export interface FlowNode {
    id: string;
    label: string;
    position: { x: number; y: number };
    type?: string;
    data?: PolicyNodeData;
    context?: string;
}

export interface Connection {
    source: string;
    target: string;
    label?: string;
}

export interface AttributeRule {
    items: AttributeRuleItem[];
    fallbackToSuccess?: boolean;
}

export interface AttributeRuleItem {
    attributeSource: { type: string; id?: string };
    attributeName: string;
    condition: string; // e.g. "EQUALS"
    expectedValue: string;
    result: string;
}

export interface FragmentMapping {
    attributeSources?: any[];
    attributeContractFulfillment?: { [key: string]: AttributeValue };
    issuanceCriteria?: any;
}

export interface AttributeValue {
    source: { type: string; id?: string };
    value: string;
}