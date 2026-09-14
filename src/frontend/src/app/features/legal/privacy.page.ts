import { Component } from '@angular/core';
import { LegalLayoutComponent } from './legal-layout';
import { setPageTitle } from '@core/page';

@Component({
  selector: 'app-privacy-page',
  imports: [LegalLayoutComponent],
  templateUrl: './privacy.page.html',
})
export class PrivacyPage {
  constructor() {
    setPageTitle('Privacy Policy');
  }
}
