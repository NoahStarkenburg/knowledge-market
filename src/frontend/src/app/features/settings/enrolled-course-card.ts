import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/api/api.service';
import type { EnrolledCourseProgress } from '@core/api/types';

const THUMB_TONES = ['bg-cobalt', 'bg-ink', 'bg-cobalt-deep', 'bg-[#1f7a3d]', 'bg-[#7a3b12]', 'bg-[#5b2d82]'];

@Component({
  selector: 'app-enrolled-course-card',
  imports: [RouterLink],
  templateUrl: './enrolled-course-card.html',
})
export class EnrolledCourseCardComponent {
  protected readonly api = inject(ApiService);
  entry = input.required<EnrolledCourseProgress>();
  readonly course = computed(() => this.entry().course);
  readonly tone = computed(() => {
    const id = this.course().id;
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    return THUMB_TONES[Math.abs(hash) % THUMB_TONES.length];
  });
}
