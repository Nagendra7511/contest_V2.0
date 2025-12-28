import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LocationService {
  constructor(private http: HttpClient) {}

  async getUserCountry(): Promise<string | null> {
    try {
      const data: any = await firstValueFrom(
        this.http.get('https://ipapi.co/json/')
      );
      return data?.country_code || null; // "IN"
    } catch (err) {
      console.error('Failed to fetch user location', err);
      return null;
    }
  }
}
