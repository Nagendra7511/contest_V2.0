import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './login/login.component';
import { DrapdropGameComponent } from './drapdrop-game/drapdrop-game.component';
import { TreasureHuntComponent } from './treasure-hunt/treasure-hunt.component';
import { ScratchCardComponent } from './scratch-card/scratch-card.component';
import { WordGameComponent } from './word-game/word-game.component';
import { ProfileComponent } from './profile/profile.component';
import { SpinWheelComponent } from './spin-wheel/spin-wheel.component';
import { CompanyRegistrationComponent } from './company-registration/company-registration.component';
import { AuthGuard } from './auth.guard';
import { profileGuard } from './guards/profile.guard';
import { RenderMode } from '@angular/ssr';
import { MemoryGameComponent } from './memory-game/memory-game.component';
import { MemoryWordComponent } from './memory-word/memory-word.component';
import { PriceMatchComponent } from './price-match/price-match.component';
import { PuzzleComponent } from './puzzle/puzzle.component';
import { BrandInfoComponent } from './brand-info/brand-info.component';
import { FlappyGameComponent } from './flappy-game/flappy-game.component';
import { PrivacyComponent } from './privacy/privacy.component';
import { TermsComponent } from './terms/terms.component';
import { CookiesComponent } from './cookies/cookies.component';
import { ConfittiComponent } from './confitti/confitti.component';
import { InstaCommentsComponent } from './insta-comments/insta-comments.component';
import { DinoGameComponent } from './dino-game/dino-game.component';
import { QuizGameComponent } from './quiz-game/quiz-game.component';
import { ContactUsComponent } from './contact-us/contact-us.component';
import { LinksComponent } from './links/links.component';
import { ClickGameComponent } from './click-game/click-game.component';
import { WordSearchComponent } from './word-search/word-search.component';
import { CarRaceComponent } from './car-race/car-race.component';
import { BoatGameComponent } from './boat-game/boat-game.component';
import { PlaneGameComponent } from './plane-game/plane-game.component';
import { BrandCatchGameComponent } from './brand-catch-game/brand-catch-game.component';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  {
    path: 'home',
    component: HomeComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'spin-wheel',
    component: SpinWheelComponent,
    data: {renderMode: 'server'},
    canActivate: [ ]
  },
  {
    path: 'match-it-right-words',
    component: DrapdropGameComponent,
    data: {renderMode: 'server'},
    canActivate: []
  },
  {
    path: 'treasure-hunt',
    component: TreasureHuntComponent,
    data: {renderMode: 'server'},
    canActivate: []
  },
  {
    path: 'scratch-card',
    component: ScratchCardComponent,
    data: {renderMode: 'server'},
    canActivate: []
  },
  {
    path: 'word-game',
    component: WordGameComponent,
    data: {renderMode: 'server'},
    canActivate: []
  },
  {
    path: 'memory-image',
    component: MemoryGameComponent,
    data: {renderMode: 'server'},
    canActivate: []
  },
 {
    path: 'memory-word',
    component: MemoryWordComponent,
    data: {renderMode: 'server'},
    canActivate: []
  },
  {
    path: 'price-it-right',
    component: PriceMatchComponent,
    data: {renderMode: 'server'},
    canActivate: []
  },
   {
    path: 'puzzle',
    component: PuzzleComponent,
    data: {renderMode: 'server'},
    canActivate: []
  },
  {
    path: 'quiz',
    component: QuizGameComponent,
    data: {renderMode: 'server'},
    canActivate: []
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'brand-info/:storeId',
    component: BrandInfoComponent
  },
  {
    path: 'flappy-bird',
    component: FlappyGameComponent,
     data: {renderMode: 'server'},
    canActivate: []
  },
  {
    path:'insta-comments',
    component:InstaCommentsComponent,
    data: {renderMode: 'server'}, 
    canActivate: []

  },
  {
    path:'dino',
    component:DinoGameComponent,
    data: {renderMode: 'server'}, 
    canActivate: []

  },
    {
    path:'click-game',
    component:ClickGameComponent,
    data: {renderMode: 'server'}, 
    canActivate: []

  },
  {
    path:'word-search',
    component:WordSearchComponent,
    data: {renderMode: 'server'}, 
    canActivate: []

  },
  {
    path:'car-race',
    component: CarRaceComponent,
    data: {renderMode: 'server'}, 
    canActivate: []
  },
  {
    path:'boat-game',
    component: BoatGameComponent,
    data: {renderMode: 'server'}, 
    canActivate: []
  },
  {
    path:'jet-game',
    component: PlaneGameComponent,
    data: {renderMode: 'server'}, 
    canActivate: []
  },
   {
    path:'brand-catch-game',
    component: BrandCatchGameComponent,
    data: {renderMode: 'server'}, 
    canActivate: []
  },
  {
    path: 'privacy-policy',
    component: PrivacyComponent,
  },
  {
    path:'terms',
    component: TermsComponent,
  },
  {
    path:'cookies',
    component: CookiesComponent
  },
  {
    path:'contact-us',
    component: ContactUsComponent
  },
  {
    path:'links',
    component: LinksComponent
  }

  // {
  //   path: 'creators-registration',
  //   component: CompanyRegistrationComponent,
  //   canActivate: [AuthGuard]
  // }
];