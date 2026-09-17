import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

interface BffClaim {
  type: string;
  value: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly claims = signal<BffClaim[]>([]);
  private readonly loaded = signal(false);

  readonly isAuthenticated = computed(() => this.claims().length > 0);
  // Duende BFF serializes the raw .NET claim type URI (ClaimTypes.Role), not a short "role" string.
  readonly isAdmin = computed(() =>
    this.claims().some(
      (c) => (c.type === 'role' || c.type.endsWith('/role')) && c.value === 'admin',
    ),
  );
  readonly email = computed(() => this.claims().find((c) => c.type === 'email')?.value ?? '');
  readonly isLoaded = computed(() => this.loaded());

  private logoutUrl = '/bff/logout';

  async initialize(): Promise<void> {
    try {
      const claims = await firstValueFrom(this.http.get<BffClaim[]>('/bff/user'));
      this.claims.set(claims ?? []);
      const logout = claims?.find((c) => c.type === 'bff:logout_url')?.value;
      if (logout) {
        this.logoutUrl = logout;
      }
    } catch {
      this.claims.set([]);
    } finally {
      this.loaded.set(true);
    }
  }

  login(returnUrl: string): void {
    window.location.href = `/bff/login?returnUrl=${encodeURIComponent(returnUrl)}`;
  }

  logout(): void {
    window.location.href = this.logoutUrl;
  }
}
