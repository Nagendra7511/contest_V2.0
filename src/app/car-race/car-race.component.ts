import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { UtilService } from '../services/util.service';
import { AnalyticsService } from '../services/analytics.service';
import { AuthService } from '../services/auth.service';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { ConfittiComponent } from '../confitti/confitti.component';
import { Location } from '@angular/common';
import { LocationService } from '../services/location.service';

@Component({
  selector: 'app-car-race',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileModalComponent, LoginModalComponent, ConfittiComponent],
  templateUrl: './car-race.component.html',
  styleUrls: ['./car-race.component.css'],
})
export class CarRaceComponent implements AfterViewInit, OnDestroy {
  // @ViewChild('game', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private canvasRef!: ElementRef<HTMLCanvasElement>;
  private gameReady = false;
  private loopStarted = false;

  @ViewChild('game', { static: false })
  set gameCanvas(ref: ElementRef<HTMLCanvasElement> | undefined) {
    if (ref) {
      this.canvasRef = ref;
      if (this.gameReady && !this.loopStarted) {
        this.initGame();
      }
    }
  }

  // UI bindings
  score = 0;
  finalScore = 0;
  best = Number(localStorage.getItem('rr_best_label') || 0);

  // internal
  private ctx!: CanvasRenderingContext2D;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTs = 0;
  private t = 0;
  private whooshTime = 0;
  private running = true;
  private resultSent = false;


  contest: any = {};
  selectedOffer: any;
  contestId: string | null = null;

  loading = true;
  showLoginButton = false;
  showAccessMessage = false;
  showWelcomeScreen = false;
  showGamePanel = false;
  showGameUpdate = false;
  showGameResult = false;
  gameResult: any;
  insta_post_view = false;

  userId: string | null = null;
  isLoggedIn = false;
  isContestAssigned = false;
  participationCount: number | null = null;


  contest_Expired = false;
  showContesExpired = false;
  confetti = false;
  admin_view = false;
  store_id: string | null = null;
  brand: any[] = [];
  totalResultCount!: number;
  daysLeft: number = 0;
  correctCount: number = 0;

  gameMusic!: HTMLAudioElement;
  isMusicPlaying = false;
  instaUserId: string | null = null;
insta_flow_LoginButton = false;
hasPlayed = false;
customerInstaId: string | null = null;

  private giftImages: HTMLImageElement[] = [];
  private powerSymbols: { x: number; y: number; alpha: number; text: string }[] = [];
  private MIN_HAZARD_GAP = 0.6;
  // world / constants
  private world = {
    get cx() {
      return this._canvasWidth / 2;
    },
    get cy() {
      return this._canvasHeight / 2;
    },

    _canvasWidth: 620,
    _canvasHeight: 620,
    midR: 0,
    thickness: 90,
    laneInset: 0.9,
    carSize: 54,
    baseSpeed: 0.85,
    speedGain: 0.025,
    switchTime: 0.18,
  } as any;

  private car = { theta: Math.random() * Math.PI * 2, lane: 1, targetLane: 1, switching: false, lerp: 1, dir: 1 };
  private pickups: Record<string, any[]> = { outer: [], inner: [] };
  private hazards: Record<string, any[]> = { outer: [], inner: [] };
  private spawner = { pOut: 1.1, pIn: 1.25, hOut: 0.95, hIn: 1.05, pTO: 0, pTI: 0, hTO: 0, hTI: 0, minA: 0.8, maxA: 1.9 };

  private stars: any[] = [];
  private lastResizeHandler = () => this.fit();

  // Images
  private carImg = new Image();
  private nitroGreen = new Image();
  private nitroYellow = new Image();
  private hazardImg = new Image();

  profile: any = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private authserivice: AuthService,
    public utilService: UtilService,
    private analyticsService: AnalyticsService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef,
    private locationService: LocationService,
    private location: Location,
    private cd: ChangeDetectorRef, private ngZone: NgZone
  ) { }

  private initialized = false;

  //waiting for tap to actually start games
  isWaitingForTapStart = false;

  async ngOnInit(): Promise<void> {

    this.userId = localStorage.getItem('userId');
    const profile = await this.supabaseService.getProfile(this.userId!);
    this.profile = profile;

    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('popstate', this.handleBackNavigation);
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    }

    this.initMusic();
    this.loadGameData();
  }

  showModal = false;
  showProfileModal = false;

  openModal() {
    this.showModal = true;
  }
  close() {
    this.showModal = false;
  }

  // Handles close from both login and profile modals
  async closeModal(event: any) {
    if (event?.success && event?.userId) {
      this.userId = event.userId;
      this.loadGameData();
      const hasPlayed = await this.loadGameData();
      this.showModal = false;
      this.showLoginButton = false;
      this.showProfileModal = false;
      const updatedProfile = await this.supabaseService.getProfile(this.userId!);
      const isComplete = !!updatedProfile?.first_name?.trim();
      this.authserivice.setProfileComplete(isComplete);
            this.insta_flow_LoginButton = false;
          //  if (!this.hasPlayed) {
          //     ($('#infoModal') as any).modal('show');
          //   }
          //   this.coustomerIdUpdateInstaContest(); 
    }
  }

  private async loadCustomerInstaId() {
    this.isLoggedIn = !!this.userId;
    if (this.isLoggedIn) {
      this.profile = await this.supabaseService.getProfile(this.userId!);

      const username = this.profile?.instagram_url;
      if (username) {
        const instaUser = await this.supabaseService.getInstaUserByUsername(username);
        this.customerInstaId = instaUser?.uuid ?? null;
      } else {
        this.customerInstaId = null;
      }
    }
  }

  async loadGameData(): Promise<void> {
    document.body.classList.add('car-active');

    const contestId = this.route.snapshot.queryParamMap.get('cid');
    const insta_user_ig = this.route.snapshot.queryParamMap.get('ig');

    this.isLoggedIn = !!this.userId;
  
    // 🔍 Fetch insta user if IG param exists
    if (insta_user_ig) {
      // alert('abc');
      const instaData = await this.supabaseService.getContestInstaId(insta_user_ig, contestId!);

      if (instaData) {
        this.instaUserId = instaData.insta_user; // ✅ actual insta user ID
      }
    }

    // if (insta_user_id) {
    //   localStorage.setItem('user_inst_ID', insta_user_id);
    // }
    if (!contestId) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.contestId = contestId;

    try {
      this.userId = this.authserivice.getUserId();
      const brandUser = await this.supabaseService.getBrandUser(this.userId!);

      const contestData = await this.supabaseService.getContestById(contestId);
      if (!contestData) throw new Error('Contest not found');
      this.contest = contestData;

      const now = new Date();
      const expDate = new Date(contestData.end_date);
      this.contest_Expired = expDate < now;

      const timeDiff = expDate.getTime() - now.getTime();
      this.daysLeft = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));

      if (brandUser && brandUser.length > 0) {
        this.store_id = brandUser[0].store_id;
        const brandContest = await this.supabaseService.getBrandContestsByID(contestId);
        const brandData = await this.supabaseService.getBrandStoreID(this.store_id!);
        this.brand = brandData || [];
        this.totalResultCount = this.brand.reduce((sum: number, contest: any) => sum + (contest.result_count || 0), 0);

        this.participationCount = await this.supabaseService.getContestCount(contestId);
        if (brandContest) {
          this.contest = brandContest;
          this.giftImages = this.contest.game_config.images;
          this.showWelcomeScreen = true;
          this.loading = false;
          this.admin_view = true;
          return;
        }
      }

      

      this.giftImages = this.contest.game_config.images;
      if (contestData.location) {
        const allowedCountries = contestData.location
          .split(',')
          .map((c: string) => c.trim().toUpperCase());
        const userCountry = await this.locationService.getUserCountry();
        if (!userCountry || !allowedCountries.includes(userCountry.toUpperCase())) {
          this.showAccessMessage = true;
          this.loading = false;
          return;
        }
      }

      this.store_id = contestData.store_id || null;
      this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
      this.userId = localStorage.getItem('userId')!;
      this.isLoggedIn = !!this.userId;

      const brandData = await this.supabaseService.getBrandStoreID(this.store_id!);
      this.brand = brandData || [];
      this.totalResultCount = this.brand.reduce((sum: number, contest: any) => sum + (contest.result_count || 0), 0);
      await this.loadCustomerInstaId();
      this.hasPlayed = await this.supabaseService.checkIfContestPlayed({
        contestId: this.contest.contest_id,
        customerId: this.userId ?? null,
         instaUserId: this.instaUserId ?? this.customerInstaId ?? null
      });
      this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);

      if (this.hasPlayed) {
        const data = await this.supabaseService.getUserResult({
          contestId: this.contest.contest_id,
          customerId: this.userId ?? null,
          instaUserId: this.instaUserId ?? this.customerInstaId ?? null
        });
        if (insta_user_ig) {
          const check = !this.isLoggedIn
            ? await this.supabaseService.validateAndUpdateInstaUser(insta_user_ig, this.contest.contest_id)
            : await this.supabaseService.validateAndUpdateInstaUser(
              insta_user_ig,
              this.contest.contest_id,
              await this.supabaseService.getProfile(this.userId!)
            );

          this.loading = true;  
          setTimeout(async () => {
            await this.loadCustomerInstaId(); // refresh the customer insta id
            
            const isLinkedCorrectly = this.instaUserId === this.customerInstaId;

            if (contestData.insta_post && this.isLoggedIn && !isLinkedCorrectly) {
              this.showAccessMessage = true;
              this.insta_post_view = true;
              this.showGameResult = false;
              this.loading = false;
              return;
            }
          }, 1000);
          this.loading = false;

          this.gameResult = data;
          this.showWelcomeScreen = false;
          this.showGamePanel = false;
          this.showGameResult = true;

          if (!this.isLoggedIn) {
            this.insta_flow_LoginButton = true;
            this.loading = false;
            return
          }

        }
        if (!insta_user_ig)
        {
          this.gameResult = data;
          this.showWelcomeScreen = false;
          this.showGamePanel = false;
          this.showGameResult = true;
        }

        this.loading = false;
        return;
      }


      
      if (contestData.insta_post) {

        if (!insta_user_ig) {
          this.showAccessMessage = true;
          this.insta_post_view = true;
          this.loading = false;
          return;
        }

        const check = !this.isLoggedIn
          ? await this.supabaseService.validateAndUpdateInstaUser(insta_user_ig, this.contest.contest_id)
          : await this.supabaseService.validateAndUpdateInstaUser(insta_user_ig, this.contest.contest_id,
            await this.supabaseService.getProfile(this.userId!)
          );
        const isLinkedCorrectly = this.instaUserId === this.customerInstaId;

        // console.log('isLinkedCorrectly:',  this.instaUserId,this.customerInstaId);
        if (contestData.insta_post && this.isLoggedIn && !isLinkedCorrectly) {
          
          this.showAccessMessage = true;
          this.insta_post_view = true;
          this.loading = false;
          return;
        }
         
        if (!check.valid) {
          this.showAccessMessage = true;
          this.insta_post_view = true;
          this.loading = false;
          return;
        }

        // ✅ CLEAR ALL BLOCKERS
        this.showAccessMessage = false;
        this.insta_post_view = false;
        this.showLoginButton = false;

        // ✅ SHOW GAME ENTRY
        this.showWelcomeScreen = true;
        this.showGamePanel = false;
        this.showGameUpdate = false;

        this.loading = false;
        return;
      }


      if (!this.isLoggedIn) {
        this.showLoginButton = true;
        this.loading = false;
        return;
      }
      if (!contestData.active) {
        this.showWelcomeScreen = false;
        this.showContesExpired = true;
        this.loading = false;
        return;
      }

      
      if (this.contest_Expired) {
        this.showContesExpired = true;
        this.loading = false;
        return;
      }

      if (!this.contest.is_private) {
        this.showWelcomeScreen = true;
        this.loading = false;
        return;
      }

      const assignedContests = await this.supabaseService.getAllContest_assigned(this.userId);
      const assignedContestIds = assignedContests.map((c: any) => c.contest_id);
      this.isContestAssigned = assignedContestIds.includes(contestId);

      if (!this.isContestAssigned) {
        this.showContesExpired = true;
        this.loading = false;
        return;
      }

      this.showWelcomeScreen = true;
    } catch (error) {
      console.error('Error fetching contest or user data:', error);
      this.router.navigate(['/dashboard']);
    }

    this.loading = false;
  }

  ngAfterViewInit(): void {
    // If you keep this, guard it:
    this.ngZone.onStable.subscribe(() => {
      if (!this.initialized && this.canvasRef) {
        this.initialized = true;
        this.initGame();
      }
    });
  }


  // ngAfterViewInit(): void {}
  async startGame(): Promise<void> {
    ($('#infoModal') as any).modal('hide');
    document.body.classList.add('game-running');
    this.onGameFinished();
    this.customerCreateOnStore();
    if (!this.contest?.contest_id) return;
     this.hasPlayed = await this.supabaseService.checkIfContestPlayed({
        contestId: this.contest.contest_id,
        customerId: this.userId ?? null,
         instaUserId: this.instaUserId ?? this.customerInstaId ?? null
      });
    if (this.hasPlayed) {
      this.loadGameData();
      return;
    }
    if (this.showGamePanel) return;

    this.showWelcomeScreen = false;
    this.showGamePanel = true;
    this.showGameUpdate = false;
    this.cd.detectChanges();

    this.giftImages = this.contest.game_config.images;
    await this.loadGiftImages();

    queueMicrotask(() => {
      this.initGame();
      this.running = false; // stop the simulation from progressing
      this.isWaitingForTapStart = true; // show the overlay and wait for tap
      this.drawTapToStartOverlay();
    });

    this.analyticsService.sendEvent('game_start_click', {
      game_type: 'car-game',
      contest_id: this.contest.contest_id
    });

    if (!isPlatformBrowser(this.platformId)) return;
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Space') {
      event.preventDefault(); // avoid page scroll
      this.onPointerDown();   // call your existing click handler
    }
  };

  private addKeyboardControls() {
    window.addEventListener('keydown', this.handleKeyDown);
  }

  private removeKeyboardControls() {
    window.removeEventListener('keydown', this.handleKeyDown);
  }


  initMusic() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.gameMusic = new Audio('/images/audio.mp3'); // <-- put file in assets/music
    this.gameMusic.loop = true;
    this.gameMusic.volume = 0.5;
  }

  playMusic() {
    if (this.gameMusic && !this.isMusicPlaying) {
      this.gameMusic.play().catch(err => console.warn('Autoplay blocked:', err));
      this.isMusicPlaying = true;
    }
  }

  pauseMusic() {
    if (this.gameMusic && this.isMusicPlaying) {
      this.gameMusic.pause();
      this.isMusicPlaying = false;
    }
  }

  toggleMusic() {
    if (this.isMusicPlaying) {
      this.pauseMusic();
    } else {
      this.playMusic();
    }
  }

  private async initGame() {
    if (!this.canvasRef) return;  // safety
    this.loopStarted = true;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context not supported');
    this.ctx = ctx;

    // ensure single pointer listener
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    this.addKeyboardControls();

    // Prepare actual SVGs
    const svg = (s: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(s);

       // 🚗 Car SVG (simple 3D-like gradient car)
    this.carImg.src = svg(`
   <svg
   xmlns:dc="http://purl.org/dc/elements/1.1/"
   xmlns:cc="http://creativecommons.org/ns#"
   xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns:svg="http://www.w3.org/2000/svg"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:xlink="http://www.w3.org/1999/xlink"
   version="1.1"
   width="100%"
   height="100%"
   viewBox="0 0 960 476"
   id="svg2">
  <title
     id="title3968">Red Car - Top View</title>
  <defs
     id="defs4">
    <linearGradient
       id="linearGradient3759">
      <stop
         id="stop3761"
         style="stop-color:#1a1a1a;stop-opacity:1"
         offset="0" />
      <stop
         id="stop3763"
         style="stop-color:#000000;stop-opacity:0"
         offset="1" />
    </linearGradient>
    <linearGradient
       x1="871.33002"
       y1="842.29999"
       x2="848.15997"
       y2="834.67999"
       id="linearGradient4149"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="translate(8.3085,-2.6518)" />
    <linearGradient
       x1="879.90002"
       y1="537.5"
       x2="812.14001"
       y2="533.5"
       id="linearGradient4153"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="matrix(0.89332,0,0,0.89332,80.349,365.15)" />
    <linearGradient
       x1="879.90002"
       y1="537.5"
       x2="815.82001"
       y2="531.90997"
       id="linearGradient4155"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="translate(27.625,296.49)" />
    <linearGradient
       x1="871.33002"
       y1="842.29999"
       x2="848.15997"
       y2="834.67999"
       id="linearGradient4185"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="matrix(1,0,0,-1,8.3085,1452)" />
    <linearGradient
       x1="887.90002"
       y1="528.35999"
       x2="876.14001"
       y2="528.41998"
       id="linearGradient4187"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="matrix(1,0,0,-1,21.438,1151.5)" />
    <linearGradient
       x1="879.90002"
       y1="537.5"
       x2="815.82001"
       y2="531.90997"
       id="linearGradient4189"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="matrix(1,0,0,-1,27.625,1152.9)" />
    <linearGradient
       x1="897.21997"
       y1="542.40002"
       x2="883.76001"
       y2="535.37"
       id="linearGradient4191"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="matrix(1,0,0,-1,21.438,1151.5)" />
    <linearGradient
       x1="880.71002"
       y1="552.04999"
       x2="835.98999"
       y2="501.07999"
       id="linearGradient4193"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="matrix(1,0,0,-1,21.438,1151.5)" />
    <linearGradient
       x1="887.90002"
       y1="528.35999"
       x2="805.28998"
       y2="529.60999"
       id="linearGradient4195"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="matrix(0.89332,0,0,-0.89332,94.156,1087.8)" />
    <linearGradient
       x1="879.90002"
       y1="537.5"
       x2="812.14001"
       y2="533.5"
       id="linearGradient4197"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="matrix(0.89332,0,0,-0.89332,80.349,1084.2)" />
    <linearGradient
       x1="229.7"
       y1="873.14001"
       x2="205.59"
       y2="867.67999"
       id="linearGradient4199"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="matrix(0.99043,-0.13799,-0.13799,-0.99043,146.05,1483.3)" />
    <linearGradient
       x1="238.83"
       y1="873.06"
       x2="216.56"
       y2="872.65002"
       id="linearGradient4201"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="matrix(0.99043,-0.13799,-0.13799,-0.99043,156.31,1482)" />
    <linearGradient
       x1="887.90002"
       y1="528.35999"
       x2="876.14001"
       y2="528.41998"
       id="linearGradient4203"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="translate(21.438,297.91)" />
    <linearGradient
       x1="897.21997"
       y1="542.40002"
       x2="883.76001"
       y2="535.37"
       id="linearGradient4205"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="translate(21.438,297.91)" />
    <linearGradient
       x1="880.71002"
       y1="552.04999"
       x2="835.98999"
       y2="501.07999"
       id="linearGradient4207"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="translate(21.438,297.91)" />
    <linearGradient
       x1="887.90002"
       y1="528.35999"
       x2="805.28998"
       y2="529.60999"
       id="linearGradient4209"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="matrix(0.89332,0,0,0.89332,94.156,361.57)" />
    <linearGradient
       x1="229.7"
       y1="873.14001"
       x2="205.59"
       y2="867.67999"
       id="linearGradient4211"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="matrix(0.99043,0.13799,-0.13799,0.99043,146.05,-33.885)" />
    <linearGradient
       x1="238.83"
       y1="873.06"
       x2="216.56"
       y2="872.65002"
       id="linearGradient4213"
       xlink:href="#linearGradient3759"
       gradientUnits="userSpaceOnUse"
       gradientTransform="matrix(0.99043,0.13799,-0.13799,0.99043,156.31,-32.603)" />
  </defs>
  <g
     transform="translate(-52.937,-486.69)"
     id="layer1">
    <g
       id="g3890">
      <path
         d="m 610.52,493.69 c -1.5086,0.009 -4.7211,0.30491 -6.4687,0.9375 l -3.5,1.5 8.6562,35.938 -124.81,0.28125 c -2.4363,0.005 -4.8876,-0.014 -7.3437,-0.0312 -4.912,-0.0343 -9.8649,-0.10455 -14.844,-0.21875 -7.2926,-0.16728 -14.669,-0.41288 -22.062,-0.71875 -0.39591,-0.0164 -0.79137,-0.0457 -1.1875,-0.0625 -14.932,-0.63018 -30.007,-1.4917 -45.031,-2.4375 -20.326,-1.2827 -40.52,-2.7074 -60.124,-3.875 -14.528,-0.8653 -28.732,-1.5796 -42.375,-2 -9.3692,-0.28873 -18.464,-0.45655 -27.25,-0.40625 -4.3158,0.0247 -8.5678,0.0933 -12.719,0.21875 -4.1508,0.12546 -8.3801,0.3553 -12.656,0.65625 -2.138,0.15047 -4.2778,0.31024 -6.4374,0.5 -6.4689,0.5684 -13.045,1.3214 -19.594,2.1875 -0.0101,10e-4 -0.0211,-10e-4 -0.0312,0 -4.3725,0.57858 -8.7185,1.2255 -13.062,1.9062 -4.3439,0.68073 -8.6734,1.3978 -12.937,2.1562 -4.2537,0.75662 -8.4704,1.5654 -12.594,2.375 -0.01,0.002 -0.0212,-0.002 -0.0312,0 -2.0664,0.40586 -4.0697,0.80417 -6.0937,1.2188 -6.0614,1.2416 -11.934,2.516 -17.5,3.7812 -0.0101,0.002 -0.0211,-0.002 -0.0312,0 -3.7165,0.8449 -7.2872,1.6752 -10.719,2.5 -6.8638,1.6484 -13.115,3.2346 -18.531,4.6562 -8.1236,2.1325 -14.382,3.9272 -18.094,5 -2.4736,0.71578 -3.8125,1.125 -3.8125,1.125 l -13.687,3.75 c -0.9024,0.24873 -1.7781,0.6929 -2.625,1.3125 -0.28771,0.2105 -0.56234,0.43593 -0.84374,0.6875 -1.0996,0.9796 -2.151,2.2707 -3.1562,3.8438 -0.0046,0.007 0.0046,0.0243 0,0.0312 -0.50036,0.78473 -1.0225,1.6405 -1.5,2.5625 -0.0042,0.008 0.0042,0.0232 0,0.0312 -0.47757,0.9237 -0.95114,1.9142 -1.4062,2.9688 -0.0037,0.009 0.0037,0.0222 0,0.0312 -3.667,8.5095 -6.62,21.131 -8.9374,36.219 -0.0015,0.01 0.0015,0.0212 0,0.0312 -0.03595,0.23416 -0.0581,0.48342 -0.09375,0.71875 -0.50462,3.3315 -0.99204,6.7982 -1.4375,10.344 -0.03048,0.24265 -0.06355,0.47519 -0.09375,0.71875 -0.50157,4.0432 -0.94672,8.2025 -1.375,12.469 -0.001,0.01 9.99e-4,0.0211 0,0.0312 -0.21354,2.1284 -0.42912,4.2948 -0.62499,6.4688 -9.21e-4,0.01 9.21e-4,0.0209 0,0.0312 -0.19581,2.1743 -0.38397,4.3492 -0.56249,6.5625 -8.26e-4,0.01 8.25e-4,0.0209 0,0.0312 -0.35775,4.4376 -0.67817,8.9458 -0.96874,13.5 -6.56e-4,0.0101 6.55e-4,0.0209 0,0.0312 -0.8726,13.684 -1.4596,27.789 -1.7812,41.562 -2.45e-4,0.0104 2.44e-4,0.0207 0,0.0312 -0.21443,9.1894 -0.3126,18.213 -0.3126,26.907 0,0.96763 0.02755,1.9629 0.03125,2.9375 -0.0037,0.97462 -0.03125,1.9699 -0.03125,2.9375 0,8.6932 0.09816,17.717 0.3125,26.906 2.44e-4,0.0105 -2.45e-4,0.0208 0,0.0312 0.32165,13.774 0.90864,27.878 1.7812,41.562 6.55e-4,0.0103 -6.56e-4,0.0211 0,0.0312 0.29057,4.5542 0.61099,9.0624 0.96874,13.5 8.25e-4,0.0103 -8.26e-4,0.0211 0,0.0312 0.17852,2.2133 0.36668,4.3882 0.56249,6.5625 9.21e-4,0.0103 -9.21e-4,0.0211 0,0.0312 0.19588,2.174 0.41145,4.3404 0.62499,6.4688 9.99e-4,0.0102 -0.001,0.0211 0,0.0312 0.42826,4.2663 0.87342,8.4256 1.375,12.469 0.0302,0.24356 0.06327,0.4761 0.09375,0.71875 0.44545,3.5456 0.93287,7.0123 1.4375,10.344 0.03565,0.23533 0.0578,0.48459 0.09375,0.71875 0.0015,0.01 -0.0015,0.0215 0,0.0312 2.3174,15.087 5.2704,27.709 8.9374,36.219 0.0037,0.009 -0.0037,0.0226 0,0.0312 0.45509,1.0546 0.92866,2.045 1.4062,2.9688 0.0042,0.008 -0.0042,0.0231 0,0.0312 0.47753,0.92204 0.99962,1.7778 1.5,2.5625 0.0046,0.007 -0.0046,0.0242 0,0.0312 1.0052,1.5731 2.0566,2.8642 3.1562,3.8438 0.2814,0.25157 0.55603,0.477 0.84374,0.6875 0.84686,0.6196 1.7226,1.0638 2.625,1.3125 l 13.687,3.75 c 0,0 1.3388,0.40922 3.8125,1.125 3.7111,1.0728 9.97,2.8675 18.094,5 5.4157,1.4217 11.667,3.0078 18.531,4.6562 3.4314,0.82484 7.0022,1.6551 10.719,2.5 0.0102,0.002 0.0211,-0.002 0.0312,0 5.5661,1.2652 11.438,2.5396 17.5,3.7812 2.024,0.41458 4.0273,0.81289 6.0937,1.2188 0.0101,0.002 0.0212,-0.002 0.0312,0 4.1232,0.80965 8.3399,1.6184 12.594,2.375 4.264,0.75843 8.5935,1.4755 12.937,2.1562 4.3439,0.68073 8.6898,1.3277 13.062,1.9062 0.0102,10e-4 0.0211,-10e-4 0.0312,0 6.5486,0.86611 13.125,1.6191 19.594,2.1875 2.1597,0.18976 4.2994,0.34953 6.4374,0.5 4.276,0.30095 8.5053,0.53079 12.656,0.65625 4.1508,0.12546 8.4028,0.19403 12.719,0.21875 8.7859,0.0503 17.881,-0.11752 27.25,-0.40625 13.642,-0.42043 27.847,-1.1347 42.375,-2 19.604,-1.1676 39.798,-2.5923 60.124,-3.875 15.024,-0.94578 30.098,-1.8073 45.031,-2.4375 0.39612,-0.0168 0.79158,-0.0461 1.1875,-0.0625 7.3934,-0.30587 14.77,-0.55147 22.062,-0.71875 4.9787,-0.1142 9.9316,-0.18447 14.844,-0.21875 2.456,-0.0172 4.9073,-0.0365 7.3437,-0.0312 l 124.81,0.28125 -8.6562,35.938 3.5,1.5 c 1.7476,0.63259 4.9601,0.92851 6.4687,0.9375 0.8486,0.005 1.7551,-0.0741 2.6875,-0.25 0.31069,-0.0585 0.62352,-0.14105 0.93749,-0.21875 0.30459,-0.0756 0.63258,-0.15668 0.93749,-0.25 0.62844,-0.19306 1.2635,-0.42156 1.875,-0.6875 1.8215,-0.79351 3.5342,-1.9314 4.7812,-3.3125 0.01,-0.0107 0.0217,-0.0206 0.0312,-0.0312 0.6248,-0.6979 1.1123,-1.4512 1.4687,-2.2812 l 12.156,-31.312 109.94,0.25 c 0.7469,0.3739 1.4761,0.74511 2.2187,1.0938 2.9792,1.3995 5.911,2.597 8.8436,3.625 1.4623,0.51259 2.9178,0.97549 4.375,1.4062 5.1,1.5075 10.188,2.5515 15.344,3.25 2.9462,0.39932 5.9259,0.69388 8.9374,0.90625 1.5057,0.1061 3.034,0.18011 4.5624,0.25 3.057,0.13994 6.1386,0.21283 9.3124,0.25 6.3475,0.0741 12.979,0 20,0 10.41,0 20.322,-0.53122 29.781,-1.5625 3.7835,-0.41251 7.4911,-0.89749 11.125,-1.4688 7.2676,-1.1425 14.228,-2.6189 20.906,-4.375 1.6694,-0.43903 3.3357,-0.89874 4.9687,-1.375 4.899,-1.4288 9.6128,-3.0254 14.187,-4.7812 1.5248,-0.58527 3.042,-1.1605 4.5312,-1.7812 2.9783,-1.2414 5.882,-2.557 8.7186,-3.9375 1.4183,-0.69027 2.8355,-1.4006 4.2187,-2.125 2.7664,-1.4488 5.4668,-2.98 8.0937,-4.5625 1.3135,-0.79125 2.5961,-1.6135 3.875,-2.4375 6.3943,-4.1201 12.363,-8.6255 17.906,-13.531 4.4286,-3.9195 8.6015,-8.0798 12.5,-12.469 0.005,-0.006 -0.005,-0.0254 0,-0.0312 0.97044,-1.0929 1.937,-2.1916 2.875,-3.3125 0.005,-0.006 -0.005,-0.0251 0,-0.0312 0.93773,-1.1209 1.8757,-2.2578 2.7812,-3.4062 0.005,-0.006 -0.005,-0.0249 0,-0.0312 2.7256,-3.4582 5.3132,-7.0189 7.7499,-10.719 0.005,-0.007 -0.005,-0.024 0,-0.0312 0.80882,-1.2286 1.6289,-2.4644 2.4062,-3.7188 0.005,-0.008 -0.005,-0.0238 0,-0.0312 2.3405,-3.7781 4.5668,-7.6525 6.6249,-11.656 0.004,-0.008 -0.004,-0.0231 0,-0.0312 0.68299,-1.3292 1.3477,-2.6781 2,-4.0312 0.004,-0.008 -0.004,-0.0229 0,-0.0312 0.65204,-1.3533 1.316,-2.7169 1.9375,-4.0938 0.004,-0.009 -0.004,-0.0227 0,-0.0312 1.2464,-2.7625 2.438,-5.5517 3.5625,-8.4062 0.004,-0.009 -0.004,-0.0224 0,-0.0312 0.56023,-1.4229 1.0948,-2.8674 1.625,-4.3125 0.003,-0.009 -0.003,-0.0222 0,-0.0312 0.53002,-1.4452 1.0623,-2.908 1.5625,-4.375 0.49999,-1.4671 0.99842,-2.949 1.4687,-4.4375 0.003,-0.009 -0.003,-0.022 0,-0.0312 0.47013,-1.4886 0.93435,-2.9905 1.375,-4.5 0.003,-0.01 -0.003,-0.0217 0,-0.0312 0.44045,-1.5096 0.87009,-3.0324 1.2812,-4.5625 0.003,-0.01 -0.003,-0.0217 0,-0.0312 1.2381,-4.6101 2.3684,-9.306 3.34372,-14.094 v -0.0312 c 0.3236,-1.5894 0.6112,-3.2044 0.9063,-4.8125 v -0.0312 c 2.0747,-11.318 3.4621,-23.062 4.1562,-35.219 5e-4,-0.0103 -6e-4,-0.0211 0,-0.0312 0.098,-1.7279 0.1787,-3.4757 0.25,-5.2188 4e-4,-0.0103 -4e-4,-0.0211 0,-0.0312 0.1426,-3.4969 0.2467,-7.0072 0.2812,-10.562 0,-0.0103 -10e-5,-0.0211 0,-0.0312 0.017,-1.783 0.01,-3.578 0,-5.375 0,-0.6358 -0.022,-1.2714 -0.031,-1.9062 0.01,-0.63485 0.031,-1.2704 0.031,-1.9062 0.01,-1.797 0.017,-3.592 0,-5.375 -10e-5,-0.0102 0,-0.0209 0,-0.0312 -0.034,-3.5553 -0.1386,-7.0656 -0.2812,-10.562 -4e-4,-0.0102 4e-4,-0.0209 0,-0.0312 -0.071,-1.7431 -0.152,-3.4908 -0.25,-5.2188 -6e-4,-0.0102 5e-4,-0.0209 0,-0.0312 -0.6941,-12.157 -2.0815,-23.9 -4.1562,-35.219 v -0.0312 c -0.2951,-1.6081 -0.5827,-3.2231 -0.9063,-4.8125 v -0.0312 c -0.97539,-4.7878 -2.10562,-9.4836 -3.34372,-14.094 -0.003,-0.01 0.003,-0.0213 0,-0.0312 -0.41115,-1.5301 -0.84079,-3.0529 -1.2812,-4.5625 -0.003,-0.01 0.003,-0.0213 0,-0.0312 -0.44063,-1.5095 -0.90485,-3.0114 -1.375,-4.5 -0.003,-0.009 0.003,-0.0223 0,-0.0312 -0.47032,-1.4885 -0.96875,-2.9704 -1.4687,-4.4375 -0.50017,-1.467 -1.0325,-2.9298 -1.5625,-4.375 -0.003,-0.009 0.003,-0.0223 0,-0.0312 -0.53021,-1.4451 -1.0648,-2.8896 -1.625,-4.3125 -0.004,-0.009 0.004,-0.0223 0,-0.0312 -1.1244,-2.8546 -2.3161,-5.6438 -3.5625,-8.4062 -0.004,-0.008 0.004,-0.0223 0,-0.0312 -0.62148,-1.3768 -1.2854,-2.7405 -1.9375,-4.0938 -0.004,-0.008 0.004,-0.0233 0,-0.0312 -0.65224,-1.3532 -1.317,-2.7021 -2,-4.0312 -0.004,-0.008 0.004,-0.0233 0,-0.0312 -2.0582,-4.0038 -4.2844,-7.8782 -6.6249,-11.656 -0.005,-0.007 0.005,-0.0233 0,-0.0312 -0.77733,-1.2543 -1.5974,-2.4902 -2.4062,-3.7188 -0.005,-0.007 0.005,-0.0242 0,-0.0312 -2.4367,-3.6999 -5.0243,-7.2606 -7.7499,-10.719 -0.005,-0.006 0.005,-0.0253 0,-0.0312 -0.90549,-1.1485 -1.8435,-2.2853 -2.7812,-3.4062 -0.005,-0.006 0.005,-0.0253 0,-0.0312 -0.93801,-1.1209 -1.9045,-2.2196 -2.875,-3.3125 -0.005,-0.006 0.005,-0.0253 0,-0.0312 -3.8983,-4.3889 -8.0712,-8.5493 -12.5,-12.469 -5.543,-4.9058 -11.512,-9.4112 -17.906,-13.531 -1.2789,-0.82402 -2.5615,-1.6462 -3.875,-2.4375 -2.6269,-1.5825 -5.3273,-3.1137 -8.0937,-4.5625 -1.3832,-0.72439 -2.8004,-1.4347 -4.2187,-2.125 -2.8367,-1.3806 -5.7403,-2.6961 -8.7186,-3.9375 -1.4892,-0.62071 -3.0064,-1.196 -4.5312,-1.7812 -4.5746,-1.7558 -9.2883,-3.3525 -14.187,-4.7812 -1.633,-0.47626 -3.2993,-0.93597 -4.9687,-1.375 -6.6777,-1.7561 -13.638,-3.2325 -20.906,-4.375 -3.6338,-0.57126 -7.3414,-1.0562 -11.125,-1.4688 -9.4586,-1.0326 -19.371,-1.5638 -29.781,-1.5638 -7.0204,0 -13.652,-0.0741 -20,0 -3.1738,0.0372 -6.2554,0.11006 -9.3124,0.25 -1.5285,0.0699 -3.0568,0.1439 -4.5624,0.25 -3.0115,0.21237 -5.9912,0.50693 -8.9374,0.90625 -5.1556,0.69849 -10.244,1.7425 -15.344,3.25 -1.4572,0.43076 -2.9127,0.89366 -4.375,1.4062 -2.9327,1.028 -5.8645,2.2255 -8.8436,3.625 -0.74267,0.34864 -1.4718,0.71985 -2.2187,1.0938 l -109.94,0.25 -12.156,-31.312 c -0.35644,-0.83 -0.84393,-1.5834 -1.4687,-2.2812 -0.01,-0.0105 -0.0213,-0.0206 -0.0312,-0.0312 -1.247,-1.3811 -2.9597,-2.519 -4.7812,-3.3125 -0.61146,-0.26594 -1.2465,-0.49444 -1.875,-0.6875 -0.30491,-0.0933 -0.6329,-0.1744 -0.93749,-0.25 -0.31402,-0.0777 -0.62685,-0.16025 -0.93754,-0.21875 -0.9324,-0.1759 -1.8389,-0.255 -2.6875,-0.25 z"
         id="path3855"
         style="fill-opacity:0.99607999;stroke:#191919;stroke-width:14" />
      <path
         d="m 610.52,493.69 c -1.5086,0.009 -4.7211,0.30611 -6.4687,0.9375 l -3.5,1.5 8.6562,35.844 -124.81,0.28125 c -77.963,0.1654 -166.52,-11.504 -232.93,-9.5 -66.412,2.0037 -152.12,28 -152.12,28 l -13.687,3.7812 c -19.251,5.2963 -25.718,97.367 -25.718,166.78 0,1.113 0.02665,2.2531 0.03125,3.375 -0.0046,1.1219 -0.03125,2.262 -0.03125,3.375 0,69.414 6.4673,161.48 25.718,166.78 l 13.687,3.7812 c 0,0 85.711,25.996 152.12,28 66.412,2.0037 154.97,-9.6654 232.93,-9.5 l 124.81,0.28125 -8.6562,35.844 3.5,1.5 c 1.7476,0.63139 4.96,0.92854 6.4687,0.9375 0.84859,0.005 1.7551,-0.0744 2.6875,-0.25 0.3107,-0.0584 0.62352,-0.14119 0.93749,-0.21875 0.30459,-0.0754 0.63259,-0.15686 0.93749,-0.25 0.62844,-0.19269 1.2635,-0.42206 1.875,-0.6875 1.8215,-0.79201 3.5342,-1.9028 4.7812,-3.2812 0.01,-0.0107 0.0217,-0.0208 0.0312,-0.0312 0.6248,-0.69658 1.1123,-1.4528 1.4687,-2.2812 l 12.156,-31.25 109.94,0.25 c 23.9,11.942 45.511,10.719 73.593,10.719 133.25,0 187.63002,-86.586 187.00002,-201.38 0,-0.7802 -0.019,-1.5656 -0.031,-2.3438 0.012,-0.77811 0.031,-1.5636 0.031,-2.3438 0.6282,-114.79 -53.74902,-201.38 -187.00002,-201.38 -28.082,0 -49.693,-1.2236 -73.593,10.719 l -109.94,0.25 -12.156,-31.25 c -0.35645,-0.82844 -0.84393,-1.5847 -1.4687,-2.2812 -0.01,-0.0104 -0.0213,-0.0206 -0.0312,-0.0312 -1.247,-1.3785 -2.9597,-2.4892 -4.7812,-3.2812 -0.61148,-0.26544 -1.2465,-0.49481 -1.875,-0.6875 -0.3049,-0.0931 -0.6329,-0.1746 -0.93749,-0.25 -0.31397,-0.0776 -0.62679,-0.16035 -0.93749,-0.21875 -0.93239,-0.1756 -1.8389,-0.255 -2.6875,-0.25 z"
         id="path2853"
         style="fill:#17b900;fill-opacity:0.99607999" />
      <path
         d="m 400.34,855.24 c -33.364,0 -65.307,1.8 -94.811,5.0625 25.66,48.714 97.985,30.265 205.56,31.531 49.686,0.58471 89.543,1.8793 121.53,2.375 -47.16,-23.334 -133.53,-38.969 -232.28,-38.969 z"
         id="path3643"
         style="opacity:0.9;fill:#262626;fill-opacity:0.99607999" />
      <path
         d="m 400.34,855.24 c -3.2064,0 -6.3831,0.0295 -9.5624,0.0625 0.81825,16.171 6.4281,30.257 14.594,38.844 4.6714,-0.0756 9.4951,-0.19655 14.437,-0.34375 -8.5657,-8.1923 -14.593,-22.228 -15.719,-38.562 -1.2512,-0.005 -2.4947,0 -3.75,0 z"
         id="path3658"
         style="opacity:0.5;fill-opacity:0.99607999" />
      <path
         d="m 989.02,827.5 -5.0937,0.59375 c -21.545,2.5127 -37.688,25.979 -39.281,54.531 l -0.37499,7.125 5.2499,-4.8438 c 15.889,-14.68 28.303,-32.507 37.406,-52.75 l 2.09,-4.65 z"
         id="path3707"
         style="text-indent:0;text-transform:none;block-progression:tb;color:#000000;fill:#212121;stroke:#191919;stroke-width:5" />
      <path
         d="m 783.47,838.5 c 0,0 79.677,-22.596 105.38,-31.982 26.839,-9.8018 98.859,-39.146 98.859,-39.146 0,0 -8.7409,42.47 -30.483,57.918 -77.23,54.87 -232.69,53.85 -232.69,53.85"
         id="path3715"
         style="opacity:0.5;fill:none;stroke:#292929;stroke-width:6;stroke-linecap:round;stroke-linejoin:round" />
      <path
         d="m 869.97,817.84 -4.4374,2.3438 c 0.98912,1.1568 1.7955,2.4286 2.375,3.8438 4.7979,11.717 -10.736,29.236 -26.875,35.781 -0.51675,0.20958 -1.8129,0.84066 -3.4062,1.6562 l 13.625,-3.875 c 17.306,-8.4576 27.47,-23.082 23,-34 -0.91615,-2.2373 -2.3752,-4.1661 -4.2812,-5.75 z"
         id="path3757"
         style="fill:url(#linearGradient4149)" />
      <path
         d="m 878.55,813.38 -4.4375,2.3438 c 0.98913,1.1568 1.7955,2.4286 2.375,3.8438 4.7979,11.717 -10.736,29.236 -26.875,35.781 -0.51676,0.20958 -1.8129,0.84066 -3.4062,1.6562 l 13.625,-3.875 c 17.306,-8.4576 27.47,-23.082 23,-34 -0.91615,-2.2373 -2.3752,-4.1661 -4.2812,-5.75 z"
         id="path3787"
         style="fill:url(#linearGradient4203)" />
      <path
         d="m 884.74,811.96 -4.4374,2.3438 c 0.98913,1.1568 1.7955,2.4286 2.375,3.8438 4.7979,11.717 -10.736,29.236 -26.875,35.781 -0.51675,0.20958 -1.8129,0.84066 -3.4062,1.6562 l 13.625,-3.875 c 17.306,-8.4576 27.47,-23.082 23,-34 -0.91615,-2.2373 -2.3752,-4.1661 -4.2812,-5.75 z"
         id="path3752"
         style="fill:url(#linearGradient4155)" />
      <path
         d="m 901.65,807.69 -6.1874,1.8438 c 0.96015,1.7128 1.6545,3.5323 2.0312,5.4688 3.1194,16.034 -20.962,34.284 -43.031,38.5 -3.395,0.64864 -28.884,8.576 -32.158,8.8044 v 4.125 l 41.439,-12.148 c 26.285,-5.4963 44.949,-22.448 41.875,-38.25 -0.59564,-3.0616 -1.956,-5.8595 -3.9687,-8.3438 z"
         id="path3735"
         style="fill:url(#linearGradient4205)" />
      <path
         d="m 901.65,807.69 -6.1874,1.8438 c 0.96015,1.7128 1.6545,3.5323 2.0312,5.4688 3.1194,16.034 -20.962,34.284 -43.031,38.5 -3.395,0.64864 -28.884,8.576 -32.158,8.8044 v 4.125 l 41.439,-12.148 c 26.285,-5.4963 44.949,-22.448 41.875,-38.25 -0.59564,-3.0616 -1.956,-5.8595 -3.9687,-8.3438 z"
         id="path3783"
         style="fill:url(#linearGradient4207)" />
      <path
         d="m 857.12,822.46 -3.9641,2.0937 c 0.88361,1.0334 1.604,2.1696 2.1216,3.4337 4.2861,10.467 -9.5906,26.117 -24.008,31.964 -0.46163,0.18723 -1.6195,0.75098 -3.0428,1.4796 l 12.171,-3.4616 c 15.46,-7.5554 24.54,-20.62 20.546,-30.373 -0.81842,-1.9987 -2.1218,-3.7216 -3.8245,-5.1366 z"
         id="path3799"
         style="fill:url(#linearGradient4209)" />
      <path
         d="m 843.32,826.03 -3.9641,2.0937 c 0.88361,1.0334 1.604,2.1696 2.1216,3.4337 4.2861,10.467 -9.5906,26.117 -24.008,31.964 -0.46162,0.18723 -1.6195,0.75098 -3.0428,1.4796 l 12.171,-3.4616 c 15.46,-7.5554 24.54,-20.62 20.546,-30.373 -0.81842,-1.9987 -2.1218,-3.7216 -3.8245,-5.1366 z"
         id="path3803"
         style="fill:url(#linearGradient4153)" />
      <path
         d="m 233.27,845.72 c 8.293,-2.0234 15.486,-1.4788 19.797,5.7872 l -2.4934,17.897 c -6.8751,6.1732 -13.75,4.9509 -20.625,0.15543 l 3.3212,-23.839 z"
         id="rect3861"
         style="fill:url(#linearGradient4211)" />
      <path
         d="m 253.54,848.99 c 8.1502,-1.2102 15.167,-0.5728 18.843,5.5081 l -2.3731,17.034 c -6.4839,2.9748 -12.983,5.2096 -19.631,0.14793 l 3.1611,-22.69 z"
         id="path3864"
         style="fill:url(#linearGradient4213)" />
      <path
         d="m 400.34,852.75 c -33.454,0 -65.492,1.7894 -95.093,5.0625 l -3.6562,0.40625 1.7187,3.25 c 6.6711,12.664 16.562,21.113 29.062,26.438 12.501,5.3241 27.572,7.6126 45.093,8.4375 35.042,1.6498 79.954,-2.6312 133.59,-2 49.659,0.58438 89.508,1.8787 121.53,2.375 l 1.125,-4.75 c -47.84,-23.68 -134.34,-39.22 -233.36,-39.22 z m 0,5 c 91.169,0 171.75,13.479 220.09,33.719 -29.952,-0.58241 -65.212,-1.606 -109.31,-2.125 -53.937,-0.63473 -98.976,3.6522 -133.4,2.0312 -17.214,-0.81046 -31.767,-3.1054 -43.406,-8.0625 -10.453,-4.4521 -18.485,-11.154 -24.5,-20.906 28.307,-2.9831 58.735,-4.6562 90.53,-4.6562 z"
         id="path4025"
         style="text-indent:0;text-transform:none;block-progression:tb;opacity:0.9;color:#000000;fill:#191919" />
      <path
         d="m 260.5,607.38 -77.749,12.469 c -27.15,4.3542 -48.947,48.773 -50.999,104.84 2.0523,56.071 23.849,100.49 50.999,104.84 l 77.749,12.469 c 13.296,0 24,-10.704 24,-24 v -186.62 c 0,-13.296 -10.704,-24 -24,-24 z"
         id="rect2864"
         style="opacity:0.9;fill:#262626;fill-opacity:0.99607999;stroke:#191919;stroke-width:5" />
      <path
         d="m 691.96,573.16 c -2.9692,0 -5.8933,0.33215 -8.7812,0.96875 -0.0104,-0.01 -0.0208,-0.021 -0.0312,-0.0312 l -63.843,12.312 c -17.728,6.6047 -32,14.272 -32,32 v 212.56 c 0,17.728 14.272,25.395 32,32 l 63.843,12.312 c 0.0105,-0.0102 0.0208,-0.0211 0.0312,-0.0312 2.8879,0.6366 5.812,0.96875 8.7812,0.96875 45.395,0 82.198,-57.363 82.312,-151.53 -0.11408,-94.169 -36.916,-151.53 -82.312,-151.53 z"
         id="path3703"
         style="opacity:0.9;fill:#262626;fill-opacity:0.99607999;stroke:#191919;stroke-width:5" />
      <path
         d="m 400.34,594.15 c -33.364,0 -65.307,-1.8 -94.811,-5.0625 25.66,-48.714 97.985,-30.265 205.56,-31.531 49.686,-0.58471 89.543,-1.8793 121.53,-2.375 -47.16,23.334 -133.53,38.969 -232.28,38.969 z"
         id="path4157"
         style="opacity:0.9;fill:#262626;fill-opacity:0.99607999" />
      <path
         d="m 400.34,594.15 c -3.2064,0 -6.3831,-0.0295 -9.5624,-0.0625 0.81825,-16.171 6.4281,-30.257 14.594,-38.844 4.6714,0.0756 9.4951,0.19655 14.437,0.34375 -8.5657,8.1923 -14.593,22.228 -15.719,38.562 -1.2512,0.005 -2.4947,0 -3.75,0 z"
         id="path4159"
         style="opacity:0.5;fill-opacity:0.99607999" />
      <path
         d="m 989.02,621.89 -5.0937,-0.59375 c -21.545,-2.5127 -37.688,-25.979 -39.281,-54.531 l -0.37499,-7.125 5.2499,4.8438 c 15.889,14.68 28.303,32.507 37.406,52.75 l 2.0937,4.6562 z"
         id="path4161"
         style="text-indent:0;text-transform:none;block-progression:tb;color:#000000;fill:#212121;stroke:#191919;stroke-width:5" />
      <path
         d="m 783.47,610.89 c 0,0 79.677,22.596 105.38,31.982 26.839,9.8018 98.859,39.146 98.859,39.146 0,0 -8.7409,-42.47 -30.483,-57.918 -77.23,-54.87 -232.69,-53.86 -232.69,-53.86"
         id="path4163"
         style="opacity:0.5;fill:none;stroke:#292929;stroke-width:6;stroke-linecap:round;stroke-linejoin:round" />
      <path
         d="m 869.97,631.55 -4.4374,-2.3438 c 0.98912,-1.1568 1.7955,-2.4286 2.375,-3.8438 4.7979,-11.717 -10.736,-29.236 -26.875,-35.781 -0.51675,-0.20958 -1.8129,-0.84066 -3.4062,-1.6562 l 13.625,3.875 c 17.306,8.4576 27.47,23.082 23,34 -0.91615,2.2373 -2.3752,4.1661 -4.2812,5.75 z"
         id="path4165"
         style="fill:url(#linearGradient4185)" />
      <path
         d="m 878.55,636.01 -4.4375,-2.3438 c 0.98913,-1.1568 1.7955,-2.4286 2.375,-3.8438 4.7979,-11.717 -10.736,-29.236 -26.875,-35.781 -0.51676,-0.20958 -1.8129,-0.84066 -3.4062,-1.6562 l 13.625,3.875 c 17.306,8.4576 27.47,23.082 23,34 -0.91615,2.2373 -2.3752,4.1661 -4.2812,5.75 z"
         id="path4167"
         style="fill:url(#linearGradient4187)" />
      <path
         d="m 884.74,637.42 -4.4374,-2.3438 c 0.98913,-1.1568 1.7955,-2.4286 2.375,-3.8438 4.7979,-11.717 -10.736,-29.236 -26.875,-35.781 -0.51675,-0.20958 -1.8129,-0.84066 -3.4062,-1.6562 l 13.625,3.875 c 17.306,8.4576 27.47,23.082 23,34 -0.91615,2.2373 -2.3752,4.1661 -4.2812,5.75 z"
         id="path4169"
         style="fill:url(#linearGradient4189)" />
      <path
         d="m 901.65,641.7 -6.1874,-1.8438 c 0.96015,-1.7128 1.6545,-3.5323 2.0312,-5.4688 3.1194,-16.034 -20.962,-34.284 -43.031,-38.5 -3.395,-0.64864 -28.884,-8.576 -32.158,-8.8044 v -4.125 l 41.439,12.148 c 26.285,5.4963 44.949,22.448 41.875,38.25 -0.59564,3.0616 -1.956,5.8595 -3.9687,8.3438 z"
         id="path4171"
         style="fill:url(#linearGradient4191)" />
      <path
         d="m 901.65,641.7 -6.1874,-1.8438 c 0.96015,-1.7128 1.6545,-3.5323 2.0312,-5.4688 3.1194,-16.034 -20.962,-34.284 -43.031,-38.5 -3.395,-0.64864 -28.884,-8.576 -32.158,-8.8044 v -4.125 l 41.439,12.148 c 26.285,5.4963 44.949,22.448 41.875,38.25 -0.59564,3.0616 -1.956,5.8595 -3.9687,8.3438 z"
         id="path4173"
         style="fill:url(#linearGradient4193)" />
      <path
         d="m 857.12,626.93 -3.9641,-2.0937 c 0.88361,-1.0334 1.604,-2.1696 2.1216,-3.4337 4.2861,-10.467 -9.5906,-26.117 -24.008,-31.964 -0.46163,-0.18723 -1.6195,-0.75098 -3.0428,-1.4796 l 12.171,3.4616 c 15.46,7.5554 24.54,20.62 20.546,30.373 -0.81842,1.9987 -2.1218,3.7216 -3.8245,5.1366 z"
         id="path4175"
         style="fill:url(#linearGradient4195)" />
      <path
         d="m 843.32,623.36 -3.9641,-2.0937 c 0.88361,-1.0334 1.604,-2.1696 2.1216,-3.4337 4.2861,-10.467 -9.5906,-26.117 -24.008,-31.964 -0.46162,-0.18723 -1.6195,-0.75098 -3.0428,-1.4796 l 12.171,3.4616 c 15.46,7.5554 24.54,20.62 20.546,30.373 -0.81842,1.9987 -2.1218,3.7216 -3.8245,5.1366 z"
         id="path4177"
         style="fill:url(#linearGradient4197)" />
      <path
         d="m 233.27,603.66 c 8.293,2.0234 15.486,1.4788 19.797,-5.7872 l -2.4934,-17.897 c -6.8751,-6.1732 -13.75,-4.9509 -20.625,-0.15543 l 3.3212,23.839 z"
         id="path4179"
         style="fill:url(#linearGradient4199)" />
      <path
         d="m 253.54,600.4 c 8.1502,1.2102 15.167,0.5728 18.843,-5.5081 l -2.3731,-17.034 c -6.4839,-2.9748 -12.983,-5.2096 -19.631,-0.14793 l 3.1611,22.69 z"
         id="path4181"
         style="fill:url(#linearGradient4201)" />
      <path
         d="m 400.34,596.64 c -33.454,0 -65.492,-1.7894 -95.093,-5.0625 l -3.6562,-0.40625 1.7187,-3.25 c 6.6711,-12.664 16.562,-21.113 29.062,-26.438 12.501,-5.3241 27.572,-7.6126 45.093,-8.4375 35.042,-1.6498 79.954,2.6312 133.59,2 49.659,-0.58438 89.508,-1.8787 121.53,-2.375 l 1.125,4.75 c -47.849,23.675 -134.36,39.219 -233.37,39.219 z m 0,-5 c 91.169,0 171.75,-13.479 220.09,-33.719 -29.952,0.58241 -65.212,1.606 -109.31,2.125 -53.937,0.63473 -98.976,-3.6522 -133.4,-2.0312 -17.214,0.81046 -31.767,3.1054 -43.406,8.0625 -10.453,4.4521 -18.485,11.154 -24.5,20.906 28.307,2.9831 58.735,4.6562 90.53,4.6562 z"
         id="path4183"
         style="text-indent:0;text-transform:none;block-progression:tb;opacity:0.9;color:#000000;fill:#191919" />
    </g>
  </g>
  <metadata
     id="metadata60">
    <rdf:RDF>
      <cc:Work>
        <dc:format>image/svg+xml</dc:format>
        <dc:type
           rdf:resource="http://purl.org/dc/dcmitype/StillImage" />
        <cc:license
           rdf:resource="http://creativecommons.org/licenses/publicdomain/" />
        <dc:publisher>
          <cc:Agent
             rdf:about="http://openclipart.org/">
            <dc:title>Openclipart</dc:title>
          </cc:Agent>
        </dc:publisher>
        <dc:title>Red Car - Top View</dc:title>
        <dc:date>2010-05-19T15:02:12</dc:date>
        <dc:description>I was thinking of Trophy ( http://trophy.sourceforge.net/index.php?body=screenshots ) when remixing this one :)</dc:description>
        <dc:source>http://openclipart.org/detail/61201/red-racing-car-top-view-by-qubodup</dc:source>
        <dc:creator>
          <cc:Agent>
            <dc:title>qubodup</dc:title>
          </cc:Agent>
        </dc:creator>
        <dc:subject>
          <rdf:Bag>
            <rdf:li>car</rdf:li>
            <rdf:li>clip art</rdf:li>
            <rdf:li>clipart</rdf:li>
            <rdf:li>game</rdf:li>
            <rdf:li>game sprite</rdf:li>
            <rdf:li>racing</rdf:li>
            <rdf:li>racing car</rdf:li>
            <rdf:li>red</rdf:li>
            <rdf:li>red car</rdf:li>
            <rdf:li>simple</rdf:li>
            <rdf:li>simple car</rdf:li>
            <rdf:li>sprite</rdf:li>
            <rdf:li>transport</rdf:li>
            <rdf:li>transportation</rdf:li>
            <rdf:li>travel</rdf:li>
            <rdf:li>video game</rdf:li>
            <rdf:li>video game art</rdf:li>
            <rdf:li>video game sprite</rdf:li>
          </rdf:Bag>
        </dc:subject>
      </cc:Work>
      <cc:License
         rdf:about="http://creativecommons.org/licenses/publicdomain/">
        <cc:permits
           rdf:resource="http://creativecommons.org/ns#Reproduction" />
        <cc:permits
           rdf:resource="http://creativecommons.org/ns#Distribution" />
        <cc:permits
           rdf:resource="http://creativecommons.org/ns#DerivativeWorks" />
      </cc:License>
    </rdf:RDF>
  </metadata>
</svg>

  `);


    // 💀 Hazard (red warning)
    this.hazardImg.src = svg(`
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="64" height="64">
<path d="M0 0 C4.60091812 2.17938227 6.70163631 4.51819081 9 9 C9.66 9.99 10.32 10.98 11 12 C11.83004887 17.65942411 11.09416302 22.12074292 8 27 C7.34 27.66 6.68 28.32 6 29 C5.35232207 31.57061311 5.35232207 31.57061311 5 34 C7.97 33.505 7.97 33.505 11 33 C16.05908096 39.07439825 16.05908096 39.07439825 15.8125 42.9375 C15.544375 43.618125 15.27625 44.29875 15 45 C14.13375 45.12375 13.2675 45.2475 12.375 45.375 C6.76021214 46.23565191 6.76021214 46.23565191 2 49 C6.22949995 51.41685712 9.12335991 52.34833144 14 52 C15.25 54.0625 15.25 54.0625 16 57 C14.95421827 59.60906369 13.57355686 61.63966471 12 64 C10.02 64 8.04 64 6 64 C5.855625 63.278125 5.71125 62.55625 5.5625 61.8125 C3.16577859 57.49840147 -0.40574441 55.62364342 -5 54 C-7.93961212 53.88861437 -10.10235593 54.31510231 -13 55 C-13.33 55.99 -13.66 56.98 -14 58 C-14.99 58.495 -14.99 58.495 -16 59 C-16.72159424 60.64363134 -17.39351421 62.31050386 -18 64 C-19.98 64 -21.96 64 -24 64 C-26.99481865 59.50777202 -26.99481865 59.50777202 -28 57 C-27.25 54.0625 -27.25 54.0625 -26 52 C-24.948125 52.061875 -23.89625 52.12375 -22.8125 52.1875 C-18.84183507 51.9922214 -17.15803031 51.29674932 -14 49 C-16.91765591 46.94047818 -18.49792817 46 -22.125 46 C-25 46 -25 46 -26.9375 44.8125 C-28 43 -28 43 -27.9375 40.625 C-26.82201191 37.50163334 -25.1869812 35.46917232 -23 33 C-21.02 33.33 -19.04 33.66 -17 34 C-18.16767116 30.04788223 -19.4487815 27.21675376 -22 24 C-23.72237197 18.8328841 -23.65561622 13.89400242 -21.875 8.75 C-16.169411 0.3818028 -9.71524883 -0.91437636 0 0 Z M-17 36 C-17 36.99 -17 37.98 -17 39 C-11.35260695 42.75242298 -11.35260695 42.75242298 -4.875 44.0625 C-1.27898674 42.73353858 1.74070977 41.02075994 5 39 C5 38.34 5 37.68 5 37 C-2.26 36.67 -9.52 36.34 -17 36 Z " fill="#080201" transform="translate(38,0)"/>
<path d="M0 0 C3.31397851 1.32065438 6.34547021 2.69094042 8 6 C8.99 6.33 9.98 6.66 11 7 C11.56270112 13.8024313 11.57596678 18.50677631 7.19140625 23.953125 C5.46297229 26.62777668 5.46297229 26.62777668 5 33 C-0.94 33 -6.88 33 -13 33 C-13.33 30.69 -13.66 28.38 -14 26 C-15.12211903 23.81094817 -15.12211903 23.81094817 -16.5625 22 C-19.10700047 18.16105888 -19.76501723 15.67510527 -19 11 C-15.73779528 2.3615361 -9.12579968 -1.61322629 0 0 Z " fill="#ED4844" transform="translate(36,2)"/>
<path d="M0 0 C1.32 0 2.64 0 4 0 C5.4606285 2.64738916 6 3.89448334 6 7 C4.63875 6.938125 4.63875 6.938125 3.25 6.875 C0.08989353 6.99654256 -1.48395457 7.13626265 -4 9 C-4.80528889 11.05000871 -4.80528889 11.05000871 -5 13 C-0.77050005 15.41685712 2.12335991 16.34833144 7 16 C8.25 18.0625 8.25 18.0625 9 21 C7.95421827 23.60906369 6.57355686 25.63966471 5 28 C3.02 28 1.04 28 -1 28 C-1.144375 27.278125 -1.28875 26.55625 -1.4375 25.8125 C-3.86683291 21.43970077 -7.25145684 19.44764129 -12 18 C-16.91950995 18.16376531 -21.35692535 19.45230845 -26 21 C-26.33 22.65 -26.66 24.3 -27 26 C-30 25 -30 25 -32 22 C-32 20.68 -32 19.36 -32 18 C-30.96665527 18.06026367 -29.93331055 18.12052734 -28.86865234 18.18261719 C-24.67552803 17.98468351 -22.68994938 17.16999895 -19.1015625 15.078125 C-17.51794922 14.15773438 -17.51794922 14.15773438 -15.90234375 13.21875 C-14.82082031 12.5690625 -13.73929688 11.919375 -12.625 11.25 C-11.52027344 10.61578125 -10.41554688 9.9815625 -9.27734375 9.328125 C-3.69341743 6.52438843 -3.69341743 6.52438843 -0.18115234 1.78417969 C-0.12137207 1.19540039 -0.0615918 0.60662109 0 0 Z " fill="#0C0302" transform="translate(45,36)"/>
<path d="M0 0 C1.32 0 2.64 0 4 0 C4.144375 0.721875 4.28875 1.44375 4.4375 2.1875 C6.81403254 6.46525857 10.69639116 7.91903688 15 10 C14.64290225 12.68975242 14.29758271 13.75158868 12.1796875 15.51953125 C6.89967375 18.48170846 3.90457782 19.6331811 -2 18 C-1.01 20.31 -0.02 22.62 1 25 C1.66 25 2.32 25 3 25 C3.061875 24.38125 3.12375 23.7625 3.1875 23.125 C4 21 4 21 6.5625 19.75 C7.366875 19.5025 8.17125 19.255 9 19 C9 19.99 9 20.98 9 22 C8.34 22.33 7.68 22.66 7 23 C6.27840576 24.64363134 5.60648579 26.31050386 5 28 C3.02 28 1.04 28 -1 28 C-3.99481865 23.50777202 -3.99481865 23.50777202 -5 21 C-4.25 18.0625 -4.25 18.0625 -3 16 C-1.948125 16.061875 -0.89625 16.12375 0.1875 16.1875 C4.15816493 15.9922214 5.84196969 15.29674932 9 13 C6.08234409 10.94047818 4.50207183 10 0.875 10 C-2 10 -2 10 -3.875 8.5 C-4.24625 8.005 -4.6175 7.51 -5 7 C-4.67 6.01 -4.34 5.02 -4 4 C-3.01 3.67 -2.02 3.34 -1 3 C-0.67 2.01 -0.34 1.02 0 0 Z " fill="#0A0202" transform="translate(15,36)"/>
<path d="M0 0 C1.32 0 2.64 0 4 0 C5.4606285 2.64738916 6 3.89448334 6 7 C4.78570312 6.8453125 4.78570312 6.8453125 3.546875 6.6875 C-1.40809523 7.12406125 -4.61076472 9.37304108 -8.75 12 C-10.26339179 12.94110078 -11.77891691 13.87878237 -13.296875 14.8125 C-13.96041992 15.23144531 -14.62396484 15.65039062 -15.30761719 16.08203125 C-17 17 -17 17 -19 17 C-19.33 17.99 -19.66 18.98 -20 20 C-21.98 20.33 -23.96 20.66 -26 21 C-26.33 22.65 -26.66 24.3 -27 26 C-30 25 -30 25 -32 22 C-32 20.68 -32 19.36 -32 18 C-30.96665527 18.06026367 -29.93331055 18.12052734 -28.86865234 18.18261719 C-24.67552803 17.98468351 -22.68994938 17.16999895 -19.1015625 15.078125 C-17.51794922 14.15773438 -17.51794922 14.15773438 -15.90234375 13.21875 C-14.82082031 12.5690625 -13.73929688 11.919375 -12.625 11.25 C-11.52027344 10.61578125 -10.41554688 9.9815625 -9.27734375 9.328125 C-3.69341743 6.52438843 -3.69341743 6.52438843 -0.18115234 1.78417969 C-0.12137207 1.19540039 -0.0615918 0.60662109 0 0 Z " fill="#C8372E" transform="translate(45,36)"/>
<path d="M0 0 C0 0.66 0 1.32 0 2 C1.3303125 2.4021875 1.3303125 2.4021875 2.6875 2.8125 C5.85370905 3.94755607 8.36497607 4.907481 11 7 C11.3125 9.6875 11.3125 9.6875 11 12 C14.33537489 10.88820837 15.63707344 9.52588702 18 7 C18 10.10551666 17.4606285 11.35261084 16 14 C14.02 14 12.04 14 10 14 C9.855625 13.278125 9.71125 12.55625 9.5625 11.8125 C7.17369007 7.51264213 3.56126631 5.65661626 -1 4 C-3.64730806 3.88929439 -5.41183731 4.28412521 -8 5 C-8 4.34 -8 3.68 -8 3 C-5.09451118 0.95830515 -3.59857954 0 0 0 Z " fill="#080101" transform="translate(34,50)"/>
<path d="M0 0 C6.15234375 -0.09765625 6.15234375 -0.09765625 8 0 C9 1 9 1 9.1875 3.4375 C9 6 9 6 7 8 C4.12987704 8.36796448 2.59225382 8.37509409 0.125 6.8125 C-1 5 -1 5 -0.6875 2.3125 C-0.460625 1.549375 -0.23375 0.78625 0 0 Z " fill="#220909" transform="translate(34,16)"/>
<path d="M0 0 C2.05078125 0.03255208 4.1015625 0.06510417 6.15234375 0.09765625 C6.83984375 2.41015625 6.83984375 2.41015625 7.15234375 5.09765625 C6.02734375 6.91015625 6.02734375 6.91015625 4.15234375 8.09765625 C1.58984375 8.41015625 1.58984375 8.41015625 -0.84765625 8.09765625 C-2.84765625 6.09765625 -2.84765625 6.09765625 -3.03515625 3.53515625 C-2.77450145 0.14664384 -2.77450145 0.14664384 0 0 Z " fill="#2C0D0C" transform="translate(23.84765625,15.90234375)"/>
<path d="M0 0 C4.73684211 1.84210526 4.73684211 1.84210526 6.875 3.125 C9.92936174 4.38267836 12.73746159 4.12548225 16 4 C15.45276317 7.37462715 14.9451 9.08235 13 12 C12.01 12 11.02 12 10 12 C10 10.35 10 8.7 10 7 C9.278125 6.731875 8.55625 6.46375 7.8125 6.1875 C5.00233617 5.00098638 2.51583443 3.72514361 0 2 C0 1.34 0 0.68 0 0 Z " fill="#C72E1F" transform="translate(35,50)"/>
<path d="M0 0 C1.32 0 2.64 0 4 0 C4.144375 0.721875 4.28875 1.44375 4.4375 2.1875 C6.81403254 6.46525857 10.69639116 7.91903688 15 10 C13.2109375 10.62109375 13.2109375 10.62109375 11 11 C9.25779079 9.99984286 7.51724653 8.9947759 5.81640625 7.92578125 C3.18668589 6.58547216 0.88699496 6.71834196 -2 7 C-1.42415568 4.61435923 -0.77772405 2.33317216 0 0 Z " fill="#CC3020" transform="translate(15,36)"/>
<path d="M0 0 C0.91525561 3.08898768 1 5.79359799 1 9 C2.36636116 13.85431351 2.36636116 13.85431351 5 18 C5.14115161 20.67058851 5.04247107 23.32432238 5 26 C4.67 26 4.34 26 4 26 C3.938125 25.01 3.87625 24.02 3.8125 23 C3.37666657 19.72464571 2.3087955 17.70650648 0.4375 15 C-2.10332569 11.21079175 -2.62212139 8.62147316 -2 4 C-1 1.5625 -1 1.5625 0 0 Z " fill="#B92E21" transform="translate(19,9)"/>
<path d="M0 0 C0.99 0.33 1.98 0.66 3 1 C4.1875 3.5625 4.1875 3.5625 5 6 C4 7 4 7 0.9375 7.0625 C-0.031875 7.041875 -1.00125 7.02125 -2 7 C-2 3 -2 3 0 0 Z " fill="#330D0C" transform="translate(31,24)"/>
<path d="M0 0 C2.96175123 0.61277612 4.38058783 1.25372522 7 3 C6.34 4.65 5.68 6.3 5 8 C2 7 2 7 0 4 C0 2.68 0 1.36 0 0 Z " fill="#E84641" transform="translate(13,54)"/>
<path d="M0 0 C1.32 0 2.64 0 4 0 C5.4606285 2.64738916 6 3.89448334 6 7 C3.03 6.505 3.03 6.505 0 6 C0 4.02 0 2.04 0 0 Z " fill="#EC4742" transform="translate(45,36)"/>
<path d="M0 0 C4.03520597 1.58962659 8.01811282 3.28232318 12 5 C10.265625 6.140625 10.265625 6.140625 8 7 C5.859375 6.171875 5.859375 6.171875 3.75 4.75 C3.04359375 4.29109375 2.3371875 3.8321875 1.609375 3.359375 C1.07828125 2.91078125 0.5471875 2.4621875 0 2 C0 1.34 0 0.68 0 0 Z " fill="#AE2619" transform="translate(35,50)"/>
<path d="M0 0 C2.31 0 4.62 0 7 0 C6.34 1.32 5.68 2.64 5 4 C3.35 3.67 1.7 3.34 0 3 C0 2.01 0 1.02 0 0 Z " fill="#A32016" transform="translate(35,18)"/>
<path d="M0 0 C2.31 0 4.62 0 7 0 C6.67 1.32 6.34 2.64 6 4 C4.35 3.67 2.7 3.34 1 3 C0.67 2.01 0.34 1.02 0 0 Z " fill="#A42016" transform="translate(22,18)"/>
<path d="M0 0 C3.63 1.98 7.26 3.96 11 6 C7 7 7 7 5.078125 6.22265625 C3.38541667 5.1484375 1.69270833 4.07421875 0 3 C0 2.01 0 1.02 0 0 Z " fill="#B1271A" transform="translate(19,40)"/>
<path d="M0 0 C1.485 0.99 1.485 0.99 3 2 C6.12521833 2.16699232 6.12521833 2.16699232 9 2 C8.01 3.485 8.01 3.485 7 5 C4.5 5.3125 4.5 5.3125 2 5 C1.34 4.34 0.68 3.68 0 3 C0 2.01 0 1.02 0 0 Z " fill="#170504" transform="translate(21,19)"/>
</svg>
      `);
    await this.loadGiftImages();
    // Initialize world + stars
    this.fit();
    this.makeStars();

    // Add listeners
    // canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('resize', this.lastResizeHandler);

    this.ngZone.runOutsideAngular(() => {
      if (this.rafId != null) cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame((ts) => this.step(ts));
    });
  }

  private loadGiftImages(): Promise<void> {
    return new Promise((resolve) => {
      this.giftImages = [];
      const urls = this.contest?.game_config?.images || [];

      if (!urls.length) {
        console.warn('No gift images found in game config.');
        resolve();
        return;
      }

      let loadedCount = 0;
      urls.forEach((url: string) => {
        const img = new Image();
        img.src = url;
        img.onload = () => {
          loadedCount++;
          if (loadedCount === urls.length) resolve();
        };
        img.onerror = () => {
          console.error('Failed to load image:', url);
          loadedCount++;
          if (loadedCount === urls.length) resolve();
        };
        this.giftImages.push(img);
      });
    });
  }



  ngOnDestroy(): void {
    // cleanup
     if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('car-active');
    }
    this.removeKeyboardControls()
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    const canvas = this.canvasRef?.nativeElement;
    if (canvas) canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('resize', this.lastResizeHandler);

    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('popstate', this.handleBackNavigation);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
    this.pauseMusic();
  }

  // Template action
  restart(): void {
    this.reset();
  }

  private fit() {
    const canvas = this.canvasRef.nativeElement;
    const size = Math.min(700, Math.max(380, Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.9)));
    this.dpr = Math.max(1, (window.devicePixelRatio || 1));
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.width = Math.floor(size * this.dpr);
    canvas.height = Math.floor(size * this.dpr);

    // update world canvas references used in getters
    this.world._canvasWidth = canvas.width;
    this.world._canvasHeight = canvas.height;
    this.world.midR = Math.min(canvas.width, canvas.height) * 0.36;
  }

  private laneRadius(l: number) {
    const h = (this.world.thickness * this.dpr) / 2;
    const out = this.world.midR + h,
      inn = this.world.midR - h;
    const off = this.world.laneInset * (h - (this.world.carSize / 2) * this.dpr * 0.75);
    return l ? out - off : inn + off;
  }

  private bandRadii() {
    const h = (this.world.thickness * this.dpr) / 2;
    return [this.world.midR - h, this.world.midR + h];
  }

  private makeStars() {
    this.stars = Array.from({ length: 100 }, () => ({
      r: Math.random() * 2 * this.dpr + 0.6 * this.dpr,
      a: Math.random() * Math.PI * 2,
      dist: this.world.midR + (Math.random() * this.world.thickness * 2 - this.world.thickness) * this.dpr,
      h: (Math.random() * 360) | 0,
      spd: (Math.random() * 0.08 + 0.02) * (Math.random() < 0.5 ? -1 : 1),
      al: Math.random() * 0.6 + 0.3,
    }));
  }

  private doReset() {
    this.running = true;
    this.lastTs = 0;
    this.t = 0;
    this.score = 0;
    this.whooshTime = 0;
    this.car.theta = Math.random() * Math.PI * 2;
    this.car.lane = 1;
    this.car.targetLane = 1;
    this.car.switching = false;
    this.pickups['outer'] = [];
    this.pickups['inner'] = [];
    this.hazards['outer'] = [];
    this.hazards['inner'] = [];
    this.spawner.pTO = this.spawner.pTI = this.spawner.hTO = this.spawner.hTI = 0;
    this.makeStars();
    this.updateUI();
  }

  // pointer handling
  private onPointerDown = () => {
    // FIRST TAP — if waiting for user to tap to start the game, start now
    if (this.isWaitingForTapStart) {
      this.isWaitingForTapStart = false;
      this.running = true;
      this.playMusic();
      return;
    }
     if (!this.running) {
      return;
    }

    this.car.targetLane = this.car.targetLane ? 0 : 1;
    this.car.switching = true;
    this.car.lerp = 0;
  };

  // helpers
  private wrap(a: number) {
    return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  }
  private ahead(d: number) {
    return this.wrap(this.car.theta + (this.car.dir > 0 ? -d : d));
  }
  private randExp(m: number) {
    const u = Math.random();
    return Math.max(0.3, -Math.log(1 - u) * m * 0.9 + m * 0.1);
  }

  private spawnOne(set: any, which: string, img: HTMLImageElement) {
    const isHazard = img === this.hazardImg;
    const a = this.spawner.minA + Math.random() * (this.spawner.maxA - this.spawner.minA);
    const th = this.ahead(a);

    // 🧩 If it's a hazard, ensure it doesn't overlap too closely with others
    if (isHazard) {
      const allHazards = [...this.hazards['outer'], ...this.hazards['inner']];
      const tooClose = allHazards.some(h => Math.abs(h.theta - th) < this.MIN_HAZARD_GAP);

      // Skip this spawn if it's too close to another hazard
      if (tooClose) return;
    }

    // Normal spawn
    set[which].push({
      theta: th,
      img: img,
      label: isHazard ? '' : '',
      born: this.t
    });
  }

  private prune() {
    const keep = (o: any) => {
      const d = Math.abs(o.theta - this.car.theta);
      return d < Math.PI * 1.7;
    };
    ['outer', 'inner'].forEach((k) => {
      this.pickups[k] = this.pickups[k].filter(keep);
      this.hazards[k] = this.hazards[k].filter(keep);
    });
  }

  // drawing
  private drawBG(dt: number) {
    for (const s of this.stars) {
      s.a = this.wrap(s.a + s.spd * dt);
      const x = (this.world.cx as number) + Math.cos(s.a) * s.dist;
      const y = (this.world.cy as number) + Math.sin(s.a) * s.dist;
      this.ctx.beginPath();
      this.ctx.fillStyle = `hsla(${s.h},75%,65%,${s.al})`;
      this.ctx.arc(x, y, s.r, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawBand() {
    const [ri, ro] = this.bandRadii();

    // Draw the black road background
    const g = this.ctx.createRadialGradient(this.world.cx, this.world.cy, ri, this.world.cx, this.world.cy, ro);
    g.addColorStop(0, '#111');
    g.addColorStop(1, '#000');
    this.ctx.save();
    this.ctx.lineWidth = ro - ri;
    this.ctx.strokeStyle = g;
    this.ctx.beginPath();
    this.ctx.arc(this.world.cx, this.world.cy, this.world.midR, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();

    // Draw dashed white road markings
    const dashCount = 40; // how many dashes around the circle
    const dashAngle = (Math.PI * 2) / dashCount; // each dash segment
    const dashLength = dashAngle * 0.35; // how long each dash is (relative)
    const markRadius = this.world.midR; // mid-lane marking radius
    this.drawPowerSymbols();

    this.ctx.save();
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 4 * this.dpr;
    this.ctx.setLineDash([]); // ensure solid short lines

    for (let i = 0; i < dashCount; i++) {
      const startAngle = i * dashAngle;
      const endAngle = startAngle + dashLength;
      this.ctx.beginPath();
      this.ctx.arc(this.world.cx, this.world.cy, markRadius, startAngle, endAngle);
      this.ctx.stroke();
    }

    this.ctx.restore();

  }

  private drawSet(arr: any[], r: number, color: string) {
    for (const o of arr) {
      const x = this.world.cx + Math.cos(o.theta) * r;
      const y = this.world.cy + Math.sin(o.theta) * r;
      const sz = 35 * this.dpr;
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(o.theta + Math.PI / 2);
      this.ctx.drawImage(o.img, -sz / 2, -sz / 2, sz, sz);
      this.ctx.restore();
      this.ctx.save();
      this.ctx.font = `${14 * this.dpr}px system-ui`;
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = 0.8;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(o.label, x, y - 20 * this.dpr);
      this.ctx.restore();
    }
  }
  private drawScore() {
  if (!this.ctx) return;

  this.ctx.save();
  const scoreText = `Score: ${Math.floor(this.score)}`;

  // Background capsule inside circle
  const padding = 18 * this.dpr;
  const textWidth = this.ctx.measureText(scoreText).width;
  // const boxWidth = textWidth + padding * 2;
  // const boxHeight = 50 * this.dpr;

  const x = this.world.cx;
  const y = this.world.cy + (20 * this.dpr); // inside circle position

  // this.ctx.fillStyle = "rgba(0,0,0,0.45)";
  // this.ctx.fillRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight);

 this.ctx.fillStyle = '#2a682cff';
 this.ctx.font = `${22 * this.dpr}px system-ui`;
  this.ctx.textAlign = "center";
  this.ctx.fillText(scoreText, x, y + 10 * this.dpr);

  this.ctx.restore();
}



  private drawEntities() {
    const rO = this.laneRadius(1),
      rI = this.laneRadius(0);
    this.drawSet(this.pickups['outer'], rO, '#34d399');
    this.drawSet(this.pickups['inner'], rI, '#facc15');
    this.drawSet(this.hazards['outer'], rO, '#ef4444');
    this.drawSet(this.hazards['inner'], rI, '#ef4444');
  }

  private drawCar() {
    const r = this.laneRadius(this.car.lane >= 0.5 ? 1 : 0);
    const x = this.world.cx + Math.cos(this.car.theta) * r;
    const y = this.world.cy + Math.sin(this.car.theta) * r;
    const w = this.world.carSize * this.dpr;
    const h = this.world.carSize * 0.56 * this.dpr;
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(this.car.theta + Math.PI / 2);
    this.ctx.drawImage(this.carImg, -w / 2, -h / 2, w, h);
    this.ctx.restore();
  }

  private coll(a: any, b: any, r: number) {
    const dx = a.x - b.x,
      dy = a.y - b.y;
    return dx * dx + dy * dy <= r * r;
  }

  private checkPickups() {
    const rC = this.laneRadius(this.car.lane >= 0.5 ? 1 : 0);
    const cx = this.world.cx + Math.cos(this.car.theta) * rC,
      cy = this.world.cy + Math.sin(this.car.theta) * rC;
    let got = 0;

    for (const side of ['outer', 'inner']) {
      const arr = this.pickups[side];
      const r = this.laneRadius(side === 'outer' ? 1 : 0);
      for (let i = arr.length - 1; i >= 0; i--) {
        const ox = this.world.cx + Math.cos(arr[i].theta) * r,
          oy = this.world.cy + Math.sin(arr[i].theta) * r;

        if (this.coll({ x: cx, y: cy }, { x: ox, y: oy }, 22 * this.dpr)) {
          arr.splice(i, 1);
          got++;

          // 💫 Add power-up symbol
          this.powerSymbols.push({
            x: ox,
            y: oy,
            alpha: 4,
            text: Math.random() < 0.5 ? '⚡' : '💥', // Random symbol
          });
        }
      }
    }

    if (got) {
      // this.score += 50 * got;
      this.whooshTime = 0.6;
    }
  }


  private checkHazard() {
    const rC = this.laneRadius(this.car.lane >= 0.5 ? 1 : 0);
    const cx = this.world.cx + Math.cos(this.car.theta) * rC,
      cy = this.world.cy + Math.sin(this.car.theta) * rC;
    for (const side of ['outer', 'inner']) {
      const arr = this.hazards[side];
      const r = this.laneRadius(side === 'outer' ? 1 : 0);
      for (const o of arr) {
        const ox = this.world.cx + Math.cos(o.theta) * r,
          oy = this.world.cy + Math.sin(o.theta) * r;
        if (this.coll({ x: cx, y: cy }, { x: ox, y: oy }, 24 * this.dpr)) return true;
      }
    }
    return false;
  }

  private drawPowerSymbols() {
    for (let i = this.powerSymbols.length - 1; i >= 0; i--) {
      const s = this.powerSymbols[i];
      this.ctx.save();
      this.ctx.globalAlpha = s.alpha;
      this.ctx.fillStyle = '#ffff00';
      this.ctx.font = `${24 * this.dpr}px system-ui`;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(s.text, s.x, s.y);
      this.ctx.restore();

      // Animate upward + fade out
      s.y -= 1.5;
      s.alpha -= 0.03;

      if (s.alpha <= 0) this.powerSymbols.splice(i, 1);
    }
  }


  private updateUI() {
    this.ngZone.run(() => this.cd.detectChanges());
  }

  private splash() {
    this.ctx.save();
    const finalScore = `Score: ${Math.floor(this.score)}`;
    // ✅ Clear everything first — removes any previous frame artifacts
    this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);

    // ✅ Optionally re-draw the road, car, etc. so the scene remains visible
    this.drawBG(0);
    this.drawBand();
    this.drawEntities();
    this.drawCar();

    // ✅ Show the game-over text cleanly
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#ff6b6b';
    this.ctx.font = `${40 * this.dpr}px system-ui`;
    this.ctx.fillText('CRASH!', this.world.cx, this.world.cy - 14 * this.dpr);

    this.ctx.fillStyle = '#2a682cff';
    this.ctx.font = `${22 * this.dpr}px system-ui`;
    this.ctx.fillText(finalScore, this.world.cx, this.world.cy + 16 * this.dpr);

    this.ctx.restore();
  }

  // DRAW "TAP TO START" overlay
 private drawTapToStartOverlay() {
  if (!this.ctx || !this.canvasRef) return;

  const canvas = this.canvasRef.nativeElement;
  this.ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw paused scene
  this.drawBG(0);
  this.drawBand();
  this.drawEntities();
  this.drawCar();

  const radius = 110 * this.dpr; // size of circle

  // Draw only the circle — NO full canvas overlay
  this.ctx.save();
  this.ctx.beginPath();
  this.ctx.arc(this.world.cx, this.world.cy, radius, 0, Math.PI * 2);
  this.ctx.fillStyle = "rgba(0,0,0,0.65)"; // dark circle only
  this.ctx.fill();
  this.ctx.closePath();
  this.ctx.restore();

  // Draw text inside circle
  this.ctx.save();
  this.ctx.fillStyle = "#ffffff";
  this.ctx.textAlign = "center";
  this.ctx.font = `${34 * this.dpr}px system-ui`;
  this.ctx.fillText("Tap to Start", this.world.cx, this.world.cy + 10 * this.dpr);
  this.ctx.restore();
}

  // animation loop
  private step = (ts: number) => {
    if (!this.lastTs) this.lastTs = ts;
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;

    // If waiting for user to tap, just render the overlay and skip logic updates
    if (this.isWaitingForTapStart) {
      if (this.ctx && this.canvasRef) {
        this.drawTapToStartOverlay();
      }
      this.rafId = requestAnimationFrame(this.step);
      return;
    }

    if (this.running) {
      this.t += dt;
      this.score += dt * 80;
      const sp = this.world.baseSpeed + this.world.speedGain * (this.t / 60) + (this.whooshTime > 0 ? 0.3 : 0);
      if (this.whooshTime > 0) this.whooshTime -= dt;
      this.car.theta = this.wrap(this.car.theta + this.car.dir * sp * dt);

      if (this.car.switching) {
        this.car.lerp += dt / this.world.switchTime;
        const q = Math.min(1, this.car.lerp);
        this.car.lane = this.car.lane + (this.car.targetLane - this.car.lane) * (q * q * (3 - 2 * q));
        if (q >= 1) this.car.switching = false;
      }

      this.spawner.pTO -= dt;
      this.spawner.pTI -= dt;
      this.spawner.hTO -= dt;
      this.spawner.hTI -= dt;

      // === PICKUPS ===
      const pickupSpawnChance = 0.5;          // 50% chance when timer triggers
      const pickupDelayMultiplier = 1.8;      // slightly slower than before

      
      if (this.spawner.pTO <= 0) {
        if (Math.random() < pickupSpawnChance && this.giftImages.length > 0) {
          const randomImg = this.giftImages[Math.floor(Math.random() * this.giftImages.length)];
          this.spawnOne(this.pickups, 'outer', randomImg);
        }
        this.spawner.pTO = this.randExp(this.spawner.pOut * pickupDelayMultiplier);
      }

      if (this.spawner.pTI <= 0) {
        if (Math.random() < pickupSpawnChance && this.giftImages.length > 0) {
          const randomImg = this.giftImages[Math.floor(Math.random() * this.giftImages.length)];
          this.spawnOne(this.pickups, 'inner', randomImg);
        }
        this.spawner.pTI = this.randExp(this.spawner.pIn * pickupDelayMultiplier);
      }

      // === HAZARDS === (make less frequent and partly random)
      const hazardSpawnChance = 0.35;        // 35% chance a hazard will spawn when timer hits
      const hazardDelayMultiplier = 1;     // hazards appear ~2.8x slower than before

      if (this.spawner.hTO <= 0) {
        if (Math.random() < hazardSpawnChance) {
          this.spawnOne(this.hazards, 'outer', this.hazardImg);
        }
        this.spawner.hTO = this.randExp(this.spawner.hOut * hazardDelayMultiplier);
      }

      if (this.spawner.hTI <= 0) {
        if (Math.random() < hazardSpawnChance) {
          this.spawnOne(this.hazards, 'inner', this.hazardImg);
        }
        this.spawner.hTI = this.randExp(this.spawner.hIn * hazardDelayMultiplier);
      }

      this.prune();
      this.checkPickups();

      if (this.checkHazard()) {
        this.running = false;
        this.finalScore = Math.floor(this.score);
        this.confetti = true;
        this.cdr.detectChanges();
        if (!this.resultSent) {
          this.resultSent = true;
          this.sendResultToApi(false, this.finalScore);
        }
        // ✅ Run UI updates inside Angular zone
        this.ngZone.run(() => {
          setTimeout(async () => {
            this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
            this.pauseMusic();
            this.showGamePanel = false;
            if (!this.isLoggedIn) {
              this.insta_flow_LoginButton = true;
            }
            this.showGameResult = true;
            this.confetti = false;
            document.body.classList.remove('game-running');
            this.cd.detectChanges();
          }, 3500);
        });

      }

      // push UI update
      this.updateUI();
    }

    // render
    this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
    this.drawBG(dt);
    this.drawBand();
    this.drawEntities();
    this.drawCar();
    if (!this.isWaitingForTapStart) {
     this.drawScore();
    }
    if (!this.running) this.splash();

    // next frame
    this.rafId = requestAnimationFrame(this.step);
  };

  // public restart call (bound to button)
  public reset(): void {
    this.doReset();
  }

  private async sendResultToApi(isWinner: boolean, score: number): Promise<void> {

  if (!this.contestId) {
    // console.error('Missing contestId. Aborting API call.');
    return;
  }
    // console.log('insta iD', this.instaUserId);

  // ✅ At least one identifier must exist
  if (!this.userId && !this.instaUserId) {
    // console.error('No valid user identifier (customer or insta)');
    return;
  }


  const result = {
    contest_id: this.contestId,

    // ✅ send ONLY ONE identifier
    customer_id: this.userId ?? null,
    insta_user_id: this.instaUserId ?? null,

    is_winner: isWinner,
    score: score || 0,
    voucher_assigned: '',
    expiry_date: null
  };

  try {
    const response = await this.supabaseService.updateContestResults(result);

    if (response?.skipped) {
      // console.log('Result already exists for this contest – skipped');
    }
  } catch (err) {
    // console.error('Error saving result:', err);
  }
}

  openLeaderboard(contestId: string) {
    this.loading = true;
    this.utilService.getLeaderBoard(contestId)
      .finally(() => { this.loading = false; });
  }

async onGameFinished() {

  if (!this.contestId) {
    console.error('Missing contestId');
    return;
  }

  const contestData = await this.supabaseService.getContestById(this.contestId);

  // ✅ NULL GUARD (fixes TS error)
  if (!contestData) {
    // console.error('Contest not found');
    return;
  }

  this.store_id = contestData.store_id; // ✅ now safe

  const payload = {
    contestId: this.contestId,
    storeId: this.store_id || '',
    customerId: null as string | null,
    instaUserId: null as string | null
  };

  payload.instaUserId = this.instaUserId;

  // 🔐 Logged-in user
  if (this.userId) {
    payload.customerId = this.userId;
  }

  // 🚨 Final safety check
  if (!payload.customerId && !payload.instaUserId) {
    // console.error('No valid identifier to save participation');
    return;
  }

  const success = await this.supabaseService.playContest(payload);

  if (!success) {
    // console.warn('Contest already played or failed');
  }

  this.utilService.clearPlayState();
}

    
  async customerCreateOnStore() {
  if (!this.store_id) return;

  
  // 🚨 Safety check
  if (!this.userId && !this.instaUserId) {
    // console.error('No valid user to link store');
    return;
  }

  try {
    const response = await this.supabaseService.addUserToStore({
      customerId: this.userId ?? null,
      instaUserId: this.instaUserId,
      storeId: this.store_id
    });

    // console.log('Customer store link:', response);
  } catch (err) {
    // console.error('Error writing customers_on_store', err);
  }
}

  goToBrandInfo() {
    const storeId = this.store_id;
    if (storeId) {
      const url = `/brand-info/${storeId}`;
      window.open(url, '_blank');
    }
  }

  handleBackNavigation = (event: PopStateEvent) => {
    if (this.showGamePanel) {
      this.sendResultToApi(false, this.finalScore);
      history.pushState(null, '', window.location.href);
    }
  };
  handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (this.showGamePanel) {
      event.preventDefault();     
      event.returnValue = '';  
      this.sendResultToApi(false, this.finalScore);
      history.pushState(null, '', window.location.href);
    }
  };

  // async coustomerIdUpdateInstaContest() {

  //   if (this.instaUserId && this.contestId && this.userId) {
  //     await this.supabaseService.linkInstaCustomerToContest({
  //       contestId: this.contestId,
  //       instaUserId: this.instaUserId,
  //       customerId: this.userId
  //     });
  //   }
  // }
}
