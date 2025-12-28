import { Component } from '@angular/core';
import {  RouterOutlet } from '@angular/router';
import { LoginComponent } from '../login/login.component';
// import { LoginComponent } from '../login/login.component';

@Component({
  selector: 'app-customer-registration',
  imports: [RouterOutlet, LoginComponent],
  templateUrl: './customer-registration.component.html',
  styleUrl: './customer-registration.component.css'
})
export class CustomerRegistrationComponent {

}
