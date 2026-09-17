import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // /bff/user 401s for anonymous visitors as a matter of course (e.g. on the public
      // home page) - AuthService.initialize() handles that itself, so don't force a login
      // redirect here or anonymous browsing would be impossible.
      if (error.status === 401 && !req.url.startsWith('/bff/user')) {
        auth.login(router.url);
      } else if (error.status === 403) {
        router.navigateByUrl('/access-denied');
      }
      return throwError(() => error);
    }),
  );
};
