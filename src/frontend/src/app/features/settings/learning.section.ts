import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EnrolledCoursesStore } from '@core/enrolled-courses.store';
import { EnrolledCourseCardComponent } from './enrolled-course-card';
import { FormErrorListComponent, LoadingSpinnerComponent } from '@shared/ui';

@Component({
  selector: 'app-learning-section',
  imports: [RouterLink, EnrolledCourseCardComponent, FormErrorListComponent, LoadingSpinnerComponent],
  providers: [EnrolledCoursesStore],
  templateUrl: './learning.section.html',
})
export class LearningSection implements OnInit {
  protected readonly store = inject(EnrolledCoursesStore);
  ngOnInit(): void {
    void this.store.reload();
  }
}
