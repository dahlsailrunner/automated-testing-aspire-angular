import { Injectable } from '@angular/core';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private controller: AbortController | null = null;

  stop(): void {
    this.controller?.abort();
    this.controller = null;
  }

  // The BFF proxies straight through to the Agent's `POST /agent` endpoint, which returns an
  // `IAsyncEnumerable<string>` - ASP.NET Core streams that as a JSON array of string chunks
  // (`["chunk1","chunk2",...]`), not text/event-stream. Chunk boundaries don't line up with the
  // array syntax, so rather than parse a valid-JSON prefix at every step, strip the array
  // punctuation as it streams by - it can never appear inside the chunk text itself, since the
  // model's own text is JSON-string-escaped within each element.
  async streamChat(message: string, history: ChatTurn[], onDelta: (fullText: string) => void): Promise<string> {
    this.controller = new AbortController();
    let buffer = '';

    const response = await fetch('/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF': '1' },
      body: JSON.stringify({ message, history }),
      signal: this.controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Chat request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        const raw = decoder.decode(result.value, { stream: true });
        const delta = raw.replace(/[[",\]]/g, '').replace(/\\n/g, '\n');
        if (buffer.length === 0 && delta.trim().length === 0) continue;
        buffer += delta;
        onDelta(buffer);
      }
    }

    this.controller = null;
    return buffer;
  }
}
