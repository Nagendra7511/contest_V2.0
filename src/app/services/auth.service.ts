import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isLoggedIn = new BehaviorSubject<boolean>(false);
  isLoggedIn$ = this.isLoggedIn.asObservable();
  private userId: string | null = null;

  private isProfileComplete = new BehaviorSubject<boolean>(false);
  isProfileComplete$ = this.isProfileComplete.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: any) {
    if (isPlatformBrowser(this.platformId)) {
      this.isLoggedIn.next(this.getStoredLoginStatus());
      this.userId = localStorage.getItem('userId');
      this.isProfileComplete.next(this.getStoredProfileCompletion());
    }
  }

  private getStoredLoginStatus(): boolean {
    return isPlatformBrowser(this.platformId) && localStorage.getItem('isLoggedIn') === 'true';
  }

  private getStoredProfileCompletion(): boolean {
    return isPlatformBrowser(this.platformId) && localStorage.getItem('isProfileComplete') === 'true';
  }

  setLoggedIn(status: boolean, userId: string) {
    this.isLoggedIn.next(status);
    this.userId = userId;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('isLoggedIn', String(status));
      localStorage.setItem('userId', userId);
    }
  }

  getUserId(): string | null {
    return this.userId;
  }

  setProfileComplete(status: boolean) {
    this.isProfileComplete.next(status);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('isProfileComplete', String(status));
    }
  }

  logout() {
    this.isLoggedIn.next(false);
    this.isProfileComplete.next(false);
    this.userId = null;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userId');
      localStorage.removeItem('isProfileComplete');
    }
  }
}
