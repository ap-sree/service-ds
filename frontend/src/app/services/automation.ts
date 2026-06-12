import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TaskDefinition, TaskExecution, TaskExecutionSummary, AdHocRequest } from '../models/automation';
@Injectable({
    providedIn: 'root'
})
export class AutomationService {

    private http = inject(HttpClient);

    private apiUrl = environment.apiUrl + '/automation';
    getTasks(): Observable<TaskDefinition[]> {
        return this.http.get<TaskDefinition[]>(`${this.apiUrl}/tasks`);
    }
    createTask(task: TaskDefinition): Observable<TaskDefinition> {
        return this.http.post<TaskDefinition>(`${this.apiUrl}/tasks`, task);
    }
    updateTask(id: number, task: TaskDefinition): Observable<TaskDefinition> {
        return this.http.put<TaskDefinition>(`${this.apiUrl}/tasks/${id}`, task);
    }
    deleteTask(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/tasks/${id}`);
    }
    executeTask(id: number, runtimeParams?: any): Observable<TaskExecution> {
        return this.http.post<TaskExecution>(`${this.apiUrl}/tasks/${id}/execute`, runtimeParams || {});
    }
    executeAdHoc(req: AdHocRequest): Observable<TaskExecution> {
        return this.http.post<TaskExecution>(`${this.apiUrl}/execute`, req);
    }
    getTaskHistory(taskId: number): Observable<TaskExecutionSummary[]> {
        return this.http.get<TaskExecutionSummary[]>(`${this.apiUrl}/tasks/${taskId}/history`);
    }
    getExecution(id: number): Observable<TaskExecution> {
        return this.http.get<TaskExecution>(`${this.apiUrl}/executions/${id}`);
    }
    getMaxSteps(): Observable<number | null> {
        return this.http.get<number | null>(`${environment.apiUrl}/config/automation_max_steps`);
    }
}
