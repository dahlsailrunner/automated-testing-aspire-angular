import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AddToCart, CartItem } from '../core/models';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);

  // Nav badge count, refreshed after every cart mutation (including chat-driven ones).
  readonly itemCount = signal(0);

  async getCart(): Promise<CartItem[]> {
    return firstValueFrom(this.http.get<CartItem[]>('/api/Cart'));
  }

  async refreshCount(): Promise<void> {
    const count = await firstValueFrom(this.http.get<number>('/api/Cart/count'));
    this.itemCount.set(count);
  }

  async addToCart(item: AddToCart): Promise<void> {
    await firstValueFrom(this.http.post<void>('/api/Cart', item));
    await this.refreshCount();
  }

  async clearCart(): Promise<void> {
    await firstValueFrom(this.http.delete<void>('/api/Cart'));
    await this.refreshCount();
  }
}
