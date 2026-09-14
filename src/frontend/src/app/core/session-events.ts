import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

// Decouples the HTTP layer from auth state: the interceptor calls expired() when a token
// refresh fails, and AuthService subscribes to clear the session. Using an injectable with
// a Subject (rather than a global browser event) keeps the contract typed, testable, and
// inside Angular's DI graph.
@Injectable({ providedIn: 'root' })
export class SessionEvents {
  private readonly expiredSubject = new Subject<void>();
  readonly expired$ = this.expiredSubject.asObservable();

  expired(): void {
    this.expiredSubject.next();
  }
}
