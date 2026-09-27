import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '@core/api/api.service';
import { CheckoutPage } from './checkout.page';

describe('CheckoutPage', () => {
  beforeEach(async () => {
    const api = {
      getOrder: vi.fn().mockResolvedValue({
        id: 'order-1', buyerId: 'u1', courseId: 'c1', courseTitle: 'Azure 101',
        priceAmount: 19, priceCurrency: 'USD', status: 'Pending', createdAt: '', paidAt: null,
      }),
      checkoutOrder: vi.fn().mockResolvedValue({ clientSecret: 'pi_1_secret_2' }),
    };
    await TestBed.configureTestingModule({
      imports: [CheckoutPage],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ orderId: 'order-1' })), queryParamMap: of(convertToParamMap({})) },
        },
      ],
    }).compileComponents();
  });

  it('pays in place when the form is submitted instead of reloading the page', async () => {
    const fixture = TestBed.createComponent(CheckoutPage);
    const form = await vi.waitFor(() => {
      fixture.detectChanges();
      const f = (fixture.nativeElement as HTMLElement).querySelector('form');
      if (!f) throw new Error('checkout form not rendered yet');
      return f;
    });
    const pay = vi.spyOn(fixture.componentInstance, 'pay').mockResolvedValue();

    const submit = new Event('submit', { cancelable: true });
    form.dispatchEvent(submit);

    expect(pay).toHaveBeenCalled();
    expect(submit.defaultPrevented).toBe(true);
  });
});
