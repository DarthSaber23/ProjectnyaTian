import { Injectable } from "@nestjs/common";

/**
 * "Content changed" signal. Article and SEO writes call `changed()`; the page renderer subscribes to drop its
 * cached HTML. Keeps the dependency pointing one way (content does not import the renderer).
 */
@Injectable()
export class ContentEvents {
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  changed(): void {
    for (const listener of this.listeners) listener();
  }
}
