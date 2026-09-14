import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth.service';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let auth: { isAuthenticated: ReturnType<typeof signal<boolean>>; login: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    auth = { isAuthenticated: signal(false), login: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ApiService, useValue: { googleSignInUrl: () => '/api/auth/google/start' } },
      ],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  function render() {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    return fixture;
  }

  it('signs in with the entered credentials and goes to the catalog', async () => {
    auth.login.mockResolvedValue({ success: true });
    const page = render().componentInstance;
    page.email.set('learner@example.com');
    page.password.set('Password123!');

    await page.submit();

    expect(auth.login).toHaveBeenCalledWith('learner@example.com', 'Password123!');
    expect(navigate).toHaveBeenCalledWith(['/courses']);
    expect(page.loading()).toBe(false);
  });

  it('keeps the user on the page and shows the error when sign-in fails', async () => {
    auth.login.mockResolvedValue({ success: false, error: { status: 401, detail: 'Invalid credentials' } });
    const fixture = render();
    const page = fixture.componentInstance;

    await page.submit();
    fixture.detectChanges();

    expect(navigate).not.toHaveBeenCalled();
    expect(page.error()).toEqual({ status: 401, detail: 'Invalid credentials' });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Invalid credentials');
  });

  it('disables the submit button while signing in', async () => {
    let finish!: (v: { success: boolean }) => void;
    auth.login.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const fixture = render();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button[type=submit]') as HTMLButtonElement;

    const pending = fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(button.disabled).toBe(true);

    finish({ success: true });
    await pending;
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
  });

  it('redirects a user who is already signed in', () => {
    auth.isAuthenticated.set(true);
    render();
    expect(navigate).toHaveBeenCalledWith(['/courses']);
  });
});
