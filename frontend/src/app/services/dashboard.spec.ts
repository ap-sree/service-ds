
import { TestBed } from '@angular/core/testing';
import { DashboardService, WidgetDefinition } from './dashboard';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('DashboardService', () => {
    let service: DashboardService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [DashboardService]
        });
        service = TestBed.inject(DashboardService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should create widget', async () => {
        const widget: WidgetDefinition = { title: 'Test Widget', type: 'CARD', dataSourceTable: 'test_table' };

        const promise = service.createWidget(widget).toPromise();

        const req = httpMock.expectOne(`${environment.apiUrl}/widgets`);
        expect(req.request.method).toBe('POST');
        req.flush({ ...widget, id: 1 });

        const res = await promise;
        expect(res?.id).toBe(1);
    });

    it('should delete widget', async () => {
        const promise = service.deleteWidget(123).toPromise();

        const req = httpMock.expectOne(`${environment.apiUrl}/widgets/123`);
        expect(req.request.method).toBe('DELETE');
        req.flush({});

        await promise;
    });

    it('should update widget', async () => {
        const widget: WidgetDefinition = { title: 'Updated', type: 'GRID', dataSourceTable: 'users' };

        const promise = service.updateWidget(456, widget).toPromise();

        const req = httpMock.expectOne(`${environment.apiUrl}/widgets/456`);
        expect(req.request.method).toBe('PUT');
        expect(req.request.body).toEqual(widget);
        req.flush({});

        await promise;
    });

    it('should get widgets for user', async () => {
        const promise = service.getWidgets('testuser').toPromise();

        const req = httpMock.expectOne(`${environment.apiUrl}/widgets?username=testuser`);
        expect(req.request.method).toBe('GET');
        req.flush([{ id: 1, title: 'W1' }]);

        const res = await promise;
        expect(res).toHaveLength(1);
    });

    it('should get widget catalog', async () => {
        const promise = service.getWidgetCatalog().toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/widget-catalog`);
        req.flush([]);
        await promise;
    });

    it('should get all widgets (admin)', async () => {
        const promise = service.getAllWidgets().toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/admin/widgets`);
        req.flush([]);
        await promise;
    });

    it('should get widget data without userId', async () => {
        const promise = service.getWidgetData(100).toPromise();

        const req = httpMock.expectOne(`${environment.apiUrl}/widgets/100/data`);
        req.flush({ type: 'CARD', count: 10 });

        const res = await promise;
        expect(res?.count).toBe(10);
    });

    it('should get widget data with userId', async () => {
        const promise = service.getWidgetData(100, 'user123').toPromise();

        const req = httpMock.expectOne(`${environment.apiUrl}/widgets/100/data?userId=user123`);
        req.flush({ type: 'CARD' });

        await promise;
    });

    it('should get generic table data with default limit', async () => {
        const promise = service.getData('audit_logs').toPromise();

        const req = httpMock.expectOne(`${environment.apiUrl}/data/audit_logs?limit=10000`);
        req.flush([]);

        await promise;
    });

    it('should get generic table data with custom limit', async () => {
        const promise = service.getData('audit_logs', 50).toPromise();

        const req = httpMock.expectOne(`${environment.apiUrl}/data/audit_logs?limit=50`);
        req.flush([]);

        await promise;
    });

    it('should get dashboard layout', async () => {
        const promise = service.getLayout('user1').toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/dashboard-layout/user1`);
        req.flush({ widgetIds: [1, 2] });
        await promise;
    });

    it('should save dashboard layout', async () => {
        const promise = service.saveLayout('user1', [1, 2, 3]).toPromise();

        const req = httpMock.expectOne(`${environment.apiUrl}/dashboard-layout/user1`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({ widgetIds: [1, 2, 3] });
        req.flush({});

        await promise;
    });
});
