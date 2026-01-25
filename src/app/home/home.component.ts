import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { BannerComponent } from '../banner/banner.component';
// import { AboutComponent } from '../about/about.component';
// import { HomeBannerComponent } from '../home-banner/home-banner.component';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Renderer2 , ElementRef } from '@angular/core';
import { PricingComponent } from '../pricing/pricing.component';

@Component({
  selector: 'app-home',
  imports: [ RouterLink, RouterOutlet, CommonModule, PricingComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy  {

  
  private intervalId: any;
  loading = true;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private renderer: Renderer2,
    private el: ElementRef
  ) {}
  ngOnInit()
  {
    this.loading = true;
    document.body.classList.add('home');
     for (let i = 0; i < 10; i++) {
      setTimeout(() => this.createParticle(), i * 200);
    }
    this.loading = false;

    // Periodic creation
    this.intervalId = setInterval(() => this.createParticle(), 2000);
  }
  ngOnDestroy(): void {
     if (isPlatformBrowser(this.platformId)) {
    document.body.classList.remove('home');
     }
      if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
  // animation code
createParticle(): void {
    const particle = this.renderer.createElement('div');
    this.renderer.addClass(particle, 'particle');

    const colors = ['green', 'yellow', 'red', 'blue'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    this.renderer.addClass(particle, color);

    const size = Math.random() * 8 + 4;
    this.renderer.setStyle(particle, 'width', `${size}px`);
    this.renderer.setStyle(particle, 'height', `${size}px`);
    this.renderer.setStyle(particle, 'left', `${Math.random() * 100}%`);
    this.renderer.setStyle(particle, 'top', `${Math.random() * 100}%`);
    this.renderer.setStyle(particle, 'position', 'absolute');
    this.renderer.setStyle(particle, 'animation-delay', `${Math.random() * 6}s`);
    this.renderer.setStyle(particle, 'animation-duration', `${Math.random() * 4 + 4}s`);

    this.renderer.appendChild(this.el.nativeElement, particle);

    setTimeout(() => {
      this.renderer.removeChild(this.el.nativeElement, particle);
    }, 8000);
  }

}
