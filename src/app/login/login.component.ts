import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  Renderer2,
  ElementRef,
  ViewChildren,
  QueryList
} from '@angular/core';
import { OtpService } from '../services/otp.service';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, NgModel } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';
import { AnalyticsService } from '../services/analytics.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet]
})
export class LoginComponent implements OnInit, OnDestroy {
  loginMethod: 'phone' | 'email' = 'email';
  countryCode: string = '+91';
  phone: string = '';
  email: string = '';
  otp: string = '';
  isOtpSent: boolean = false;
  message: string = '';
  isLoading: boolean = false;
  private intervalId: any;

  otpValues: string[] = ['', '', '', '', '', ''];
  otpDigits = new Array(6);
  private mutationObserver?: MutationObserver;
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef>;

  constructor(
    private otpService: OtpService,
    private router: Router,
    private authService: AuthService,
    private supabaseService: SupabaseService,
    private analytics: AnalyticsService,
    private renderer: Renderer2,
    private el: ElementRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {

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


  if (isPlatformBrowser(this.platformId)) {
    document.body.classList.add('home', 'login-page');

    for (let i = 0; i < 10; i++) {
      setTimeout(() => this.createParticle(), i * 200);
    }

    this.intervalId = setInterval(() => this.createParticle(), 2000);
  }
}

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('home', 'login-page');
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async sendOtp() {
    this.message = '';
    if (this.loginMethod === 'phone' && !this.phone) {
      this.message = 'Please enter your phone number';
      return;
    }
    if (this.loginMethod === 'email' && !this.email) {
      this.message = 'Please enter your email';
      return;
    }

    this.isLoading = true;

    try {
      if (this.loginMethod === 'phone') {
        await this.otpService.signInWithPhone(this.countryCode, this.phone);
      } else {
        await this.otpService.signInWithEmail(this.email);
      }

      this.isOtpSent = true;
      this.message = 'Verification code sent! Check your email to complete sign in.';
    } catch (error) {
      this.message = 'Error sending OTP: ' + this.extractErrorMessage(error);
    } finally {
      this.isLoading = false;
    }
  }

  async verifyOtp() {
    this.otp = this.otpValues.join('');
    if (!this.otp || this.otp.length < 6) {
      this.message = 'Please enter the full 6-digit OTP';
      return;
    }

    this.message = '';
    this.isLoading = true;

    try {
      let response: any;
      if (this.loginMethod === 'phone') {
        response = await this.otpService.verifyPhoneOtp(this.countryCode, this.phone, this.otp);
      } else {
        response = await this.otpService.verifyEmailOtp(this.email, this.otp);
      }

      if (response.success) {
        const user = response.user;
        const userId = user?.id;

        if (!userId) {
          this.message = 'User ID not found.';
          return;
        }

        this.authService.setLoggedIn(true, userId);

        const profile = await this.supabaseService.getProfile(userId);
        const firstName = profile?.first_name?.trim();

        if (firstName) {
          this.authService.setProfileComplete(true);
          this.router.navigate(['/dashboard']);
        } else {
          const brandUser = await this.supabaseService.getBrandUser(userId);

          if (Array.isArray(brandUser) && brandUser.length > 0) {
            this.authService.setProfileComplete(true);
            this.router.navigate(['/dashboard']);
          } else {
            this.authService.setProfileComplete(false);
            this.router.navigate(['/profile']);
          }
        }
      } else {
        this.message = 'Invalid OTP. Please try again.';
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      this.message = 'Error verifying OTP: ' + this.extractErrorMessage(error);
    } finally {
      this.isLoading = false;
    }
  }

  preventPlus(event: KeyboardEvent) {
    if (event.key === '+') {
      event.preventDefault();
    }
  }
preventPlusOnInput(event: any) {
  const input = event.target;
  input.value = input.value.replace(/\+/g, '');
}
  private extractErrorMessage(error: any): string {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return error.message;
    }
    return 'Unknown error';
  }

  // Particle animation
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

  // OTP Input logic
  onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    if (value.length > 1) {
      this.handlePasteValue(value);
      return;
    }

    this.otpValues[index] = value;

    if (value && index < 5) {
      this.focusInput(index + 1);
    }

    this.otp = this.otpValues.join('');
  }

  onOtpKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.otpValues[index] && index > 0) {
      this.focusInput(index - 1);
    }
  }

  handlePaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text') || '';
    this.handlePasteValue(pasted);
  }

  handlePasteValue(pasted: string): void {
    const digits = pasted.replace(/\D/g, '').slice(0, 6).split('');
    for (let i = 0; i < digits.length; i++) {
      this.otpValues[i] = digits[i];
    }

    this.otp = this.otpValues.join('');
    this.otpInputs.changes.subscribe(() => {
      this.focusInput(digits.length < 6 ? digits.length : 5);
    });
  }

  focusInput(index: number): void {
    const inputs = this.otpInputs.toArray();
    if (inputs[index]) {
      inputs[index].nativeElement.focus();
    }
  }
  goBack() {
  this.isOtpSent = false;
  this.otpValues = ['', '', '', '', '', '']; // Clear OTP
  this.otp = '';
  this.message = '';
}

}
