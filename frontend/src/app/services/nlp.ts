import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface NLPResult {
    originalText: string;
    sentences: string[];
    analysis: SentenceAnalysis[];
}

export interface SentenceAnalysis {
    text: string;
    tokens: string[];
    posTags: TokenTag[];
    entities: Entity[];
}

export interface TokenTag {
    token: string;
    tag: string;
}

export interface Entity {
    text: string;
    type: string;
    start: number;
    end: number;
}

@Injectable({
    providedIn: 'root'
})
export class NLPService {
    private apiUrl = `${environment.apiUrl}/nlp`;

    constructor(private http: HttpClient) { }

    analyze(text: string): Observable<NLPResult> {
        return this.http.post<NLPResult>(`${this.apiUrl}/analyze`, { text });
    }
}
