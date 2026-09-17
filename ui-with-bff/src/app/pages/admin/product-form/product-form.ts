import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CATEGORIES } from '../../../core/models';
import { ProductService } from '../../../services/product.service';

@Component({
  selector: 'app-product-form',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './product-form.html',
  styleUrl: './product-form.scss',
})
export class ProductForm {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);

  readonly categories = CATEGORIES;
  readonly productId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly serverError = signal('');

  readonly form = this.fb.nonNullable.group({
    Name: ['', [Validators.required, Validators.maxLength(50)]],
    Category: ['', Validators.required],
    Price: [0, [Validators.required, Validators.min(0.01)]],
    Description: ['', [Validators.required, Validators.maxLength(150)]],
    ImgUrl: ['', Validators.required],
  });

  get isEdit(): boolean {
    return this.productId() !== null;
  }

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.productId.set(id);
      this.loading.set(true);
      this.productService.getProduct(id).then((product) => {
        this.form.patchValue({
          Name: product.name,
          Category: product.category,
          Price: product.price,
          Description: product.description,
          ImgUrl: product.imgUrl,
        });
        this.loading.set(false);
      });
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.serverError.set('');
    const value = this.form.getRawValue();
    const newProduct = {
      name: value.Name,
      category: value.Category,
      price: value.Price,
      description: value.Description,
      imgUrl: value.ImgUrl,
    };

    try {
      const id = this.productId();
      if (id !== null) {
        await this.productService.updateProduct(id, newProduct);
      } else {
        await this.productService.addProduct(newProduct);
      }
      this.router.navigateByUrl('/admin');
    } catch (err) {
      this.applyServerErrors(err);
    } finally {
      this.submitting.set(false);
    }
  }

  private applyServerErrors(err: unknown): void {
    if (!(err instanceof HttpErrorResponse) || err.status !== 400) {
      this.serverError.set('An unexpected error occurred while saving the product.');
      return;
    }

    const body = err.error as Record<string, string>;
    let mapped = false;
    for (const key of Object.keys(this.form.controls)) {
      const message = body?.[key];
      if (message) {
        this.form.get(key)?.setErrors({ server: message });
        mapped = true;
      }
    }
    if (!mapped) {
      this.serverError.set(body?.['detail'] ?? 'Validation failed.');
    }
  }
}
