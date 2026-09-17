import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'listing',
    loadComponent: () => import('./pages/listing/listing').then((m) => m.Listing),
    canActivate: [authGuard],
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart').then((m) => m.Cart),
    canActivate: [authGuard],
  },
  {
    path: 'checkout',
    loadComponent: () => import('./pages/checkout/checkout').then((m) => m.Checkout),
    canActivate: [authGuard],
  },
  {
    path: 'thank-you',
    loadComponent: () => import('./pages/thank-you/thank-you').then((m) => m.ThankYou),
    canActivate: [authGuard],
  },
  {
    path: 'current-promotion',
    loadComponent: () =>
      import('./pages/current-promotion/current-promotion').then((m) => m.CurrentPromotion),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin-list/admin-list').then((m) => m.AdminList),
    canActivate: [adminGuard],
  },
  {
    path: 'admin/create',
    loadComponent: () =>
      import('./pages/admin/product-form/product-form').then((m) => m.ProductForm),
    canActivate: [adminGuard],
  },
  {
    path: 'admin/edit/:id',
    loadComponent: () =>
      import('./pages/admin/product-form/product-form').then((m) => m.ProductForm),
    canActivate: [adminGuard],
  },
  {
    path: 'admin/delete/:id',
    loadComponent: () =>
      import('./pages/admin/admin-delete/admin-delete').then((m) => m.AdminDelete),
    canActivate: [adminGuard],
  },
  {
    path: 'error',
    loadComponent: () => import('./pages/error-page/error-page').then((m) => m.ErrorPage),
  },
  {
    path: 'access-denied',
    loadComponent: () =>
      import('./pages/access-denied/access-denied').then((m) => m.AccessDenied),
  },
  {
    path: '**',
    loadComponent: () => import('./pages/error-page/error-page').then((m) => m.ErrorPage),
  },
];
