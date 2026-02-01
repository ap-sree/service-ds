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
