import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { User } from '../models/user.model';
import { DegreeModality, DocumentType } from '../models/degree-process.model';
import { DashboardStats, PaginatedResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly apiUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  // Dashboard
  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.apiUrl}/dashboard`);
  }

  // Users
  getUsers(params?: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
  }): Observable<PaginatedResponse<User>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }
    return this.http.get<PaginatedResponse<User>>(`${this.apiUrl}/users`, { params: httpParams });
  }

  getUserById(id: string): Observable<User> {
    // The users detail endpoint lives under /users/:id (not /admin/users/:id)
    return this.http.get<User>(`${environment.apiUrl}/users/${id}`);
  }

  updateUser(id: string, data: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/users/${id}`, data);
  }

  toggleUserActive(id: string): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/users/${id}/toggle-active`, {});
  }

  // Modalities
  getModalities(): Observable<DegreeModality[]> {
    return this.http.get<DegreeModality[]>(`${this.apiUrl}/modalities`);
  }

  createModality(data: Partial<DegreeModality>): Observable<DegreeModality> {
    return this.http.post<DegreeModality>(`${this.apiUrl}/modalities`, data);
  }

  updateModality(id: string, data: Partial<DegreeModality>): Observable<DegreeModality> {
    return this.http.patch<DegreeModality>(`${this.apiUrl}/modalities/${id}`, data);
  }

  // Document Types
  getDocumentTypes(): Observable<DocumentType[]> {
    return this.http.get<DocumentType[]>(`${this.apiUrl}/document-types`);
  }

  createDocumentType(data: Partial<DocumentType>): Observable<DocumentType> {
    return this.http.post<DocumentType>(`${this.apiUrl}/document-types`, data);
  }

  updateDocumentType(id: string, data: Partial<DocumentType>): Observable<DocumentType> {
    return this.http.patch<DocumentType>(`${this.apiUrl}/document-types/${id}`, data);
  }

  // Modality Requirements
  addRequirementToModality(modalityId: string, data: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/modalities/${modalityId}/requirements`, data);
  }

  updateRequirement(modalityId: string, requirementId: string, data: FormData): Observable<any> {
    return this.http.patch(`${this.apiUrl}/modalities/${modalityId}/requirements/${requirementId}`, data);
  }

  removeRequirementFromModality(modalityId: string, requirementId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/modalities/${modalityId}/requirements/${requirementId}`);
  }

  // User role management
  changeUserRole(userId: string, role: string): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/users/${userId}/role`, { role });
  }

  // Audit
  getAuditEvents(params?: {
    page?: number;
    limit?: number;
    action?: string;
    userId?: string;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }
    return this.http.get(`${environment.apiUrl}/audit`, { params: httpParams });
  }

  getAuditEventsForEntity(entity: string, entityId: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/audit/entity/${entity}/${entityId}`);
  }

  exportAuditLog(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/audit/export`);
  }

  // System health
  getHealthCheck(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`);
  }
}
