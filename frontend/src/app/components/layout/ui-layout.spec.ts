import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiLayoutComponent } from './ui-layout';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AuthService } from '../../auth/auth';
import { SessionNotificationService } from '../../services/session-notification';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('UiLayoutComponent', () => {
    let component: UiLayoutComponent;
    let fixture: ComponentFixture<UiLayoutComponent>;

    beforeEach(async () => {
        const mockAuthService = {
            // Add properties/methods used by UiLayout if any
        };

        const mockSessionService = {
            notifications: () => [], // Signal read
            remove: vi.fn()
        };

        await TestBed.configureTestingModule({
            imports: [UiLayoutComponent, NoopAnimationsModule],
            providers: [
                {
                    provide: ActivatedRoute,
                    useValue: { params: of({}) }
                },
                { provide: AuthService, useValue: mockAuthService },
                { provide: SessionNotificationService, useValue: mockSessionService }
            ]
        })
            .compileComponents();

        fixture = TestBed.createComponent(UiLayoutComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
