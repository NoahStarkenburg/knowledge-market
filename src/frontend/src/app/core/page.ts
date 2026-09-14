import { inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const SUFFIX = 'KnowledgeMarket';

// Sets the browser tab title via the Title service. Must run in an injection context
// (a component constructor), since it resolves Title with inject().
export function setPageTitle(title?: string | null): void {
  const t = inject(Title);
  t.setTitle(title && title.trim().length > 0 ? `${title} · ${SUFFIX}` : SUFFIX);
}

export interface MetaTags {
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string;
}

// Sets description / OpenGraph meta tags via the Meta service. Must run in an injection
// context (a component constructor).
export function setMetaTags(tags: MetaTags): void {
  const meta = inject(Meta);
  if (tags.description) meta.updateTag({ name: 'description', content: tags.description });
  if (tags.ogTitle) meta.updateTag({ property: 'og:title', content: tags.ogTitle });
  if (tags.ogDescription) meta.updateTag({ property: 'og:description', content: tags.ogDescription });
  if (tags.ogType) meta.updateTag({ property: 'og:type', content: tags.ogType });
}
