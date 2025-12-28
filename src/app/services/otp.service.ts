import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { AuthSession, SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { isPlatformServer } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class OtpService {
  private supabase!: SupabaseClient;
  private _session: AuthSession | null = null;
  isServer: boolean = false;

  constructor(@Inject(PLATFORM_ID) platformId: any) {
    this.isServer = isPlatformServer(platformId);

    if (!this.isServer) {
      this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
    }
  }

  // -----------------------
  // PHONE OTP
  // -----------------------
  async signInWithPhone(countryCode: string, phone: string) {
    const fullPhoneNumber = `${countryCode}${phone}`;
    const { error } = await this.supabase.auth.signInWithOtp({
      phone: fullPhoneNumber,
      options: {
        channel: 'sms', // explicitly ensure SMS is used
      },
    });
    if (error) throw new Error(error.message || 'Failed to send OTP');
    return { success: true };
  }

  async verifyPhoneOtp(countryCode: string, phone: string, token: string) {
    const fullPhoneNumber = `${countryCode}${phone}`;
    const { data, error } = await this.supabase.auth.verifyOtp({
      phone: fullPhoneNumber,
      token,
      type: 'sms', // ✅ valid type for phone OTP
    });
    if (error) throw new Error(error.message || 'OTP verification failed');
    return { success: true, user: data.user };
  }

  // -----------------------
  // EMAIL OTP
  // -----------------------
  async signInWithEmail(email: string) {
    const { error } = await this.supabase.auth.signInWithOtp({
      email,
      
       options: {
        shouldCreateUser: true,
        emailRedirectTo: undefined,
        data: {
          userType: "participant",
        },
    },
    });
    if (error) throw new Error(error.message || 'Failed to send email OTP');
    return { success: true };
  }

  async verifyEmailOtp(email: string, token: string) {
    const { data, error } = await this.supabase.auth.verifyOtp({
      email,
      token,
      type: 'email', 
    });
    if (error) throw new Error(error.message || 'Email OTP verification failed');
    return { success: true, user: data.user };
  }

  // -----------------------
  // SIGN OUT
  // -----------------------
  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw new Error(error.message || 'Sign out failed');
    return { success: true };
  }
}
