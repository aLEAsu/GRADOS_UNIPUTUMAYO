/* Archivo : auth.interceptor.fixed.ts
   Descripción : Interceptor de autenticación para manejar tokens y refresco de tokens.
   Permite agregar el token de autorización a las solicitudes HTTP y manejar errores de autenticación.*/
   
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  // Don't add Content-Type for FormData (file uploads)
  const isFormData = req.body instanceof FormData;

  let clonedReq = req;
  if (token) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`
    };
    if (!isFormData && !req.headers.has('Content-Type')) {
      headers['Content-Type'] = 'application/json';
    }
    clonedReq = req.clone({ setHeaders: headers });
  } else if (!isFormData && !req.headers.has('Content-Type')) {
    clonedReq = req.clone({
      setHeaders: { 'Content-Type': 'application/json' }
    });
  }

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/login') && !req.url.includes('/auth/refresh')) {
        if (!isRefreshing) {
          isRefreshing = true;
          return authService.refreshToken().pipe(
            switchMap(() => {
              isRefreshing = false;
              const newToken = authService.getToken();
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` }
              });
              return next(retryReq);
            }),
            catchError(refreshError => {
              isRefreshing = false;
              authService.logout();
              return throwError(() => refreshError);
            })
          );
        }
      }
      return throwError(() => error);
    })
  );
};
