import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { adminGuard, authGuard } from './auth.guards';
import { AuthService } from './auth.service';

describe('route guards', () => {
  const isAuthenticated = signal(false);
  const isAdmin = signal(false);

  beforeEach(() => {
    isAuthenticated.set(false);
    isAdmin.set(false);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { isAuthenticated, isAdmin } }],
    });
  });

  function run(guard: typeof authGuard): string | boolean {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : (result as boolean);
  }

  it('authGuard sends a signed-out visitor to /login', () => {
    expect(run(authGuard)).toBe('/login');
  });

  it('authGuard lets a signed-in user through', () => {
    isAuthenticated.set(true);
    expect(run(authGuard)).toBe(true);
  });

  it('adminGuard sends a signed-out visitor to /login', () => {
    expect(run(adminGuard)).toBe('/login');
  });

  it('adminGuard sends a signed-in non-admin to /courses', () => {
    isAuthenticated.set(true);
    expect(run(adminGuard)).toBe('/courses');
  });

  it('adminGuard lets an admin through', () => {
    isAuthenticated.set(true);
    isAdmin.set(true);
    expect(run(adminGuard)).toBe(true);
  });
});
