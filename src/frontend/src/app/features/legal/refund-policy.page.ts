import { Component } from '@angular/core';
import { LegalLayoutComponent } from './legal-layout';
import { setPageTitle } from '@core/page';

@Component({
  selector: 'app-refund-policy-page',
  imports: [LegalLayoutComponent],
  templateUrl: './refund-policy.page.html',
})
export class RefundPolicyPage {
  constructor() {
    setPageTitle('Refund Policy');
  }
}
