import { Component, Inject, OnDestroy, OnInit, Output, EventEmitter, PLATFORM_ID , ViewChildren, QueryList, Renderer2, ElementRef} from '@angular/core';
import { OtpService } from '../services/otp.service';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, NgModel } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';
import { AnalyticsService } from '../services/analytics.service';


@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './login-modal.component.html',
  styleUrl: './login-modal.component.css'
})
export class LoginModalComponent implements OnInit, OnDestroy {

  @Output() close = new EventEmitter<void>();
  @Output() loginComplete = new EventEmitter<any>();

  loginMethod: 'phone' | 'email' = 'email';

  countryCode: string = '+91';
  phone: string = '';
  email: string = '';
  otp: string = '';
  isOtpSent: boolean = false;
  message: string = '';
  isLoading: boolean = false;

  
  otpValues: string[] = ['', '', '', '', '', ''];
  otpDigits = new Array(6);

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
    // document.body.classList.add('home', 'login-page');
  }

  ngOnDestroy(): void {
    // if (isPlatformBrowser(this.platformId)) {
    //   document.body.classList.remove('home', 'login-page');
    // }
  }
 
    onCloseClick() {
    this.close.emit(); // Just close the modal
  }

  // Called after login
  handleLoginSuccess(result: any) {
    this.loginComplete.emit(result); 
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
      // const token = await this.executeRecaptcha();
      // console.log('✅ reCAPTCHA token:', token);

      if (this.loginMethod === 'phone') {
        await this.otpService.signInWithPhone(this.countryCode, this.phone);
      } else {
        await this.otpService.signInWithEmail(this.email);
      }

      this.isOtpSent = true;
      this.message = 'Verification code sent successfully';

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
        this.loginComplete.emit({ success: true, userId: userId });
        
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



  private extractErrorMessage(error: any): string {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return error.message;
    }
    return 'Unknown error';
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
