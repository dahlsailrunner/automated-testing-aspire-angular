import { HttpInterceptorFn } from '@angular/common/http';

// Duende BFF requires this header on same-site XHR/fetch calls to its proxied
// remote APIs as CSRF protection (browsers won't attach it on cross-site requests).
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const reqWithCsrf = req.clone({ setHeaders: { 'X-CSRF': '1' } });
  return next(reqWithCsrf);
};
