import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscription, tap, map, interval, switchMap } from 'rxjs';
import { environment } from '@environments/environment';
import { Notification } from '../models/notification.model';

interface PaginatedResponse {
  data: Notification[];
  total?: number;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly apiUrl = `${environment.apiUrl}/notifications`;
  private notificationsSignal = signal<Notification[]>([]);

  readonly notifications = this.notificationsSignal.asReadonly();
  readonly unreadCount = computed(() => {
    const list = this.notificationsSignal();
    return Array.isArray(list) ? list.filter(n => !n.isRead).length : 0;
  });

  constructor(private http: HttpClient) {}

  loadNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[] | PaginatedResponse>(this.apiUrl).pipe(
      map(response => Array.isArray(response) ? response : (response?.data ?? [])),
      tap(notifications => this.notificationsSignal.set(notifications))
    );
  }

  /** Create a notification for the current authenticated user */
  createNotification(payload: { type: string; title: string; message: string; metadata?: Record<string, any> }) {
    return this.http.post<any>(this.apiUrl, payload).pipe(
      tap(() => this.loadNotifications().subscribe({ error: () => {} }))
    );
  }

  markAsRead(id: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/read`, {}).pipe(
      tap(() => {
        this.notificationsSignal.update(notifications =>
          notifications.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
      })
    );
  }

  markAllAsRead(): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/read-all`, {}).pipe(
      tap(() => {
        this.notificationsSignal.update(notifications =>
          notifications.map(n => ({ ...n, isRead: true }))
        );
      })
    );
  }

  deleteNotification(id: string) {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        this.notificationsSignal.update(notifications => notifications.filter(n => n.id !== id));
      })
    );
  }

  deleteAllNotifications() {
    return this.http.delete<any>(`${this.apiUrl}`).pipe(
      tap(() => {
        this.notificationsSignal.set([]);
      })
    );
  }

  startPolling(intervalMs = 30000): Subscription {
    return interval(intervalMs).pipe(
      switchMap(() => this.loadNotifications())
    ).subscribe({ error: () => {} });
  }
}
