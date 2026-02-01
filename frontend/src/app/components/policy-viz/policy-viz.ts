
import { Component, ElementRef, Input, OnChanges, ViewChild, ViewEncapsulation, Output, EventEmitter, SimpleChanges, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiffNode } from '../../services/policy-diff';
import * as d3 from 'd3';

interface FlowNode {
    id: string;
    x: number;
    y: number;
    data: DiffNode;
    width: number;
    height: number;
}

interface FlowLink {
    id: string;
    d: string;
    source: FlowNode;
    target: FlowNode;
    status: string;
    label?: string;
}

@Component({
    selector: 'app-policy-viz',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './policy-viz.html',
    styleUrl: './policy-viz.scss',
    encapsulation: ViewEncapsulation.None
})
export class PolicyVizComponent implements OnChanges {
    @Input() data: DiffNode | null = null;
    @Output() nodeSelected = new EventEmitter<DiffNode>();

    @ViewChild('container', { static: true }) containerRef!: ElementRef;

    // Render State
    nodes = signal<FlowNode[]>([]);
    links = signal<FlowLink[]>([]);

    // Viewport State
    transform = signal<{ k: number, x: number, y: number }>({ k: 1, x: 0, y: 0 });

    transformStyle = computed(() =>
        `translate(${this.transform().x}px, ${this.transform().y}px) scale(${this.transform().k})`
    );

    backgroundPos = computed(() =>
        `${this.transform().x}px ${this.transform().y}px`
    );

    private zoomBehavior: any;
    private selection: any;

    constructor() { }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['data'] && this.data) {
            // Calculate Layout immediately
            this.calculateLayout(this.data);
            // Setup zoom after view init effectively (or just re-bind if needed)
            setTimeout(() => this.setupZoom(), 0);
        }
    }

    private setupZoom() {
        const el = this.containerRef.nativeElement;
        if (!el) return;

        this.selection = d3.select(el);
        this.zoomBehavior = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event: any) => {
                this.transform.set(event.transform);
            });

        this.selection.call(this.zoomBehavior);

        // Center initial view if new data
        this.centerView();
    }

    private centerView() {
        if (!this.nodes().length) return;

        const el = this.containerRef.nativeElement;
        const width = el.offsetWidth;
        const height = el.offsetHeight;

        // Find bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.nodes().forEach(n => {
            minX = Math.min(minX, n.x - n.width / 2);
            maxX = Math.max(maxX, n.x + n.width / 2);
            minY = Math.min(minY, n.y - n.height / 2);
            maxY = Math.max(maxY, n.y + n.height / 2);
        });

        const contentW = maxX - minX;
        const contentH = maxY - minY;
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        const scale = Math.min(1, Math.min(width / (contentW + 100), height / (contentH + 100)));

        const t = d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(scale)
            .translate(-midX, -midY);

        this.selection.call(this.zoomBehavior.transform, t);
    }

    resetZoom() {
        this.centerView();
    }

    private calculateLayout(data: DiffNode) {
        // 1. D3 Hierarchy
        const root = d3.hierarchy(data);

        // 2. Tree Config
        const nodeW = 200;
        const nodeH = 80;

        // Using simple tree layout, rotating to horizontal
        const treeMap = d3.tree()
            .nodeSize([nodeH + 40, nodeW + 60]); // [height, width] separation

        const treeData = treeMap(root as any);

        // 3. Map to FlowNodes
        const newNodes: FlowNode[] = [];

        // In D3 tree: x is vertical, y is horizontal (if we think left-to-right)
        // We want Left-to-Right flow.
        // D3 default is Top-Down where x=horizontal position, y=depth.
        // wait, d3.tree() defaults: x along root's breadth, y along depth.
        // So for L-R: x -> y, y -> x.

        treeData.descendants().forEach((d: any) => {
            newNodes.push({
                id: d.data.id,
                x: d.y, // Swap for L-R
                y: d.x,
                data: d.data,
                width: 180,
                height: 70
            });
        });

        // 4. Map to FlowLinks
        const newLinks: FlowLink[] = [];
        const linkGen = d3.linkHorizontal()
            .x((d: any) => d.y) // Swap for L-R
            .y((d: any) => d.x);

        treeData.links().forEach((l: any, i: number) => {
            // Extract label from target name if formatted as "Label -> NodeName"
            let label = '';
            if (l.target.data.name && l.target.data.name.includes(' -> ')) {
                const parts = l.target.data.name.split(' -> ');
                label = parts[0];
                // Clean up the node name for display (optional, handled in template)
            }

            newLinks.push({
                id: `link-${i}`,
                source: { x: l.source.y, y: l.source.x } as any,
                target: { x: l.target.y, y: l.target.x } as any,
                d: linkGen(l) || '',
                status: l.target.data.status,
                label: label
            });
        });

        this.nodes.set(newNodes);
        this.links.set(newLinks);
    }

    onNodeClick(e: MouseEvent, node: FlowNode) {
        e.stopPropagation();
        this.nodeSelected.emit(node.data);
    }

    getLinkColor(status: string): string {
        switch (status) {
            case 'added': return '#10b981';
            case 'removed': return '#f43f5e';
            case 'modified': return '#f59e0b';
            default: return '#cbd5e1';
        }
    }

    getLabelTransform(link: FlowLink): string {
        // Very rough approximation of midpoint on Bezier
        // For horizontal links, midpoint x is avg, y is avg + calc
        // Better to just take avg for simple visual
        const mx = (link.source.x + link.target.x) / 2;
        const my = (link.source.y + link.target.y) / 2;
        return `translate(${mx}, ${my})`;
    }

    cleanName(name: string): string {
        if (!name) return 'Node';
        if (name.includes(' -> ')) {
            return name.split(' -> ')[1];
        }
        return name;
    }
}
