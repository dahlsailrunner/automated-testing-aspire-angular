import { CurrencyPipe } from '@angular/common';
import { Component, ElementRef, ViewChild, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { marked } from 'marked';
import { Product } from '../../core/models';
import { CartService } from '../../services/cart.service';
import { ChatService, ChatTurn } from '../../services/chat.service';
import { ProductService } from '../../services/product.service';

interface DisplayMessage {
  role: 'user' | 'assistant';
  html: string;
  time: string;
}

@Component({
  selector: 'app-listing',
  imports: [
    CurrencyPipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './listing.html',
  styleUrl: './listing.scss',
})
export class Listing {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly chatService = inject(ChatService);

  private readonly queryParams = toSignal(this.route.queryParamMap);

  readonly products = signal<Product[]>([]);
  readonly categoryName = signal('');
  readonly loading = signal(true);

  readonly chatMessages = signal<DisplayMessage[]>([
    {
      role: 'assistant',
      html: "Hi! Tell me what you're looking for and I'll recommend up to 3 products.",
      time: new Date().toLocaleTimeString(),
    },
  ]);
  readonly chatInput = signal('');
  readonly chatSending = signal(false);
  private chatHistory: ChatTurn[] = [];

  @ViewChild('chatMessagesEl') chatMessagesEl?: ElementRef<HTMLDivElement>;

  constructor() {
    effect(() => {
      const cat = this.queryParams()?.get('cat') ?? '';
      this.loadProducts(cat);
    });
  }

  private async loadProducts(category: string): Promise<void> {
    this.loading.set(true);
    try {
      const products = await this.productService.getProducts(category);
      this.products.set(products);
      this.categoryName.set(
        products.length > 0 ? products[0].category[0].toUpperCase() + products[0].category.slice(1) : category,
      );
    } catch {
      this.router.navigateByUrl('/error');
      return;
    } finally {
      this.loading.set(false);
    }
  }

  async addToCart(productId: number): Promise<void> {
    await this.cartService.addToCart({ productId, quantity: 1 });
  }

  async sendChat(): Promise<void> {
    const message = this.chatInput().trim();
    if (!message || this.chatSending()) return;

    this.appendMessage('user', message);
    this.chatInput.set('');
    this.chatSending.set(true);

    const thinkingIndex = this.chatMessages().length;
    this.chatMessages.update((msgs) => [
      ...msgs,
      { role: 'assistant', html: '<em>Thinking...</em>', time: new Date().toLocaleTimeString() },
    ]);

    try {
      const finalText = await this.chatService.streamChat(message, this.chatHistory, (partial) => {
        this.updateMessage(thinkingIndex, partial);
      });
      this.chatHistory.push({ role: 'user', content: message });
      if (finalText) {
        this.chatHistory.push({ role: 'assistant', content: finalText });
      }
    } catch {
      this.updateMessage(thinkingIndex, 'Sorry, something went wrong.');
    } finally {
      this.chatSending.set(false);
      await this.cartService.refreshCount();
    }
  }

  stopChat(): void {
    this.chatService.stop();
    this.chatSending.set(false);
  }

  private appendMessage(role: 'user' | 'assistant', text: string): void {
    this.chatMessages.update((msgs) => [
      ...msgs,
      { role, html: marked.parse(text) as string, time: new Date().toLocaleTimeString() },
    ]);
    this.scrollChat();
  }

  private updateMessage(index: number, text: string): void {
    this.chatMessages.update((msgs) =>
      msgs.map((m, i) => (i === index ? { ...m, html: marked.parse(text) as string } : m)),
    );
    this.scrollChat();
  }

  private scrollChat(): void {
    queueMicrotask(() => {
      const el = this.chatMessagesEl?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
