import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { CartItem } from '../../core/models';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-cart',
  imports: [CurrencyPipe, MatButtonModule, MatTableModule],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class Cart {
  private readonly cartService = inject(CartService);
  private readonly router = inject(Router);

  readonly items = signal<CartItem[]>([]);
  readonly loading = signal(true);
  readonly displayedColumns = ['name', 'category', 'price', 'quantity', 'total'];

  get grandTotal(): number {
    return this.items().reduce((sum, item) => sum + item.total, 0);
  }

  constructor() {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.items.set(await this.cartService.getCart());
    this.loading.set(false);
  }

  async clearCart(): Promise<void> {
    await this.cartService.clearCart();
    this.router.navigateByUrl('/');
  }

  checkout(): void {
    this.router.navigateByUrl('/checkout');
  }
}
