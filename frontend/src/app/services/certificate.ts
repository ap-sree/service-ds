import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Certificate {
    alias: string;
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
    serialNumber: string;
}

@Injectable({
    providedIn: 'root'
})
export class CertificateService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/certificates`;

    getCertificates(): Observable<Certificate[]> {
        return this.http.get<Certificate[]>(this.apiUrl);
    }

    importCertificate(alias: string, file: File): Observable<void> {
        const formData = new FormData();
        formData.append('alias', alias);
        formData.append('file', file);
        return this.http.post<void>(this.apiUrl, formData);
    }

    deleteCertificate(alias: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${alias}`);
    }
}
