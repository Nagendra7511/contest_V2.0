import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from './services/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    return this.authService.isLoggedIn$.pipe(
      map(isLoggedIn => {
        const restrictedForLoggedIn = ['login', 'home', 'creators-registration']; 
        const isRestrictedPage = restrictedForLoggedIn.includes(route.routeConfig?.path || '');

        if (isLoggedIn && isRestrictedPage) {
          this.router.navigate(['/dashboard']); 
          return false;
        }

        if (!isLoggedIn && !isRestrictedPage) {
          this.router.navigate(['/login']); 
          return false;
        }

        return true;
      })
    );
  }
}
