import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { PanelModule } from 'primeng/panel';
import { TabsModule } from 'primeng/tabs'; // Using TabsModule for now, or unified Tabs
import { Tabs } from 'primeng/tabs';
import { TabList } from 'primeng/tabs';
import { Tab } from 'primeng/tabs';
import { TabPanels } from 'primeng/tabs';
import { TabPanel } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { NLPService, NLPResult, Entity } from '../../services/nlp';

@Component({
    selector: 'app-nlp',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CardModule,
        ButtonModule,
        TextareaModule,
        TableModule,
        TagModule,
        PanelModule,
        Tabs, TabList, Tab, TabPanels, TabPanel,
        TooltipModule
    ],
    templateUrl: './nlp.html',
    styleUrls: ['./nlp.scss']
})
export class NLPComponent {
    text: string = '';
    result: NLPResult | null = null;
    loading: boolean = false;

    private service = inject(NLPService);
    private messageService = inject(MessageService);



    analyze() {
        if (!this.text.trim()) return;

        this.loading = true;
        this.service.analyze(this.text).subscribe({
            next: (res) => {
                this.result = res;
                this.loading = false;
            },
            error: (err) => {
                this.loading = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Analysis failed' });
            }
        });
    }

    getEntitiesByType(type: string): Entity[] {
        if (!this.result) return [];
        return this.result.analysis.flatMap(s => s.entities).filter(e => e.type === type);
    }

    getAllEntities(): Entity[] {
        if (!this.result) return [];
        return this.result.analysis.flatMap(s => s.entities);
    }
}
