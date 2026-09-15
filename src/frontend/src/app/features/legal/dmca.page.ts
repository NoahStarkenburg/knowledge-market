import { Component } from '@angular/core';
import { LegalLayoutComponent } from './legal-layout';
import { setPageTitle } from '@core/page';

@Component({
  selector: 'app-dmca-page',
  imports: [LegalLayoutComponent],
  templateUrl: './dmca.page.html',
})
export class DmcaPage {
  constructor() {
    setPageTitle('DMCA');
  }
}
