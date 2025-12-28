import { Component } from '@angular/core';
// import { BannerComponent } from '../banner/banner.component';
// import { FooterComponent } from '../footer/footer.component';
import {  RouterOutlet } from '@angular/router';
import { SpinWheelComponent } from '../spin-wheel/spin-wheel.component';
// import { DrapdropGameComponent } from '../drapdrop-game/drapdrop-game.component';


@Component({
  selector: 'app-games',
  imports: [ RouterOutlet, SpinWheelComponent],
  templateUrl: './games.component.html',
  styleUrl: './games.component.css'
})
export class GamesComponent {

}
