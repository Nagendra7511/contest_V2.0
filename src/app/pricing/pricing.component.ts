import { Component } from '@angular/core';

@Component({
  selector: 'app-pricing',
  imports: [],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.css'
})
export class PricingComponent {

  currency: 'INR' | 'USD' = 'USD';

  changeCurrency(type: 'INR' | 'USD') {
    this.currency = type;
  }

}