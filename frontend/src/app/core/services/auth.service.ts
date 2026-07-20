import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, BehaviorSubject } from 'rxjs';
import { environment } from '@environments/environment';
import { LoginResponse } from '../models/api-response.model';
import { User, UserRole, JwtPayload } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private currentUserSignal = signal<JwtPayload | null>(null);
  private currentFullUserSignal = signal<any | null>(null);
  private tokenRefreshTimer: any;

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly currentFullUser = this.currentFullUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.currentUserSignal());
  readonly userRole = computed(() => this.currentUserSignal()?.role ?? null);

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadStoredUser();
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(response => this.handleAuthResponse(response)),
      catchError(error => {
        console.error('Login error:', error);
        return throwError(() => error);
      })
    );
  }

  register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    studentCode: string;
    program: string;
    acceptPolicy: boolean;
  }): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/register`, data);
  }

  refreshToken(): Observable<{ accessToken: string; refreshToken: string }> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token'));
    }
    return this.http.post<{ accessToken: string; refreshToken: string }>(
      `${this.apiUrl}/refresh`,
      { refreshToken }
    ).pipe(
      tap(response => {
        localStorage.setItem('token', response.accessToken);
        localStorage.setItem('refreshToken', response.refreshToken);
        this.scheduleTokenRefresh();
      }),
      catchError(error => {
        this.logout();
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    const token = localStorage.getItem('token');
    if (token) {
      this.http.post(`${this.apiUrl}/logout`, {}).subscribe({ error: () => {} });
    }
    this.clearAuth();
    this.router.navigate(['/auth/login']);
  }

  getProfile(): Observable<JwtPayload> {
    return this.http.get<JwtPayload>(`${this.apiUrl}/profile`);
  }

  /**
   * Get full current user profile (includes phone, studentProfile, advisorProfile, etc)
   */
  getMyFullProfile(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/users/me`).pipe(
      tap(user => this.currentFullUserSignal.set(user))
    );
  }

  googleLogin(): void {
    window.location.href = `${environment.apiUrl}/auth/google`;
  }

  handleGoogleCallback(accessToken: string, refreshToken: string): void {
    localStorage.setItem('token', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    const payload = this.decodeToken(accessToken);
    if (payload) {
      this.currentUserSignal.set(payload);
      this.scheduleTokenRefresh();
      // load full profile so the app can create any onboarding notifications or UI updates
      this.getMyFullProfile().subscribe({ error: () => {} });
    }
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  hasRole(...roles: UserRole[]): boolean {
    const user = this.currentUserSignal();
    return user ? roles.includes(user.role) : false;
  }

  isStudent(): boolean {
    return this.hasRole(UserRole.STUDENT);
  }

  isAdvisor(): boolean {
    return this.hasRole(UserRole.ADVISOR);
  }

  isSecretary(): boolean {
    return this.hasRole(UserRole.SECRETARY);
  }

  isAdmin(): boolean {
    return this.hasRole(UserRole.ADMIN, UserRole.SUPERADMIN);
  }

  private handleAuthResponse(response: LoginResponse): void {
    localStorage.setItem('token', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('user', JSON.stringify(response.user));

    const payload = this.decodeToken(response.accessToken);
    if (payload) {
      this.currentUserSignal.set(payload);
      this.scheduleTokenRefresh();
      // populate full profile for UI checks
      this.getMyFullProfile().subscribe({ error: () => {} });
    }
  }

  private loadStoredUser(): void {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = this.decodeToken(token);
      if (payload && !this.isTokenExpired(payload)) {
        this.currentUserSignal.set(payload);
        this.scheduleTokenRefresh();
        // try to load full profile for completeness checks
        this.getMyFullProfile().subscribe({ error: () => {} });
      } else {
        this.clearAuth();
      }
    }
  }

  private decodeToken(token: string): JwtPayload | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      return payload as JwtPayload;
    } catch {
      return null;
    }
  }

  private isTokenExpired(payload: JwtPayload): boolean {
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  }

  private scheduleTokenRefresh(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }
    const token = localStorage.getItem('token');
    if (!token) return;

    const payload = this.decodeToken(token);
    if (!payload?.exp) return;

    // Refresh 5 minutes before expiration
    const expiresIn = payload.exp * 1000 - Date.now();
    const refreshIn = Math.max(expiresIn - 5 * 60 * 1000, 0);

    this.tokenRefreshTimer = setTimeout(() => {
      this.refreshToken().subscribe();
    }, refreshIn);
  }

  private clearAuth(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    this.currentUserSignal.set(null);
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }
  }
}
