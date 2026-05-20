import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { Approval, ApprovalDecision, Observation } from '../models/degree-process.model';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly apiUrl = `${environment.apiUrl}/reviews`;

  constructor(private http: HttpClient) {}

  // Send requirement to review (Secretary)
  sendToReview(requirementInstanceId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/requirement/${requirementInstanceId}/send-to-review`, {});
  }

  // Academic approval (Advisor)
  createAcademicApproval(
    requirementInstanceId: string,
    data: { decision: ApprovalDecision; observations?: string; documentVersionId: string }
  ): Observable<Approval> {
    return this.http.post<Approval>(
      `${this.apiUrl}/requirement/${requirementInstanceId}/academic-approval`,
      data
    );
  }

  // Administrative approval (Secretary)
  createAdministrativeApproval(
    requirementInstanceId: string,
    data: { decision: ApprovalDecision; observations?: string; documentVersionId: string }
  ): Observable<Approval> {
    return this.http.post<Approval>(
      `${this.apiUrl}/requirement/${requirementInstanceId}/administrative-approval`,
      data
    );
  }

  // Get approvals for a requirement
  getRequirementApprovals(requirementInstanceId: string): Observable<Approval[]> {
    return this.http.get<Approval[]>(
      `${this.apiUrl}/requirement/${requirementInstanceId}/approvals`
    );
  }

  // Get all approvals for a process
  getProcessApprovals(processId: string): Observable<Approval[]> {
    return this.http.get<Approval[]>(`${this.apiUrl}/process/${processId}/approvals`);
  }

  // Add observation to a requirement
  addObservation(
    requirementInstanceId: string,
    data: { content: string; documentVersionId?: string }
  ): Observable<Observation> {
    return this.http.post<Observation>(
      `${this.apiUrl}/requirement/${requirementInstanceId}/observations`,
      data
    );
  }

  // Resolve an observation
  resolveObservation(observationId: string): Observable<Observation> {
    return this.http.patch<Observation>(
      `${this.apiUrl}/observations/${observationId}/resolve`,
      {}
    );
  }

  // Get pending academic reviews (Advisor)
  getPendingAcademicReviews(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/pending/academic`);
  }

  // Get pending administrative reviews (Secretary)
  getPendingAdministrativeReviews(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/pending/administrative`);
  }
}
