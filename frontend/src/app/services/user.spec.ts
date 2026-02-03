
import { TestBed } from '@angular/core/testing';
import { UserService } from './user';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { User, UserPreferences } from '../models/user';
import { environment } from '../../environments/environment';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('UserService', () => {
    let service: UserService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [UserService]
        });
        service = TestBed.inject(UserService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should get users', async () => {
        const promise = service.getUsers().toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/users`);
        req.flush([{ username: 'u1' }]);
        const res = await promise;
        expect(res).toHaveLength(1);
    });

    it('should create user', async () => {
        const user = { username: 'newuser', role: 'USER' };
        const promise = service.createUser(user).toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/users`);
        expect(req.request.method).toBe('POST');
        req.flush(user);
        const res = await promise;
        expect(res?.username).toBe('newuser');
    });

    it('should update user', async () => {
        const promise = service.updateUser('u1', { role: 'ADMIN' }).toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/users/u1`);
        expect(req.request.method).toBe('PUT');
        req.flush({});
        await promise;
    });

    it('should update role', async () => {
        const promise = service.updateRole('u1', 'ADMIN').toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/users/u1/role`);
        expect(req.request.method).toBe('PUT');
        expect(req.request.body).toEqual({ role: 'ADMIN' });
        req.flush({});
        await promise;
    });

    it('should save preferences', async () => {
        const prefs: UserPreferences = { theme: 'dark', dashboardLayout: [] };
        const promise = service.savePreferences('u1', prefs).toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/users/u1/preferences`);
        expect(req.request.method).toBe('POST');
        req.flush({});
        await promise;
    });

    it('should reset preferences', async () => {
        const promise = service.resetPreferences('u1').toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/users/u1/preferences`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toBeNull();
        req.flush({});
        await promise;
    });

    it('should get preferences', async () => {
        const promise = service.getPreferences('u1').toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/users/u1/preferences`);
        req.flush({ theme: 'light' });
        const res = await promise;
        expect(res?.theme).toBe('light');
    });

    it('should get global preferences', async () => {
        const promise = service.getGlobalPreferences().toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/config/global_dashboard_layout`);
        req.flush({});
        await promise;
    });

    it('should save global preferences', async () => {
        const pref = { layout: [] };
        const promise = service.saveGlobalPreferences(pref).toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/config`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({ key: 'global_dashboard_layout', value: pref });
        req.flush({});
        await promise;
    });

    it('should delete user', async () => {
        const promise = service.deleteUser('u1').toPromise();
        const req = httpMock.expectOne(`${environment.apiUrl}/users/u1`);
        expect(req.request.method).toBe('DELETE');
        req.flush({});
        await promise;
    });
});
