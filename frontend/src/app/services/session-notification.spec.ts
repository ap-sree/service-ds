
import { TestBed } from '@angular/core/testing';
import { SessionNotificationService, AppNotification } from './session-notification';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from '../auth/auth';
import { environment } from '../../environments/environment';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('SessionNotificationService', () => {
    let service: SessionNotificationService;
    let httpMock: HttpTestingController;
    let authServiceSpy: { getUsername: any };

    beforeEach(() => {
        authServiceSpy = {
            getUsername: vi.fn()
        };

        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [
                SessionNotificationService,
                { provide: AuthService, useValue: authServiceSpy }
            ]
        });
        service = TestBed.inject(SessionNotificationService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
        service.stopPolling();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should add notification', () => {
        const notif: AppNotification = {
            title: 'Test',
            body: 'Body',
            action_type: 'INFO',
            timestamp: new Date()
        };

        // Use a spy on the notifications signal if update logic is complex, 
        // but here we can just invoke private logic or trigger it via polling.
        // Since processNotification is private, we test public effects.
        // Let's test the public method 'remove' first as a baseline.

        // Manually setting signal for test
        service.notifications.set([notif]);
        expect(service.notifications().length).toBe(1);
    });

    it('should remove notification', () => {
        const notif: AppNotification = {
            title: 'Test',
            body: 'Body',
            action_type: 'INFO',
            timestamp: new Date()
        };
        service.notifications.set([notif]);

        service.remove(0);
        expect(service.notifications().length).toBe(0);
    });

    it('should clear all notifications', () => {
        const notif: AppNotification = {
            title: 'Test',
            body: 'Body',
            action_type: 'INFO',
            timestamp: new Date()
        };
        service.notifications.set([notif, notif]);
        service.clearAll();
        expect(service.notifications().length).toBe(0);
    });

    it('should poll notifications with username', async () => {
        authServiceSpy.getUsername.mockReturnValue('testuser');

        // Start polling triggers checkNotifications immediately
        vi.useFakeTimers();
        // Note: Vitest fake timers are different from zone.js fakeAsync.
        // But for http calls we just use httpMock.

        service.checkNotifications();

        const req = httpMock.expectOne(`${environment.apiUrl}/notifications?user=testuser`);
        expect(req.request.method).toBe('GET');

        const mockNotifs = [{ title: 'New Notif', body: 'Content', action_type: 'ALERT' }];
        req.flush(mockNotifs);

        expect(service.notifications().length).toBe(1);
        expect(service.notifications()[0].title).toBe('New Notif');
    });

    it('should poll notifications without username', () => {
        authServiceSpy.getUsername.mockReturnValue(null);
        service.checkNotifications();

        const req = httpMock.expectOne(`${environment.apiUrl}/notifications`);
        expect(req.request.method).toBe('GET');
        req.flush([]);
    });

    it('should handle notification processing and signal updates', () => {
        authServiceSpy.getUsername.mockReturnValue(null);
        let emittedNotif: AppNotification | undefined;
        service.notificationReceived$.subscribe(n => emittedNotif = n);

        service.checkNotifications();

        const req = httpMock.expectOne(`${environment.apiUrl}/notifications`);
        const mockRaw = [{ title: 'Raw', body: 'RawBody', action_type: 'TEST' }];
        req.flush(mockRaw);

        expect(service.notifications().length).toBe(1);
        expect(service.notifications()[0].action_type).toBe('TEST');
        expect(emittedNotif).toBeDefined();
        expect(emittedNotif?.title).toBe('Raw');
    });

    it('should use default action_type if missing', () => {
        authServiceSpy.getUsername.mockReturnValue(null);
        service.checkNotifications();

        const req = httpMock.expectOne(`${environment.apiUrl}/notifications`);
        req.flush([{ title: 'Default', body: 'Body' }]); // Missing action_type

        expect(service.notifications()[0].action_type).toBe('TOAST');
    });

    it('should handle error in polling gracefully', () => {
        authServiceSpy.getUsername.mockReturnValue('user');
        service.checkNotifications();

        const req = httpMock.expectOne(`${environment.apiUrl}/notifications?user=user`);
        req.flush(null, { status: 500, statusText: 'Server Error' });

        // Should not crash
        expect(service.notifications().length).toBe(0);
    });

    it('should start polling interval', () => {
        vi.useFakeTimers();
        // Mock implementation to avoid HTTP calls during timer test
        const checkSpy = vi.spyOn(service, 'checkNotifications').mockImplementation(() => { });

        service.startPolling();
        expect(checkSpy).toHaveBeenCalled(); // Initial call

        vi.advanceTimersByTime(10000);
        expect(checkSpy).toHaveBeenCalledTimes(2);

        service.stopPolling();
        vi.useRealTimers();
    });
});
