import { CommonModule } from '@angular/common';
import { OtpService } from '../services/otp.service';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-company-registration',
  standalone: true,
  imports: [RouterOutlet, CommonModule, ReactiveFormsModule],
  templateUrl: './company-registration.component.html',
  styleUrls: ['./company-registration.component.css']
})
export class CompanyRegistrationComponent implements OnInit {
  registerForm!: FormGroup;
  isOtpSent = false;
  otpVerified = false;
  isVerifying = false;
  isSendingOtp = false;
  errorMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private otpService: OtpService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      accountType: ['Individual', Validators.required],
      companyName: [''],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneCountryCode: ['+91', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      otp: ['', Validators.required],
      country: ['', Validators.required],
      instagram: [''],
      license: [null, Validators.required]
    });

    this.handleAccountTypeChanges();
  }

  handleAccountTypeChanges(): void {
    this.registerForm.get('accountType')?.valueChanges.subscribe((accountType: string) => {
      const companyNameControl = this.registerForm.get('companyName');
      if (accountType === 'Company') {
        companyNameControl?.setValidators(Validators.required);
      } else {
        companyNameControl?.clearValidators();
        companyNameControl?.setValue('');
      }
      companyNameControl?.updateValueAndValidity();
    });
  }

  async sendOtp() {
    this.isSendingOtp = true;
    this.errorMessage = '';
    const phone = this.registerForm.get('phoneNumber')?.value;
    const countryCode = this.registerForm.get('phoneCountryCode')?.value;

    if (!phone) {
      this.errorMessage = 'Please enter a valid phone number.';
      this.isSendingOtp = false;
      return;
    }

    try {
      const response = await this.otpService.signInWithPhone(countryCode, phone);
      if (response?.success) {
        this.isOtpSent = true;
      } else {
        this.errorMessage = 'Failed to send OTP. Try again.';
      }
    } catch (error: any) {
      console.error('❌ OTP Send Error:', error);
      this.errorMessage = error.message || 'Failed to send OTP.';
    }
    this.isSendingOtp = false;
    this.cdr.detectChanges();
  }

  async verifyOtp() {
    this.isVerifying = true;
    this.errorMessage = '';

    const phone = this.registerForm.get('phoneNumber')?.value;
    const countryCode = this.registerForm.get('phoneCountryCode')?.value;
    const otp = this.registerForm.get('otp')?.value;

    if (!otp) {
      this.errorMessage = 'Please enter the OTP.';
      this.isVerifying = false;
      return;
    }

    try {
     
     
    } catch (error: any) {
      console.error('❌ OTP Verification Error:', error);
      this.errorMessage = error.message || 'Invalid OTP. Try again.';
    }
    this.isVerifying = false;
    this.cdr.detectChanges();
  }

  onSubmit() {
    if (!this.otpVerified) {
      this.errorMessage = 'Please verify your OTP before submitting.';
      return;
    }
    // console.log('✅ Form Submitted:', this.registerForm.value);

    this.registerForm.reset();
    this.isOtpSent = false;
    this.otpVerified = false;
    this.isVerifying = false;
    this.isSendingOtp = false;
    this.errorMessage = '';

  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0]; 
      this.registerForm.patchValue({ license: file }); 
    }
  }
}
