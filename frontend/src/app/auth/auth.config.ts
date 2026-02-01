import { AuthConfig } from 'angular-oauth2-oidc';

export const authConfig: AuthConfig = {
    issuer: 'https://localhost:9031',
    redirectUri: window.location.origin + '/',
    postLogoutRedirectUri: window.location.origin,
    clientId: 'newapp',
    responseType: 'code',
    scope: 'openid profile email',
    showDebugInformation: true,
    requireHttps: false, 
    strictDiscoveryDocumentValidation: false,
    skipIssuerCheck: true,
};
