import { Component, Input, Output, EventEmitter, ViewChild, ViewEncapsulation, AfterViewInit, OnChanges, SimpleChanges, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FFlowModule, EFMarkerType, FCanvasComponent } from '@foblex/flow';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { Connection, FlowNode, PolicyNodeData } from '../../../models/policy-visualizer';

@Component({
    selector: 'app-policy-flow',
    standalone: true,
    imports: [CommonModule, FFlowModule, CardModule, ButtonModule, TooltipModule],
    templateUrl: './policy-flow.html',
    styleUrls: ['./policy-flow.scss'],
    encapsulation: ViewEncapsulation.None
})
export class PolicyFlowComponent implements OnInit, AfterViewInit, OnChanges {
    @Input() nodes: FlowNode[] = [];
    @Input() connections: Connection[] = [];
    @Input() flowId: string = 'flow-default';

    @Output() nodeClick = new EventEmitter<PolicyNodeData>();
    @Output() structureClick = new EventEmitter<PolicyNodeData>();

    @ViewChild(FCanvasComponent) fCanvas!: FCanvasComponent;

    // Staggered display variables
    visibleNodes: FlowNode[] = [];
    visibleConnections: Connection[] = [];

    protected readonly eMarkerType = EFMarkerType;

    constructor(private cdr: ChangeDetectorRef) { }

    ngOnInit(): void {
        // Initial setup handled in OnChanges or inputs
        this.updateView();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['nodes'] || changes['connections']) {
            this.updateView();
        }
    }

    private updateView() {
        // 1. Render Nodes First
        this.visibleNodes = this.nodes || [];
        this.visibleConnections = [];

        // 2. Render Connections on next tick after Nodes are in DOM
        setTimeout(() => {
            this.visibleConnections = this.connections || [];
            this.cdr.markForCheck(); // Trigger change detection

            // 3. Fit to screen after everything is rendered
            setTimeout(() => {
                this.fitToScreenSafe();
            }, 50);
        }, 50);
    }

    ngAfterViewInit(): void {
        // Redundant as updateView handles it, but good for safety if inputs didn't trigger change
        if (this.visibleNodes.length === 0 && this.nodes.length > 0) {
            this.updateView();
        }
    }

    public fitToScreenSafe() {
        if (this.fCanvas) {
            this.fCanvas.fitToScreen();

            // Prevent over-zoom on small graphs
            setTimeout(() => {
                if (this.fCanvas.transform.scale > 1) {
                    this.fCanvas.resetScaleAndCenter();
                }
            }, 0);
        }
    }

    onNodeClick(data: PolicyNodeData | undefined, event: Event) {
        event.stopPropagation();
        if (data) {
            this.nodeClick.emit(data);
        }
    }

    onStructureClick(data: PolicyNodeData | undefined, event: Event) {
        event.stopPropagation();
        if (data) {
            this.structureClick.emit(data);
        }
    }
}
