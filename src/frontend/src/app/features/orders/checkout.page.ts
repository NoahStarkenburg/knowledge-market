import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Lock, LucideAngularModule } from 'lucide-angular';
import type { Stripe, StripeElements } from '@stripe/stripe-js';
import { ApiService } from '@core/api/api.service';
import { setPageTitle } from '@core/page';
import { stripePromise } from '@core/stripe';
import type { ApiError, OrderDto } from '@core/api/types';
import { ButtonComponent, FormErrorListComponent, LoadingSpinnerComponent } from '@shared/ui';

@Component({
  selector: 'app-checkout-page',
  imports: [LucideAngularModule, ButtonComponent, FormErrorListComponent, LoadingSpinnerComponent],
  templateUrl: './checkout.page.html',
})
export class CheckoutPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly lock = Lock;

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  private readonly orderId = () => this.params().get('orderId') ?? '';

  readonly order = signal<OrderDto | null>(null);
  readonly clientSecret = signal<string | null>(null);
  readonly loadError = signal<ApiError | undefined>(undefined);
  readonly loading = signal(true);
  readonly succeeded = signal(false);
  readonly submitting = signal(false);
  readonly stripeError = signal<string | null>(null);
  readonly ready = signal(false);

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private mounted = false;
  private readonly paymentEl = viewChild<ElementRef<HTMLDivElement>>('paymentEl');

  constructor() {
    setPageTitle('Checkout');
    void this.init();
    // Mount the Stripe PaymentElement once the container and client secret exist.
    effect(() => {
      const el = this.paymentEl()?.nativeElement;
      const cs = this.clientSecret();
      if (el && cs && !this.mounted) {
        this.mounted = true;
        void this.mountStripe(el, cs);
      }
    });
  }

  private async init(): Promise<void> {
    const id = this.orderId();
    if (!id) return;
    if (this.query().get('redirect_status') === 'succeeded') this.succeeded.set(true);

    this.loading.set(true);
    this.loadError.set(undefined);
    try {
      const o = await this.api.getOrder(id);
      this.order.set(o);
      if (o.status === 'Paid') {
        this.succeeded.set(true);
        this.loading.set(false);
        return;
      }
      const { clientSecret: cs } = await this.api.checkoutOrder(id);
      if (cs === null) {
        this.succeeded.set(true);
        this.loading.set(false);
        return;
      }
      this.clientSecret.set(cs);
    } catch (err) {
      this.loadError.set(err as ApiError);
    } finally {
      this.loading.set(false);
    }
  }

  private async mountStripe(el: HTMLElement, clientSecret: string): Promise<void> {
    this.stripe = await stripePromise;
    if (!this.stripe) {
      this.stripeError.set('Payments are not configured.');
      return;
    }
    this.elements = this.stripe.elements({ clientSecret });
    const paymentElement = this.elements.create('payment');
    paymentElement.mount(el);
    this.ready.set(true);
  }

  async pay(): Promise<void> {
    if (!this.stripe || !this.elements) return;
    this.submitting.set(true);
    this.stripeError.set(null);
    const result = await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: { return_url: `${window.location.origin}/checkout/${this.orderId()}` },
      redirect: 'if_required',
    });
    if (result.error) {
      this.stripeError.set(result.error.message ?? 'Payment failed. Please try again.');
      this.submitting.set(false);
    } else if (result.paymentIntent?.status === 'succeeded') {
      this.succeeded.set(true);
    } else {
      this.stripeError.set('Unexpected payment status. Please contact support.');
      this.submitting.set(false);
    }
  }

  go(): void {
    const o = this.order();
    if (o) this.router.navigate(['/courses', o.courseId, 'lessons']);
  }
  backToOrders(): void {
    this.router.navigate(['/settings/orders']);
  }
}
