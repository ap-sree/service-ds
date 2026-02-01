
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
    @Input() mode: 'compare' | 'view' = 'compare';
    @Output() nodeSelected = new EventEmitter<DiffNode>();

    @ViewChild('container', { static: true }) containerRef!: ElementRef;

    
    nodes = signal<FlowNode[]>([]);
    links = signal<FlowLink[]>([]);

    
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
        if (changes['data']) {
            console.log('PolicyViz: data changed', this.data);
            if (this.data) {
                
                this.calculateLayout(this.data);
                
                setTimeout(() => this.setupZoom(), 0);
            }
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

        
        this.centerView();
    }

    private centerView() {
        if (!this.nodes().length) return;

        const el = this.containerRef.nativeElement;
        const width = el.offsetWidth;
        const height = el.offsetHeight;

        
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
        
        const root = d3.hierarchy(data);

        
        const nodeW = 200;
        const nodeH = 80;

        
        const treeMap = d3.tree()
            .nodeSize([nodeH + 40, nodeW + 60]); 

        const treeData = treeMap(root as any);

        
        const newNodes: FlowNode[] = [];

        
        
        
        
        

        treeData.descendants().forEach((d: any) => {
            newNodes.push({
                id: d.data.id,
                x: d.y, 
                y: d.x,
                data: d.data,
                width: 180,
                height: 70
            });
        });

        
        const newLinks: FlowLink[] = [];
        const linkGen = d3.linkHorizontal()
            .x((d: any) => d.y) 
            .y((d: any) => d.x);

        treeData.links().forEach((l: any, i: number) => {
            
            let label = '';
            if (l.target.data.name && l.target.data.name.includes(' -> ')) {
                const parts = l.target.data.name.split(' -> ');
                label = parts[0];
                
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
