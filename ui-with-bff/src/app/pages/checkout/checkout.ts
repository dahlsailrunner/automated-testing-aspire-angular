import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/auth.service';
import { CartItem } from '../../core/models';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';

@Component({
  selector: 'app-checkout',
  imports: [CurrencyPipe, MatButtonModule],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout {
  private readonly cartService = inject(CartService);
  private readonly orderService = inject(OrderService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  readonly items = signal<CartItem[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);

  get total(): number {
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

  async submitOrder(): Promise<void> {
    this.submitting.set(true);
    try {
      await this.orderService.placeOrder({ email: this.auth.email() });
      this.router.navigateByUrl('/thank-you');
    } finally {
      this.submitting.set(false);
    }
  }

  async cancelOrder(): Promise<void> {
    await this.cartService.clearCart();
    this.router.navigateByUrl('/');
  }
}
