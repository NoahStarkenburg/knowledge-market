import { Component } from '@angular/core';
import { LegalLayoutComponent } from './legal-layout';
import { setPageTitle } from '@core/page';

@Component({
  selector: 'app-terms-page',
  imports: [LegalLayoutComponent],
  templateUrl: './terms.page.html',
})
export class TermsPage {
  constructor() {
    setPageTitle('Terms of Service');
  }
}
