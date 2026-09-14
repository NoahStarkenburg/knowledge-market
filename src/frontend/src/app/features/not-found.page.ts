import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonComponent, EyebrowComponent } from '@shared/ui';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, ButtonComponent, EyebrowComponent],
  template: `
    <div class="max-w-[1320px] mx-auto px-5 sm:px-6 py-24 text-center">
      <app-eyebrow class="text-cobalt">Error 404</app-eyebrow>
      <h1 class="font-display text-[clamp(3rem,12vw,7rem)] font-black uppercase leading-[0.9] mt-4 mb-6">Not found</h1>
      <p class="text-ink-mute text-[16px] max-w-md mx-auto mb-8">The page you're looking for doesn't exist or has moved.</p>
      <a routerLink="/courses"><button appButton size="lg">Back to catalog</button></a>
    </div>
  `,
})
export class NotFoundPage {}
