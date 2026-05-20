import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';

export interface StudentSyncResponse {
  studentCode: string;
  program: string;
  faculty: string;
  semester: number;
  academicStatus: string;
  hasCompletedSubjects: boolean;
  externalStudentId?: string;
  lastSyncAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class IntegrationService {
  private baseUrl = `${environment.apiUrl}/integration`;

  constructor(private http: HttpClient) {}

  // Admin-only: trigger sync for a specific userId
  syncStudentProfile(userId: string): Observable<StudentSyncResponse> {
    return this.http.post<StudentSyncResponse>(`${this.baseUrl}/sync-student/${userId}`, {});
  }

  // Admin-only: validate eligibility by student code
  validateStudentEligibility(studentCode: string): Observable<{ eligible: boolean; reason?: string }> {
    return this.http.get<{ eligible: boolean; reason?: string }>(`${this.baseUrl}/student-eligibility/${encodeURIComponent(studentCode)}`);
  }
}
