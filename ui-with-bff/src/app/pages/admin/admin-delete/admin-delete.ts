import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { Product } from '../../../core/models';
import { ProductService } from '../../../services/product.service';

@Component({
  selector: 'app-admin-delete',
  imports: [CurrencyPipe, RouterLink, MatButtonModule],
  templateUrl: './admin-delete.html',
})
export class AdminDelete {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);

  readonly product = signal<Product | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  constructor() {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.product.set(await this.productService.getProduct(this.id));
    this.loading.set(false);
  }

  async confirmDelete(): Promise<void> {
    try {
      await this.productService.deleteProduct(this.id);
      this.router.navigateByUrl('/admin');
    } catch {
      this.error.set('Unable to delete this product.');
    }
  }
}
