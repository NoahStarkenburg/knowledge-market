import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LucideAngularModule, Youtube } from 'lucide-angular';

const YT_SPLIT = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+|youtube\.com\/embed\/[\w-]+|youtube\.com\/results\?search_query=[^\s)]+))/g;

function ytEmbedId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
  return m ? m[1] : null;
}

type Block =
  | { kind: 'youtube'; url: string; embed: SafeResourceUrl | null; query: string }
  | { kind: 'para'; text: string };

// Renders lesson body text: YouTube links become embeds (or a link card), everything else
// becomes paragraphs.
@Component({
  selector: 'app-lesson-prose',
  imports: [LucideAngularModule],
  templateUrl: './lesson-prose.html',
})
export class LessonProseComponent {
  private readonly sanitizer = inject(DomSanitizer);
  readonly youtube = Youtube;
  text = input('');

  readonly blocks = computed<Block[]>(() => {
    const parts = this.text().split(YT_SPLIT);
    const out: Block[] = [];
    for (const part of parts) {
      if (!part) continue;
      if (part.startsWith('http') && /youtube\.com|youtu\.be/.test(part)) {
        const url = part.trim();
        const id = ytEmbedId(url);
        const embed = id ? this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube-nocookie.com/embed/${id}`) : null;
        const qm = url.match(/search_query=([^\s)]+)/);
        const query = qm ? decodeURIComponent(qm[1].replace(/\+/g, ' ')) : 'Open video';
        out.push({ kind: 'youtube', url, embed, query });
      } else {
        for (const para of part.split(/\n\n+/)) {
          const t = para.trim();
          if (t) out.push({ kind: 'para', text: t });
        }
      }
    }
    return out;
  });
}
