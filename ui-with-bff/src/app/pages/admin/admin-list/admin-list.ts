import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { Product } from '../../../core/models';
import { ProductService } from '../../../services/product.service';

@Component({
  selector: 'app-admin-list',
  imports: [CurrencyPipe, RouterLink, MatButtonModule, MatTableModule],
  templateUrl: './admin-list.html',
  styleUrl: './admin-list.scss',
})
export class AdminList {
  private readonly productService = inject(ProductService);

  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly displayedColumns = ['id', 'name', 'category', 'description', 'price', 'actions'];

  constructor() {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.products.set(await this.productService.getProducts('all'));
    this.loading.set(false);
  }
}
