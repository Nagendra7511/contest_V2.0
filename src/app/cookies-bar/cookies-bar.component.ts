import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';

@Component({
  selector: 'app-cookies-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cookies-bar.component.html',
  styleUrl: './cookies-bar.component.css'
})
export class CookiesBarComponent implements OnInit {
  showBar = false;
  isBrowser = false;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (this.isBrowser) {
      const consent = localStorage.getItem('cookieConsent');
      if (!consent) {
        this.showBar = true;
      }
    }
  }

  acceptCookies(): void {
    if (this.isBrowser) {
      localStorage.setItem('cookieConsent', 'accepted');
      this.showBar = false;
    }
  }

  rejectCookies(): void {
    if (this.isBrowser) {
      localStorage.setItem('cookieConsent', 'rejected');
      this.showBar = false;
    }
  }
}
