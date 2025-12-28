import { Injectable, isDevMode } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private gtag(...args: any[]) {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag(...args);
    }
  }

  public sendPageView(url: string) {
    this.gtag('event', 'page_view', {
      page_path: url,
    });
  }

  public sendEvent(eventName: string, params: Record<string, any> = {}) {
    this.gtag('event', eventName, params);
  }
}
