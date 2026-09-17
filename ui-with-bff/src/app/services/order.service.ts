import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NewOrder, Order } from '../core/models';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);

  placeOrder(order: NewOrder): Promise<Order> {
    return firstValueFrom(this.http.post<Order>('/api/Order', order));
  }
}
