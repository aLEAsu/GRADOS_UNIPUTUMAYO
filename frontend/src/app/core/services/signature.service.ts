import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SignatureService {
  private readonly apiUrl = `${environment.apiUrl}/signatures`;

  constructor(private http: HttpClient) {}

  // =============================================
  // SIGNATURE IMAGES
  // =============================================

  getAllSignatureImages(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/images`);
  }

  getSignatureImageById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/images/${id}`);
  }

  createSignatureImage(userId: string, label: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    formData.append('label', label);
    return this.http.post<any>(`${this.apiUrl}/images`, formData);
  }

  updateSignatureImage(id: string, data: { label?: string; isActive?: boolean }, file?: File): Observable<any> {
    const formData = new FormData();
    if (file) formData.append('file', file);
    if (data.label !== undefined) formData.append('label', data.label);
    if (data.isActive !== undefined) formData.append('isActive', String(data.isActive));
    return this.http.put<any>(`${this.apiUrl}/images/${id}`, formData);
  }

  deleteSignatureImage(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/images/${id}`);
  }

  getSignatureImageFileUrl(id: string): string {
    return `${this.apiUrl}/images/${id}/file`;
  }

  // =============================================
  // SIGNATURE CONFIGS
  // =============================================

  getAllSignatureConfigs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/configs`);
  }

  getSignatureConfigsByDocumentType(documentTypeId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/configs/document-type/${documentTypeId}`);
  }

  createSignatureConfig(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/configs`, data);
  }

  updateSignatureConfig(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/configs/${id}`, data);
  }

  deleteSignatureConfig(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/configs/${id}`);
  }

  // =============================================
  // PROCESS SIGNING
  // =============================================

  getProcessesReadyForSigning(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/processes/ready`);
  }

  signProcess(processId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/processes/sign`, { processId });
  }

  signSingleRequirement(processId: string, requirementInstanceId: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/processes/${processId}/requirements/${requirementInstanceId}/sign`,
      {},
    );
  }

  signAllReadyProcesses(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/processes/sign-all`, {});
  }

  validateProcessConfigs(processId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/processes/${processId}/validate`);
  }

  // =============================================
  // SIGNED DOCUMENT DOWNLOAD
  // =============================================

  downloadSignedDocument(requirementInstanceId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download/${requirementInstanceId}`, {
      responseType: 'blob',
    });
  }

  // =============================================
  // PAGINATED PROCESSES
  // =============================================

  getProcessesReadyPaginated(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): Observable<any> {
    const queryParams: any = {};
    if (params.page) queryParams.page = params.page;
    if (params.limit) queryParams.limit = params.limit;
    if (params.search) queryParams.search = params.search;
    return this.http.get<any>(`${this.apiUrl}/processes/ready/paginated`, { params: queryParams });
  }

  // =============================================
  // AUDIT LOGS
  // =============================================

  getAuditLogs(params?: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
  }): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/audit-logs`, { params: params as any });
  }

  // =============================================
  // ARCHIVE
  // =============================================

  archiveProcess(processId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/processes/${processId}/archive`, {});
  }

  archiveCompletedProcesses(daysOld: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/processes/archive-bulk`, { daysOld });
  }

  // =============================================
  // UNSIGN / REVERT
  // =============================================

  unsignRequirement(processId: string, requirementInstanceId: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/processes/${processId}/requirements/${requirementInstanceId}/unsign`,
      {},
    );
  }

  // =============================================
  // EXISTING / LEGACY
  // =============================================

  getSignaturesByProcess(processId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/process/${processId}`);
  }

  getSignaturesByRequirement(requirementInstanceId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/requirement/${requirementInstanceId}`);
  }
}
