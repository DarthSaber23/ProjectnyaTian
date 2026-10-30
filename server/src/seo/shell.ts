import { Injectable } from "@nestjs/common";

export const SHELL_SOURCE = Symbol("SHELL_SOURCE");
export interface ShellSourceLike {
  get(): Promise<string>;
}

/**
 * The built index.html, fetched from the web container's internal location and kept for 60 s.
 * A failure throws; the renderer then answers 502 and nginx serves the plain index.html.
 */
@Injectable()
export class ShellSource implements ShellSourceLike {
  private cached?: { html: string; at: number };
  url = process.env.SHELL_URL ?? "http://web/__shell.html";
  ttlMs = 60_000;

  async get(): Promise<string> {
    if (this.cached && Date.now() - this.cached.at < this.ttlMs) return this.cached.html;
    const response = await fetch(this.url, { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) throw new Error(`shell ${response.status}`);
    const html = await response.text();
    this.cached = { html, at: Date.now() };
    return html;
  }
}
