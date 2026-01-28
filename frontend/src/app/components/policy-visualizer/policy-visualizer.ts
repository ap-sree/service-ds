import { Component, Input, OnInit, OnChanges, SimpleChanges, ViewEncapsulation, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FFlowModule } from '@foblex/flow';
import {
    AuthenticationPolicyTree, Connection, FlowNode, AuthenticationPolicyFragment, AuthenticationSelector, PolicyNodeData
} from '../../models/policy-visualizer';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

import { TableModule } from 'primeng/table';
import { PolicyFlowComponent } from './policy-flow/policy-flow';
import { PolicyLayoutService } from '../../services/policy-layout';

@Component({
    selector: 'app-policy-visualizer',
    standalone: true,
    imports: [CommonModule, FFlowModule, CardModule, DialogModule, ButtonModule, TableModule, PolicyFlowComponent],
    templateUrl: './policy-visualizer.html',
    styles: [`
        :host {
            display: block;
            height: 100vh;
            width: 100%;
        }
    `],
    encapsulation: ViewEncapsulation.None
})
export class PolicyVisualizerComponent implements OnInit, OnChanges {
    @Input() policy: AuthenticationPolicyTree | null = null;
    @Input() selectors: AuthenticationSelector[] = [];
    @Input() fragments: AuthenticationPolicyFragment[] = [];

    @ViewChild('childVisualizer') childVisualizer!: PolicyVisualizerComponent;
    @ViewChild(PolicyFlowComponent) flowComponent!: PolicyFlowComponent;

    nodes: FlowNode[] = [];
    connections: Connection[] = [];
    flowId: string = 'policy-flow-' + Math.random().toString(36).substring(2, 9);

    private isProcessing = false;

    constructor(
        private readonly el: ElementRef,
        private readonly cdr: ChangeDetectorRef,
        private readonly layoutService: PolicyLayoutService
    ) { }

    // Details Dialog State
    isDialogVisible: boolean = false;
    selectedNodeData: PolicyNodeData | null = null;

    // Fragment Dialog State (now uses direct flow component)
    isFragmentStructureDialogVisible: boolean = false;
    isFragmentFlowVisible: boolean = false;
    selectedFragment: AuthenticationPolicyFragment | null = null;
    fragmentNodes: FlowNode[] = [];
    fragmentConnections: Connection[] = [];
    fragmentFlowId: string = '';

    onFragmentDialogShow() {
        // Delay to ensuring dialog animation completes and DOM is stable
        setTimeout(() => {
            this.isFragmentFlowVisible = true;
        }, 400);
    }

    onFragmentDialogHide() {
        this.isFragmentFlowVisible = false;
    }

    onFragmentDialogMaximize(event: any) {
        // Wait for maximize animation
        setTimeout(() => {
            if (this.fragmentFlow) {
                this.fragmentFlow.fitToScreenSafe();
            }
        }, 300);
    }

    @ViewChild('fragmentFlow') fragmentFlow!: PolicyFlowComponent;

    showFragmentDetails(data: PolicyNodeData): void {
        this.selectedNodeData = data;
        this.isDialogVisible = true;
    }

    showFragmentStructure(data: PolicyNodeData): void {
        if (data?.fragmentStructure?.id) {
            const found = this.fragments.find(f => f.id === data.fragmentStructure!.id);
            const fragment = found || data.fragmentStructure;

            if (fragment?.rootNode?.action) {
                this.selectedFragment = fragment;
                this.fragmentFlowId = 'frag-flow-' + fragment.id;

                // Use service to generate layout for popup
                const result = this.layoutService.convertPolicyToFlow(
                    fragment.rootNode.action,
                    fragment.rootNode.children || [],
                    this.fragmentFlowId,
                    this.selectors,
                    this.fragments
                );

                this.fragmentNodes = result.nodes;
                this.fragmentConnections = result.connections;
                this.isFragmentStructureDialogVisible = true;
            }
        }
    }

    refresh() {
        this.processPolicy();
        // optionally force child to fit screen if needed
        setTimeout(() => {
            this.flowComponent?.fitToScreenSafe();
        }, 100);
    }

    ngOnInit(): void {
        this.processPolicy();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['policy']) {
            this.processPolicy();
        }
    }

    processPolicy() {
        if (this.isProcessing) return;

        // Safety check: if inputs shouldn't be processed yet
        if (!this.policy?.rootNode?.action) {
            this.nodes = [];
            this.connections = [];
            return;
        }
        console.log(this.policy);

        // 1. Check Visibility BEFORE doing expensive work
        if (this.el.nativeElement.offsetWidth === 0) {
            return;
        }

        this.isProcessing = true;
        console.log(`[Visualizer ${this.flowId}] Processing policy sync...`);

        try {
            // 2. Generate Data via Service
            const result = this.layoutService.convertPolicyToFlow(
                this.policy.rootNode.action,
                this.policy.rootNode.children || [],
                this.flowId,
                this.selectors,
                this.fragments
            );

            // 3. Assign Nodes & Connections
            this.nodes = result.nodes;
            this.connections = result.connections;

            // Force change detection to pass inputs to child
            this.cdr.detectChanges();

        } catch (e) {
            console.error('Error processing policy', e);
        } finally {
            this.isProcessing = false;
        }
    }
}
