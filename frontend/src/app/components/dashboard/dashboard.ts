import { Component, OnInit, inject, ViewChildren, QueryList } from '@angular/core';

import { DashboardService, WidgetDefinition } from '../../services/dashboard';
import { AuthService } from '../../services/auth';
import { UserService } from '../../services/user';

// PrimeNG Imports
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select'; // Check if Select or Dropdown
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber'; // For interval maybe?
import { FormsModule } from '@angular/forms';

// Prime Component
import { GenericWidgetComponent } from '../generic-widget/generic-widget';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [
    FormsModule,
    GenericWidgetComponent,
    ToolbarModule,
    ButtonModule,
    SelectModule,
    ConfirmDialogModule,
    CardModule,
    InputNumberModule
],
    providers: [ConfirmationService],
    templateUrl: './dashboard.html',
    styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit {
    private dashboardService = inject(DashboardService);
    private authService = inject(AuthService);
    private userService = inject(UserService);
    private confirmationService = inject(ConfirmationService);
    private messageService = inject(MessageService);

    constructor() {
        this.userService.getGlobalPreferences().subscribe(prefs => { /* Handle preferences here */ });
    }

    @ViewChildren(GenericWidgetComponent) widgetRefs!: QueryList<GenericWidgetComponent>;

    allWidgets: WidgetDefinition[] = [];
    displayedWidgets: WidgetDefinition[] = [];

    isEditing = false;

    get username(): string {
        return this.authService.getUsername() || 'default';
    }

    loading = false;

    ngOnInit() {
        this.loadData();
    }

    // Load USER'S view (User -> Global -> Empty)
    loadData() {
        this.loading = true;
        this.dashboardService.getWidgets(this.username).subscribe({
            next: (widgets) => {
                // Custom Sort Order: CARD -> MULTI_METRIC -> STATUS_GRID -> TABLE
                const typeOrder: { [key: string]: number } = {
                    'CARD': 1,
                    'MULTI_METRIC': 2,
                    'STATUS_GRID': 3,
                    'TABLE': 4
                };

                this.displayedWidgets = widgets.sort((a, b) => {
                    const orderA = typeOrder[a.type] || 99;
                    const orderB = typeOrder[b.type] || 99;
                    if (orderA !== orderB) return orderA - orderB;
                    // Secondary sort by ID (creation time) to be stable
                    return (a.id || 0) - (b.id || 0);
                });

                this.loading = false;
            },
            error: (err) => {
                console.error('Failed to load dashboard', err);
                this.loading = false;
            }
        });
    }

    // Lazy load FULL inventory for "Add Widget" dropdown
    loadInventory() {
        this.dashboardService.getWidgetCatalog().subscribe(all => {
            this.allWidgets = all;
        });
    }

    // Helper to load Global for editing (Admin)
    loadGlobalForEdit() {
        this.loadData();
    }

    refreshInterval = 0;
    refreshOptions = [
        { label: 'Manual', value: 0 },
        { label: '30 Seconds', value: 30000 },
        { label: '1 Minute', value: 60000 },
        { label: '5 Minutes', value: 300000 }
    ];
    private intervalId: any;

    ngOnDestroy() {
        this.stopAutoRefresh();
    }

    onIntervalChange(ms: number) {
        this.refreshInterval = ms;
        this.stopAutoRefresh();
        if (ms > 0) {
            this.intervalId = setInterval(() => {
                if (!this.isEditing) {
                    this.refreshData();
                }
            }, ms);
        }
    }

    stopAutoRefresh() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    refreshData() {
        if (this.widgetRefs) {
            this.widgetRefs.forEach(w => w.loadData());
        }
    }

    toggleEdit() {
        this.isEditing = !this.isEditing;
        if (this.isEditing) {
            this.loadInventory();
        } else {
            this.loadData();
        }
    }



    saveLayout() {
        const ids = this.displayedWidgets.map(w => w.id!);
        this.userService.savePreferences(this.username, { widgetIds: ids }).subscribe({
            next: () => {
                this.isEditing = false;
                this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Layout saved successfully.' });
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save layout.' });
            }
        });
    }

    saveGlobalLayout() {
        const ids = this.displayedWidgets.map(w => w.id!);
        this.userService.saveGlobalPreferences({ widgetIds: ids }).subscribe({
            next: () => {
                this.isEditing = false;
                this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Global layout saved successfully.' });
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save global layout.' });
            }
        });
    }

    resetLayout(event: Event) {
        this.confirmationService.confirm({
            target: event.target as EventTarget,
            message: 'Revert to Global Default? This will discard your custom layout.',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.userService.resetPreferences(this.username).subscribe({
                    next: () => {
                        this.isEditing = false;
                        this.loadData();
                        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Layout reset to defaults.' });
                    },
                    error: (err) => {
                        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to reset layout.' });
                    }
                });
            }
        });
    }

    // --- Edit Actions ---
    addToDash(widget: WidgetDefinition) {
        if (!this.displayedWidgets.find(w => w.id === widget.id)) {
            this.displayedWidgets.push(widget);
        }
    }

    removeFromDash(index: number) {
        this.displayedWidgets.splice(index, 1);
    }

    moveUp(index: number) {
        if (index > 0) {
            [this.displayedWidgets[index], this.displayedWidgets[index - 1]] =
                [this.displayedWidgets[index - 1], this.displayedWidgets[index]];
        }
    }

    moveDown(index: number) {
        if (index < this.displayedWidgets.length - 1) {
            [this.displayedWidgets[index], this.displayedWidgets[index + 1]] =
                [this.displayedWidgets[index + 1], this.displayedWidgets[index]];
        }
    }
}
