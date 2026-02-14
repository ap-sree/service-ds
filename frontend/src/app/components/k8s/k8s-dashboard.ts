import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TableModule } from 'primeng/table';
import { Tabs } from 'primeng/tabs';
import { TabList } from 'primeng/tabs';
import { Tab } from 'primeng/tabs';
import { TabPanels } from 'primeng/tabs';
import { TabPanel } from 'primeng/tabs';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { SelectButtonModule } from 'primeng/selectbutton';
import { CardModule } from 'primeng/card';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { K8sService, K8sPod } from '../../services/k8s';
import { K8sTerminalComponent } from './k8s-terminal';

@Component({
    selector: 'app-k8s-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        InputTextModule,
        TextareaModule,
        TableModule,
        Tabs,
        TabList,
        Tab,
        TabPanels,
        TabPanel,
        DialogModule,
        ToastModule,
        SelectButtonModule,
        CardModule,
        IconField,
        InputIcon,
        TagModule,
        TooltipModule,
        K8sTerminalComponent
    ],
    providers: [MessageService],
    templateUrl: './k8s-dashboard.html',
    styles: [`
    :host { display: block; }
  `]
})
export class K8sDashboardComponent implements OnInit {

    configOptions = [
        { label: 'Kube File Path', value: 'FILE' },
        { label: 'Token', value: 'TOKEN' }
    ];

    configType: 'FILE' | 'TOKEN' = 'FILE';
    configValue = '';

    namespace = '';
    pods: K8sPod[] = [];
    loading = false;

    displayTerminal = false;
    selectedPod: K8sPod | null = null;
    terminalCommand = '/bin/sh';

    constructor(
        private k8sService: K8sService,
        private messageService: MessageService
    ) { }

    ngOnInit() {
        this.loadPods();
    }

    saveConfig() {
        if (!this.configValue) {
            this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Please provide value' });
            return;
        }
        this.k8sService.saveConfig(this.configType, this.configValue).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Configuration saved' });
                this.loadPods();
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save config' });
            }
        });
    }

    loadPods() {
        this.loading = true;
        this.k8sService.getPods(this.namespace).subscribe({
            next: (data) => {
                this.pods = data;
                this.loading = false;
            },
            error: (err) => {
                this.loading = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load pods. Check connection.' });
            }
        });
    }

    openTerminal(pod: K8sPod) {
        this.selectedPod = pod;
        this.displayTerminal = true;
    }

    getSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
        if (!status) return 'secondary';
        const s = status.toLowerCase();
        if (s === 'running' || s === 'succeeded') return 'success';
        if (s === 'pending') return 'warn';
        if (s === 'failed' || s === 'error' || s === 'crashloopbackoff') return 'danger';
        return 'info';
    }
}
