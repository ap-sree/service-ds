export interface PolicyResponse {
    authnSelectionTrees: AuthenticationPolicyTree[];
    items?: any[]; 
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
    type: string; 
    context?: string; 
    description?: string;
    authenticationSelectorRef?: ResourceLink;
    authenticationSource?: AuthenticationSource;
    authenticationPolicyContractRef?: ResourceLink;
    policyFragmentRef?: ResourceLink;
    fragment?: ResourceLink; 
    attributeRules?: AttributeRule;
    fragmentMapping?: FragmentMapping;
    attributeMapping?: any;
    
}

export interface PolicyChildNode {
    action: PolicyAction;
    children?: PolicyChildNode[];
}

export interface AuthenticationSource {
    type: string; 
    sourceRef?: ResourceLink;
    id?: string;
}

export interface ResourceLink {
    id: string; 
    location?: string;
}


export interface AuthenticationPolicyFragment {
    id: string;
    name: string;
    description?: string;
    inputs?: any;
    outputs?: any;
    rootNode: PolicyRootNode; 
}


export interface AuthenticationSelector {
    id: string;
    type: string;
    name?: string;
    pluginDescriptorRef?: ResourceLink;
    configuration?: any; 
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
    condition: string; 
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