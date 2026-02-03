
import { TestBed } from '@angular/core/testing';
import { SourceService } from './source';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DataSource, SyncDefinition } from '../models/sync';
import { environment } from '../../environments/environment';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('SourceService', () => {
    let service: SourceService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [SourceService]
        });
        service = TestBed.inject(SourceService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should get sources', async () => {
        const promise = service.getSources().toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/data-sources`);
        req.flush([{ id: 1, name: 'S1' }]);
        const res = await promise;
        expect(res).toHaveLength(1);
    });

    it('should create source', async () => {
        const source: DataSource = { name: 'New Source', type: 'REST_API', config: {} };
        const promise = service.createSource(source).toPromise();

        const req = httpMock.expectOne(`${environment.apiUrl}/data-sources`);
        expect(req.request.method).toBe('POST');
        req.flush({ ...source, id: 1 });

        const res = await promise;
        expect(res?.id).toBe(1);
    });

    it('should delete source', async () => {
        const promise = service.deleteSource(1).toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/data-sources/1`);
        expect(req.request.method).toBe('DELETE');
        req.flush({});
        await promise;
    });

    it('should update source', async () => {
        const source: DataSource = { id: 1, name: 'Updated', type: 'REST_API', config: {} };
        const promise = service.updateSource(1, source).toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/data-sources/1`);
        expect(req.request.method).toBe('PUT');
        expect(req.request.body).toEqual(source);
        req.flush({});
        await promise;
    });

    it('should get sync defs', async () => {
        const promise = service.getSyncDefs().toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/sync-defs`);
        req.flush([]);
        await promise;
    });

    it('should create sync def', async () => {
        const def: SyncDefinition = { dataSourceId: 1, targetTableName: 't1', syncMode: 'FULL' };
        const promise = service.createSyncDef(def).toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/sync-defs`);
        expect(req.request.method).toBe('POST');
        req.flush({ ...def, id: 10 });
        const res = await promise;
        expect(res?.id).toBe(10);
    });

    it('should update sync def', async () => {
        const def: SyncDefinition = { id: 10, dataSourceId: 1, targetTableName: 't1', syncMode: 'INCREMENTAL' };
        const promise = service.updateSyncDef(10, def).toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/sync-defs/10`);
        expect(req.request.method).toBe('PUT');
        req.flush({});
        await promise;
    });

    it('should delete sync def', async () => {
        const promise = service.deleteSyncDef(10).toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/sync-defs/10`);
        expect(req.request.method).toBe('DELETE');
        req.flush({});
        await promise;
    });

    it('should trigger sync', async () => {
        const promise = service.triggerSync(10).toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/sync/10`);
        expect(req.request.method).toBe('POST');
        req.flush({});
        await promise;
    });

    it('should preview data', async () => {
        const promise = service.previewData(1, 'SELECT *').toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/preview`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({ source_id: 1, fetch_query: 'SELECT *' });
        req.flush({ data: [] });
        await promise;
    });

    it('should get table schema', async () => {
        const promise = service.getTableSchema('table1').toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/schema/table1`);
        req.flush(['col1', 'col2']);
        const res = await promise;
        expect(res).toEqual(['col1', 'col2']);
    });
});
