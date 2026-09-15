import { Component } from '@angular/core';

@Component({
  selector: 'app-table',
  template: '<table class="min-w-full border-2 border-ink text-[14px]"><ng-content /></table>',
})
export class TableComponent {}
