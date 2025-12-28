import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { FooterComponent } from './footer/footer.component';
import { AuthService } from './services/auth.service';
import { CommonModule } from '@angular/common';
import { AnalyticsService } from './services/analytics.service';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CookiesBarComponent } from "./cookies-bar/cookies-bar.component";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, CommonModule, FooterComponent, CookiesBarComponent, CookiesBarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  isLoggedIn = false;
  private mutationObserver?: MutationObserver;

  constructor(private authService: AuthService, private router: Router,private analytics: AnalyticsService) {
    this.authService.isLoggedIn$.subscribe((status: boolean) => {
      this.isLoggedIn = status;
    });
  }
  ngOnInit(): void {
    
    const htmlEl = document.documentElement;

    // Initial cleanup
    if (htmlEl.hasAttribute('native-dark-active')) {
      htmlEl.removeAttribute('native-dark-active');
    }
    
    // Remove injected style if it exists
    const darkStyle = document.getElementById('dark-mode-native-style');
    if (darkStyle) darkStyle.remove();

    // ✅ Continuous watcher
    this.mutationObserver = new MutationObserver(() => {
      // Remove native-dark-active whenever it appears
      if (htmlEl.hasAttribute('native-dark-active')) {
        htmlEl.removeAttribute('native-dark-active');
      }

      // Remove injected dark style if Chrome re-adds it
      const styleTag = document.getElementById('dark-mode-native-style');
      if (styleTag) styleTag.remove();
    });

    // Watch for attribute or style tag changes
    this.mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['native-dark-active']
    });

    this.mutationObserver.observe(document.head, {
      childList: true
    });

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.analytics.sendPageView(event.urlAfterRedirects);
    });
  }

  async logout() {
    localStorage.removeItem('redirectUrl');
    await this.authService.logout();
    window.location.href = '/home'; 
  }

  title = 'contest';

  closeNavbarOnClick(): void {
    const navbarCollapse = document.getElementById('navbarSupportedContent');
    if (navbarCollapse && navbarCollapse.classList.contains('show')) {
      navbarCollapse.classList.remove('show');
    }
  }
}
