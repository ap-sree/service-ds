import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation, withDisabledInitialNavigation } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideOAuthClient, OAuthService } from 'angular-oauth2-oidc';

import { providePrimeNG } from 'primeng/config';
import Material from '@primeuix/themes/material';
import { definePreset } from '@primeuix/themes';
import { routes } from './app.routes';
import { authConfig } from './auth/auth.config';

const BluePreset = definePreset(Material, {
  semantic: {
    primary: {
      50: '{blue.50}',
      100: '{blue.100}',
      200: '{blue.200}',
      300: '{blue.300}',
      400: '{blue.400}',
      500: '{blue.500}',
      600: '{blue.600}',
      700: '{blue.700}',
      800: '{blue.800}',
      900: '{blue.900}',
      950: '{blue.950}'
    }
  }
});

function initializeOAuth(oauthService: OAuthService): () => Promise<any> {
  return () => {
    oauthService.configure(authConfig);
    return oauthService.loadDiscoveryDocument()
      .then(() => oauthService.tryLogin())
      .then(() => { });
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation(), withDisabledInitialNavigation()),
    provideHttpClient(),
    provideOAuthClient(),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeOAuth,
      deps: [OAuthService],
      multi: true
    },
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: BluePreset,
        options: {
          darkModeSelector: false
        }
      }
    })
  ]
};
