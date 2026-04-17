
import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { BadgeModule } from 'primeng/badge';
import { TagModule } from 'primeng/tag';
import { DashboardService, WidgetDefinition, WidgetDataResponse, QueryConfig } from '../../services/dashboard';

@Component({
  selector: 'app-generic-widget',
  standalone: true,
  imports: [CommonModule, CardModule, TableModule, ProgressSpinnerModule, BadgeModule, TagModule],
  templateUrl: './generic-widget.html',
  styleUrl: './generic-widget.scss'
})
export class GenericWidgetComponent implements OnInit {
  @Input({ required: true }) widgetDef!: WidgetDefinition;
  @Input() isEditing = false;

  protected dashboardService = inject(DashboardService);

  data: any[] = [];
  displayedColumns: string[] = [];
  loading = true;
  error = '';


  cardValue: string | number = '-';
  cardColorClass = '';

  ngOnInit() {
    this.assignCardColor();
    this.loadData();
  }

  assignCardColor() {

    if (this.widgetDef.type === 'CARD') {
      const variants = ['bg-cyan', 'bg-purple', 'bg-orange', 'bg-blue'];
      const index = (this.widgetDef.title.length + (this.widgetDef.id || 0)) % variants.length;
      this.cardColorClass = variants[index];
    }
  }

  loadData() {
    this.loading = true;
    this.error = '';

    if (this.widgetDef.schemaChanged) {
      this.loading = false;
      this.error = 'Check widget configuration';
      return;
    }

    this.dashboardService.getWidgetData(this.widgetDef.id!).subscribe({
      next: (res) => {
        this.processSmartData(res);
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load data';
        this.loading = false;
        console.error(err);
      }
    });
  }


  statusGridItems: { label: string, status: string, color: string }[] = [];
  multiMetricItems: { label: string, value: number, operation: string }[] = [];

  processSmartData(res: WidgetDataResponse) {

    if (!res || !res.type) return;

    const lowerType = res.type.toLowerCase();

    if (lowerType === 'card') {

      this.cardValue = res.count ?? '-';

    }
    else if (lowerType === 'table') {
      this.data = res.items || [];
      if (this.data.length > 0) {

        let config: QueryConfig | undefined;
        const rawConfig = this.widgetDef.queryConfig;

        if (typeof rawConfig === 'string') {
          try {
            config = JSON.parse(rawConfig);
          } catch (e) {
            config = undefined;
          }
        } else {
          config = rawConfig;
        }

        if (config && Array.isArray(config.columns) && config.columns.length > 0) {
          this.displayedColumns = config.columns;
        } else {
          this.displayedColumns = Object.keys(this.data[0]).filter(k => !k.startsWith('_'));
        }
      }
    }
    else if (lowerType === 'grid' || lowerType === 'status_grid') {

      this.statusGridItems = res.items || [];
    }
    else if (lowerType === 'multi_metric') {
      this.statusGridItems = [];
      this.multiMetricItems = res.items || [];
    }
  }

  getBadgeClass(color: string): string {
    const map: { [key: string]: string } = {
      'primary': 'bg-primary',
      'accent': 'bg-pink-500',
      'warn': 'bg-orange-500',
      'error': 'bg-red-500',
      'success': 'bg-green-500',
      'info': 'bg-blue-500',
      'cyan': 'bg-cyan-500',
      'purple': 'bg-purple-500'
    };
    return map[color] || 'bg-primary';
  }
}
