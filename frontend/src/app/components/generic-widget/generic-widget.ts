
import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { BadgeModule } from 'primeng/badge';
import { TagModule } from 'primeng/tag';
import { DashboardService, WidgetDefinition, WidgetDataResponse } from '../../services/dashboard.service';
import { AuthService } from '../../services/auth.service';

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
  protected authService = inject(AuthService);

  data: any[] = [];
  displayedColumns: string[] = [];
  loading = true;
  error = '';

  // Card Metrics
  cardValue: string | number = '-';
  cardColorClass = '';

  ngOnInit() {
    this.assignCardColor();
    this.loadData();
  }

  assignCardColor() {
    // Generate a consistent color based on title length/char codes
    if (this.widgetDef.type === 'CARD') {
      const variants = ['bg-cyan', 'bg-purple', 'bg-orange', 'bg-blue'];
      const index = (this.widgetDef.title.length + (this.widgetDef.id || 0)) % variants.length;
      this.cardColorClass = variants[index];
    }
  }

  loadData() {
    this.loading = true;

    // Pass Current User ID to Backend for Server-Side Filtering
    let currentUser = this.authService.currentUser();

    // Fallback: Check localStorage manually if Signal is empty (edge case)
    if (!currentUser) {
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        currentUser = JSON.parse(stored);
      }
    }

    const userId = currentUser ? currentUser.username : undefined;

    this.dashboardService.getWidgetData(this.widgetDef.id!, userId).subscribe({
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

  // Status Grid
  statusGridItems: { label: string, status: string, color: string }[] = [];
  multiMetricItems: { label: string, value: number, operation: string }[] = [];

  processSmartData(res: WidgetDataResponse) {
    // res = { type: 'card'|'table', count?, items?, label? }
    if (!res || !res.type) return;

    const lowerType = res.type.toLowerCase();

    if (lowerType === 'card') {
      // Backend already counted it
      this.cardValue = res.count ?? '-';
      // We could use res.label if we wanted to update title dynamically
    }
    else if (lowerType === 'table') {
      this.data = res.items || [];
      if (this.data.length > 0) {
        this.displayedColumns = Object.keys(this.data[0]).filter(k => !k.startsWith('_'));
      }
    }
    else if (lowerType === 'grid' || lowerType === 'status_grid') {
      // Backend now handles color/label mapping
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
