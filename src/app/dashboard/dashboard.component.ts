import { Component } from '@angular/core';
import { DasboardtabsComponent } from '../dasboardtabs/dasboardtabs.component';
import { BannerComponent } from '../banner/banner.component';
// import { ContestsComponent } from '../contests/contests.component';

@Component({
  selector: 'app-dashboard',
  imports: [DasboardtabsComponent, BannerComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {

}
