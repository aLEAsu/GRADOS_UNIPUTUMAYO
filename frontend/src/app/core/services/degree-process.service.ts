import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import {
  DegreeProcess,
  DegreeModality,
  RequirementInstance,
  Approval,
  ApprovalDecision
} from '../models/degree-process.model';
import { PaginatedResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class DegreeProcessService {
  private readonly apiUrl = `${environment.apiUrl}/degree-processes`;

  constructor(private http: HttpClient) {}

  // Process CRUD
  createProcess(data: {
    modalityId: string;
    title: string;
    description?: string;
  }): Observable<DegreeProcess> {
    return this.http.post<DegreeProcess>(this.apiUrl, data);
  }

  getProcesses(params?: {
    page?: number;
    limit?: number;
    status?: string;
    modalityCode?: string;    // Correcto: el backend usa 'modalityCode', no 'modalityId'
    studentId?: string;
    advisorId?: string;
    search?: string;
  }): Observable<PaginatedResponse<DegreeProcess>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }
    return this.http.get<PaginatedResponse<DegreeProcess>>(this.apiUrl, { params: httpParams });
  }

  getProcessById(id: string): Observable<DegreeProcess> {
    return this.http.get<DegreeProcess>(`${this.apiUrl}/${id}`);
  }

  // Process state transitions
  activateProcess(id: string): Observable<DegreeProcess> {
    return this.http.patch<DegreeProcess>(`${this.apiUrl}/${id}/activate`, {});
  }

  assignAdvisor(processId: string, advisorId: string): Observable<DegreeProcess> {
    return this.http.patch<DegreeProcess>(`${this.apiUrl}/${processId}/assign-advisor`, { advisorUserId: advisorId });
  }

  finalizeProcess(processId: string): Observable<DegreeProcess> {
    return this.http.patch<DegreeProcess>(`${this.apiUrl}/${processId}/finalize`, {});
  }

  deleteProcess(processId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${processId}`);
  }

  // Modalities
  getModalities(): Observable<DegreeModality[]> {
    return this.http.get<DegreeModality[]>(`${this.apiUrl}/modalities`);
  }

  getModalityById(id: string): Observable<DegreeModality> {
    return this.http.get<DegreeModality>(`${this.apiUrl}/modalities/${id}`);
  }

  downloadModalityResource(modalityId: string, resourceId: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/admin/modalities/${modalityId}/resources/${resourceId}/download`, {
      responseType: 'blob'
    });
  }

  // Requirements
  getRequirements(processId: string): Observable<RequirementInstance[]> {
    return this.http.get<RequirementInstance[]>(`${environment.apiUrl}/documents/process/${processId}/requirements`);
  }

  // Available advisors
  getAvailableAdvisors(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/users/advisors/available`);
  }

  // My processes (student)
  getMyProcesses(): Observable<DegreeProcess[]> {
    return this.http.get<DegreeProcess[]>(`${this.apiUrl}/my-processes`);
  }
}
