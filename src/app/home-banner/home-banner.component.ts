import { Component } from '@angular/core';
import { CompanyRegistrationComponent } from '../company-registration/company-registration.component';
import { CustomerRegistrationComponent } from '../customer-registration/customer-registration.component';

@Component({
  selector: 'app-home-banner',
  imports: [CompanyRegistrationComponent],
  templateUrl: './home-banner.component.html',
  styleUrl: './home-banner.component.css'
})
export class HomeBannerComponent {

}
