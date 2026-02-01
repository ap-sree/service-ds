
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileUploadModule } from 'primeng/fileupload';
import { ListboxModule } from 'primeng/listbox';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { DrawerModule } from 'primeng/drawer';
import { DiffNode, PolicySummary, PolicyDiffService } from '../../services/policy-diff';
import { PolicyVizComponent } from '../../components/policy-viz/policy-viz';

@Component({
    selector: 'app-pc-temp',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        FileUploadModule,
        ListboxModule,
        ButtonModule,
        CardModule,
        TagModule,
        PolicyVizComponent,
        DrawerModule
    ],
    templateUrl: './pc-temp.html',
    styleUrl: './pc-temp.scss'
})
export class PcTempComponent {

    // Parsed Policies
    policiesA = signal<PolicySummary[]>([]);
    policiesB = signal<PolicySummary[]>([]);

    // Selected Objects
    selectedPolicyA: PolicySummary | null = null;
    selectedPolicyB: PolicySummary | null = null;

    diffTree = signal<DiffNode | null>(null);
    selectedNode = signal<DiffNode | null>(null);

    showDetails = false; // New property for sidebar visibility

    constructor(private diffService: PolicyDiffService) { }

    onUploadA(event: any) {
        this.processFile(event.files[0], (policies) => {
            this.policiesA.set(policies);
            if (policies.length === 1) this.selectedPolicyA = policies[0];
            // Clear current upload since we processed it
            if (event.originalEvent) event.originalEvent.target.value = '';
        });
    }

    onUploadB(event: any) {
        this.processFile(event.files[0], (policies) => {
            this.policiesB.set(policies);
            if (policies.length === 1) this.selectedPolicyB = policies[0];
            if (event.originalEvent) event.originalEvent.target.value = '';
        });
    }

    clearA() {
        this.policiesA.set([]);
        this.selectedPolicyA = null;
    }

    clearB() {
        this.policiesB.set([]);
        this.selectedPolicyB = null;
    }

    private processFile(file: File, callback: (policies: PolicySummary[]) => void) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
            try {
                const json = JSON.parse(e.target.result);
                // Use service to extract normalized list
                const extracted = this.diffService.extractPolicies(json);
                callback(extracted);
            } catch (error) {
                console.error('Error parsing JSON:', error);
                alert('Failed to parse JSON file.');
            }
        };
        reader.readAsText(file);
    }

    canCompare(): boolean {
        return !!this.selectedPolicyA && !!this.selectedPolicyB;
    }

    compare() {
        if (!this.selectedPolicyA || !this.selectedPolicyB) {
            return;
        }

        try {
            const tree = this.diffService.comparePolicies(this.selectedPolicyA.data, this.selectedPolicyB.data);
            this.diffTree.set(tree);
            this.selectedNode.set(null);
        } catch (e) {
            console.error("Error comparing", e);
            alert("Error comparing policies. Check console.");
        }
    }

    onNodeSelected(node: DiffNode) {
        this.selectedNode.set(node);
        this.showDetails = true; // Open sidebar when a node is selected
    }

    getSeverity(status: string): any {
        switch (status) {
            case 'added': return 'success';
            case 'removed': return 'danger';
            case 'modified': return 'warning';
            case 'same': return 'secondary';
            default: return 'info';
        }
    }
}
