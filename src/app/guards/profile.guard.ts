import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class profileGuard implements CanActivate {
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(): Observable<boolean> {
    return this.authService.isProfileComplete$.pipe(
      map(isComplete => {
        if (!isComplete) {
          this.router.navigate(['/profile']);
          return false;
        }
        return true;
      })
    );
  }
}
