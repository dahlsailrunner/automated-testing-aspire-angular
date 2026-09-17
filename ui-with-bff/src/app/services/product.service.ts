import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NewProduct, Product } from '../core/models';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  getProducts(category = 'all'): Promise<Product[]> {
    return firstValueFrom(this.http.get<Product[]>('/api/Product', { params: { category } }));
  }

  getProduct(id: number): Promise<Product> {
    return firstValueFrom(this.http.get<Product>(`/api/Product/${id}`));
  }

  addProduct(product: NewProduct): Promise<Product> {
    return firstValueFrom(this.http.post<Product>('/api/Product', product));
  }

  updateProduct(id: number, product: NewProduct): Promise<Product> {
    return firstValueFrom(this.http.put<Product>(`/api/Product/${id}`, product));
  }

  deleteProduct(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/Product/${id}`));
  }
}
