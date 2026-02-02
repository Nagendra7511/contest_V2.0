import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, ChangeDetectorRef, NgZone, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';
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
  selector: 'app-boat-game',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileModalComponent, LoginModalComponent, ConfittiComponent],
  templateUrl: './boat-game.component.html',
  styleUrls: ['./boat-game.component.css'],
})
export class BoatGameComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('gameCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private dpr = 1;
  private running = false;
  private last = 0;
  private t = 0;
  public score = 0;
  private best = 0;
  private whoosh = 0;

  private animationFrameId = 0;
  private boat = { x: 0, y: 0, vx: 0, targetX: 0, angle: 0 };
  private drums: Array<{ x: number; y: number; r: number }> = [];
  private gifts: Array<{ x: number; y: number; r: number; imgIndex?: number }> = [];
  private foam: any[] = [];
  private confetti_boat: any[] = [];
  private explosion: any[] = [];
  private shockwave: any | null = null;
  private giftImages: HTMLImageElement[] = [];

  private spawn = { drumTimer: 0, drumMean: 2.8, giftTimer: 0, giftMean: 3.15 };
  isBrowser = typeof window !== 'undefined';

  private waves = [
    { amp: 18, len: 320, speed: 40, phase: 0, alpha: 0.25 },
    { amp: 12, len: 220, speed: 65, phase: 0, alpha: 0.22 },
    { amp: 8, len: 140, speed: 95, phase: 0, alpha: 0.18 },
  ];

  private boatImg = new Image();
  private drumImg = new Image();
  private giftImg = new Image();

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
  private resultSent = false;
  customerInstaId: string | null = null;

  profile: any = null;
  // Tap-to-play state
  waitingForTap = false;
  private canvasStartHandler?: (ev: PointerEvent) => void;

  private readonly world = {
    speed: 150,
    speedGain: 3.6,
    sideSpeed: 480,
    steerEase: 10,
    boatY: 0.72,
    boatSize: 60,
    drumSize: 40,
    giftSize: 50,
    currentDrift: 16,
    drumFactor: 0.65,
    giftFactor: 0.55,
  };

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
    document.body.classList.add('boat-active');

    const contestId = this.route.snapshot.queryParamMap.get('cid');
    const insta_user_ig = this.route.snapshot.queryParamMap.get('ig');
    const store_id = this.route.snapshot.queryParamMap.get('sid');

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
      expDate.setHours(23, 59, 59, 999); // end of day

      this.contest_Expired = now > expDate;

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

      this.store_id = contestData.store_id || null;
      this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
      this.userId = localStorage.getItem('userId')!;
      this.isLoggedIn = !!this.userId;

       //total counts contests
      const brandData = await this.supabaseService.getBrandStoreID(this.store_id!);
      this.brand = brandData || [];
      this.totalResultCount = this.brand.reduce((sum: number, contest: any) => sum + (contest.result_count || 0), 0);

      // 🔹 Admin can play contest
      if (contestId && store_id) {
        const admin = await this.supabaseService.adminPlay(store_id, contestId);

        if (admin) {
          this.admin_view = true;
          this.showWelcomeScreen = true;
          this.loading = false;
          return;
        }
      }
      
       // Check if contest is active or not
      if (!contestData.active) {
        this.showWelcomeScreen = false;
        this.showContesExpired = true;
        this.loading = false;
        return;
      }   
     
      // Check if contest is exp date
      if (this.contest_Expired) {
        this.showContesExpired = true;
        this.loading = false;
        return;
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

      await this.loadCustomerInstaId();
      this.hasPlayed = await this.supabaseService.checkIfContestPlayed({
        contestId: this.contest.contest_id,
        customerId: this.userId ?? null,
         instaUserId: this.instaUserId ?? this.customerInstaId ?? null
      });

      // this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);

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


  ngAfterViewInit() {
    if (!this.isBrowser) return;

    // Run outside Angular zone to avoid change detection lag
    this.ngZone.runOutsideAngular(() => {
      const ensureCanvasReady = () => {
        const canvas = this.canvasRef?.nativeElement;

        // Wait until the canvas exists and is visible in layout
        if (!canvas || canvas.offsetWidth === 0 || canvas.offsetHeight === 0) {
          requestAnimationFrame(ensureCanvasReady);
          return;
        }

        // Initialize context safely
        this.ctx = canvas.getContext('2d')!;
        this.dpr = window.devicePixelRatio || 1;

        // Force layout sizing and draw
        this.fitCanvas();
        window.addEventListener('resize', this.fitCanvas);

        this.loadImages();
        this.setupInput();

        // Start rendering loop BUT do NOT set running=true — we want Tap-to-Play
        this.reset();
        this.running = false; // <<-- important: don't auto-start
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = requestAnimationFrame(this.step.bind(this));

        // Draw initial "Tap to Play" overlay if user opens the panel later.
        setTimeout(() => {
          // initial paint
          this.ctx.fillStyle = '#003';
          this.ctx.fillRect(0, 0, canvas.width, canvas.height);
        }, 100);
      };

      requestAnimationFrame(ensureCanvasReady);
    });
  }


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
    this.playMusic();
    this.showWelcomeScreen = false;
    this.showGamePanel = true;
    this.showGameUpdate = false;
    this.cd.detectChanges();

    // Preload gift images (if any)
    await this.preloadGiftImages();
    this.giftImages = this.contest.game_config.images || this.giftImages;

    // Set waiting-for-tap and draw overlay
    this.waitingForTap = true;
    this.attachStartListener();

    // send analytics event now (start intent)
    this.analyticsService.sendEvent('game_start', {
      game_type: 'boat-game',
      contest_id: this.contest.contest_id
    });

    // playMusic only after user interaction (we'll start after tap to satisfy autoplay)
    if (!isPlatformBrowser(this.platformId)) return;
  }

  /**
   * Attach a single-capture non-passive pointerdown handler that reliably starts the game.
   * The persistent movement handler is non-capturing and passive so it won't interfere.
   */
  private attachStartListener() {
    // attach a single-use pointer listener that starts the game — this ignores movement input
    if (!this.canvasRef || !this.canvasRef.nativeElement) return;
    // remove any prior
    if (this.canvasStartHandler) {
      try { this.canvasRef.nativeElement.removeEventListener('pointerdown', this.canvasStartHandler as any, true); } catch (e) { }
      this.canvasStartHandler = undefined;
    }

    this.canvasStartHandler = (ev: PointerEvent) => {
      if (!this.waitingForTap) return;
      // consume event and start
      try { ev.preventDefault(); } catch (e) { /* ignore */ }
      this.waitingForTap = false;

      // detach start handler
      if (this.canvasStartHandler) {
        try {
          this.canvasRef.nativeElement.removeEventListener('pointerdown', this.canvasStartHandler as any, true);
        } catch (e) { }
        this.canvasStartHandler = undefined;
      }

      // safe start: play music (user interaction)
      this.playMusic();

      // Reset state without flipping running -> false, then enable running
      this.ngZone.runOutsideAngular(() => {
        this.resetStateOnly();   // <-- important fix (doesn't set running=false)
        this.running = true;
        this.last = 0;
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = requestAnimationFrame(this.step.bind(this));
      });

      // ensure HUD updates etc.
      this.cd.detectChanges();
    };

    // draw overlay immediately
    this.drawTapToPlayOverlay();

    // attach in capture phase and NOT passive so it wins and can prevent default (important on mobile)
    this.canvasRef.nativeElement.addEventListener('pointerdown', this.canvasStartHandler as any, { passive: false, capture: true });
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


  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('car-active');
    }
    this.pauseMusic();
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.fitCanvas);

     if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('popstate', this.handleBackNavigation);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }

    // cleanup start handler
    if (this.canvasStartHandler && this.canvasRef?.nativeElement) {
      try { this.canvasRef.nativeElement.removeEventListener('pointerdown', this.canvasStartHandler as any, true); } catch (e) { }
      this.canvasStartHandler = undefined;
    }
  }

  private fitCanvas = () => {
    const size = Math.min(500, Math.max(420, Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.7)));
    const canvas = this.canvasRef.nativeElement;
    this.dpr = window.devicePixelRatio || 1;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.width = Math.floor(size * this.dpr);
    canvas.height = Math.floor(size * this.dpr);

    // redraw overlay if waiting for tap
    if (this.waitingForTap) this.drawTapToPlayOverlay();
  };

  private loadImages() {
  const svg = (s: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(s);

  // 🚤 Boat SVG (keep as-is)
  this.boatImg = new Image();
  this.boatImg.src = svg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="140" viewBox="0 0 80 140">
      <defs>
        <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ff7eb3"/><stop offset="1" stop-color="#ffb86c"/>
        </linearGradient>
        <linearGradient id="deck" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#14345a"/><stop offset="1" stop-color="#255f9e"/>
        </linearGradient>
      </defs>
      <path d="M40 4 C55 20 72 52 72 80 C72 108 55 130 40 136 C25 130 8 108 8 80 C8 52 25 20 40 4Z" fill="url(#hull)" stroke="#ffffffaa" stroke-width="3"/>
      <ellipse cx="40" cy="80" rx="22" ry="32" fill="url(#deck)"/>
      <circle cx="40" cy="64" r="8" fill="#0b1b38"/>
      <rect x="34" y="96" width="12" height="10" rx="3" fill="#0b1b38"/>
    </svg>
  `);

  // 🛢 Drum SVG — reliable visible drum graphic + load/error handlers
  this.drumImg = new Image();
  this.drumImg.onload = () => {
    // console.log('drum image loaded');
  };
  this.drumImg.onerror = (e) => {
    console.warn('Drum image failed to load, using canvas fallback.', e);
  };
  // A compact, guaranteed-to-render drum SVG
  this.drumImg.src = svg(`
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

  // 🎁 Gift Images — dynamic loading (create Image objects from URLs)
  if (this.contest?.game_config?.images && this.contest.game_config.images.length) {
    this.giftImages = this.contest.game_config.images.map((url: string) => {
      const img = new Image();
      img.src = url; // can be .png or .jpg
      // optional handlers:
      img.onload = () => { /* console.log('gift image loaded', url); */ };
      img.onerror = () => { console.warn('gift image failed:', url); };
      return img;
    });
  } else {
    // Fallback gift SVG if no dynamic images
    const fallback = new Image();
    fallback.src = svg(`
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <defs><linearGradient id="gf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs>
        <rect x="10" y="22" width="44" height="30" rx="6" fill="url(#gf)" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>
        <rect x="30" y="22" width="4" height="30" fill="#ffffffcc"/>
        <rect x="10" y="36" width="44" height="4" fill="#ffffffcc"/>
        <path d="M20 22 C26 10 30 10 34 22" stroke="#fff" stroke-width="3" fill="none"/>
        <path d="M44 22 C38 10 34 10 30 22" stroke="#fff" stroke-width="3" fill="none"/>
      </svg>
    `);
    this.giftImages = [fallback];
  }
}

  private async preloadGiftImages(): Promise<void> {
    if (!this.giftImages?.length) return;
    await Promise.all(
      this.giftImages.map(img => new Promise<void>((resolve) => {
        if ((img as HTMLImageElement).complete) return resolve();
        img.onload = () => resolve();
        img.onerror = () => resolve();
      }))
    );
  }



  private setupInput() {
    // persistent handler — only moves boat after the game has started and not while waiting for tap
    const handler = (e: PointerEvent) => {
      // ignore any control input while overlay is waiting for tap
      if (this.waitingForTap) return;

      // only respond when game is running
      if (!this.running) return;

      const rect = this.canvasRef.nativeElement.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.canvasRef.nativeElement.width / rect.width);
      const delta = x - this.boat.x;
      const nudge = this.clamp(delta * 0.12, -26 * this.dpr, 26 * this.dpr);
      this.boat.x = this.clamp(this.boat.x + nudge, 36 * this.dpr, this.W() - 36 * this.dpr);
      this.boat.vx += this.clamp(delta * 3, -220 * this.dpr, 220 * this.dpr);
      this.boat.targetX = x;
    };

    this.canvasRef.nativeElement.addEventListener('pointerdown', handler, { passive: true, capture: false });

   
  }

  private W() {
    return this.canvasRef.nativeElement.width;
  }

  private H() {
    return this.canvasRef.nativeElement.height;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  private randX() {
    const m = 60 * this.dpr;
    return m + Math.random() * (this.W() - 2 * m);
  }

  private randExp(mean: number) {
    const u = Math.random();
    return Math.max(0.25, -Math.log(1 - u) * mean * 0.9 + mean * 0.1);
  }

  private withAlpha(hex: string, a: number) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  private drawSea(dt: number) {
    const ctx = this.ctx;
    const W = this.W();
    const H = this.H();

    // background ocean gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#28a5ff');
    gradient.addColorStop(0.35, '#1278d0');
    gradient.addColorStop(1, '#063a7a');
    ctx.fillStyle = gradient;
    ctx.fillRect(-1, -1, W + 2, H + 2); // ✅ fixes edge cutoff

    // sun rays shimmer
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const rays = ctx.createRadialGradient(W * 0.2, -H * 0.1, H * 0.1, W * 0.2, -H * 0.1, H * 1.2);
    rays.addColorStop(0, '#ffffff08');
    rays.addColorStop(1, '#ffffff00');
    ctx.fillStyle = rays;
    ctx.fillRect(-1, -1, W + 2, H + 2); // ✅ ensures full coverage
    ctx.restore();

    // animated waves
    ctx.save();
    for (const w of this.waves) {
      w.phase += w.speed * dt * 0.8;
      ctx.beginPath();
      const y0 = -H * 0.05;
      ctx.moveTo(-10 * this.dpr, y0);
      for (let x = -10 * this.dpr; x <= W + 10 * this.dpr; x += 6 * this.dpr) {
        const y =
          y0 +
          Math.sin((x + w.phase) / w.len) * w.amp * this.dpr +
          Math.sin((x * 1.7 + w.phase * 1.3) / (w.len * 0.7)) * w.amp * 0.35 * this.dpr;
        ctx.lineTo(x, y + H * 0.25);
      }
      ctx.lineTo(W + 10 * this.dpr, H + 10 * this.dpr);
      ctx.lineTo(-10 * this.dpr, H + 10 * this.dpr);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,255,255,${w.alpha})`;
      ctx.fill();
    }
    ctx.restore();
  }



private drawDrums() {
  const ctx = this.ctx;
  const sz = this.world.drumSize * this.dpr;
  ctx.save();
  for (const d of this.drums) {
    if (this.drumImg && (this.drumImg as HTMLImageElement).complete && (this.drumImg as HTMLImageElement).naturalWidth > 0) {
      // draw image centered on drum
      ctx.drawImage(this.drumImg, d.x - sz / 2, d.y - sz / 2, sz, sz);
    } else {
      // fallback: draw a visible drum shape
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, sz * 0.5, sz * 0.38, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.lineWidth = 2 * this.dpr;
      ctx.strokeStyle = '#7f1d1d';
      ctx.stroke();

      // top rim
      ctx.beginPath();
      ctx.ellipse(d.x, d.y - sz * 0.28, sz * 0.45, sz * 0.18, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd7d7';
      ctx.fill();
      ctx.strokeStyle = '#8b1c1c';
      ctx.stroke();
    }

    ctx.font = `${10 * this.dpr}px system-ui`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    // optional small label
    // ctx.fillText('DRM', d.x, d.y - sz * 0.55);
  }
  ctx.restore();
}


  private drawGifts() {
    const ctx = this.ctx;
    const sz = this.world.giftSize * this.dpr;
    ctx.save();

    for (const g of this.gifts) {
      // assign image index if not already
      if (g.imgIndex === undefined) {
        g.imgIndex = Math.floor(Math.random() * this.giftImages.length);
      }

      const img = this.giftImages[g.imgIndex];
      if (img.complete) {
        ctx.drawImage(img, g.x - sz / 2, g.y - sz / 2, sz, sz);
      } else {
        // temporary placeholder while image loads
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(g.x - sz / 2, g.y - sz / 2, sz, sz);
      }

      // Optional text label
      ctx.font = `${10 * this.dpr}px system-ui`;
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.fillText('', g.x, g.y - sz * 0.55);
    }

    ctx.restore();
  }


  private drawFoam(dt: number) {
    const ctx = this.ctx;
    for (let i = this.foam.length - 1; i >= 0; i--) {
      const p = this.foam[i];
      p.x += p.vx * dt;
      p.y += (p.vy + this.world.speed * 0.6 * this.dpr) * dt;
      p.a -= dt * 1.2;
      if (p.a <= 0 || p.y > this.H() + 40 * this.dpr) {
        this.foam.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, p.a)})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawconfetti_boat(dt: number) {
    const ctx = this.ctx;
    for (let i = this.confetti_boat.length - 1; i >= 0; i--) {
      const c = this.confetti_boat[i];
      c.x += c.vx * dt;
      c.y += (c.vy + 120) * dt;
      c.a -= dt * 1.5;
      if (c.a <= 0) {
        this.confetti_boat.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.fillStyle = `hsla(${c.hue},80%,60%,${c.a})`;
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawExplosion(dt: number) {
    const ctx = this.ctx;
    for (let i = this.explosion.length - 1; i >= 0; i--) {
      const p = this.explosion[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.a -= dt * 1.2;
      if (p.a <= 0) {
        this.explosion.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.fillStyle = this.withAlpha(p.col, p.a);
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.shockwave) {
      this.shockwave.r += 360 * dt;
      this.shockwave.a -= dt * 1.0;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, this.shockwave.a)})`;
      ctx.lineWidth = 6 * this.dpr;
      ctx.arc(this.shockwave.x, this.shockwave.y, this.shockwave.r, 0, Math.PI * 2);
      ctx.stroke();
      if (this.shockwave.a <= 0) this.shockwave = null;
    }
  }

  private drawBoat() {
    const ctx = this.ctx;
    const w = this.world.boatSize * this.dpr;
    const h = this.world.boatSize * 1.7 * this.dpr;

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    const trail = 60 * this.dpr;

    ctx.moveTo(this.boat.x, this.boat.y + h * 0.45);
    ctx.quadraticCurveTo(
      this.boat.x - 30 * this.dpr,
      this.boat.y + h * 0.45 + trail * 0.5,
      this.boat.x - 14 * this.dpr,
      this.boat.y + h * 0.45 + trail
    );

    ctx.moveTo(this.boat.x, this.boat.y + h * 0.45);
    ctx.quadraticCurveTo(
      this.boat.x + 30 * this.dpr,
      this.boat.y + h * 0.45 + trail * 0.5,
      this.boat.x + 14 * this.dpr,
      this.boat.y + h * 0.45 + trail
    );
    ctx.strokeStyle = '#ffffffaa';
    ctx.lineWidth = 3 * this.dpr;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(this.boat.x, this.boat.y);
    ctx.rotate(this.boat.angle);
    ctx.drawImage(this.boatImg, -w / 2, -h * 0.55, w, h);
    ctx.restore();
  }

  private addFoam(x: number, y: number, dir: number) {
    for (let i = 0; i < 3; i++) {
      this.foam.push({
        x: x + (Math.random() * 14 - 7) * this.dpr,
        y: y + (Math.random() * 10 - 3) * this.dpr,
        r: (Math.random() * 3 + 1) * this.dpr,
        vx: Math.random() * 40 - 20 + -Math.sin(dir) * 30,
        vy: -Math.random() * 40 - 60,
        a: 0.9,
      });
    }
  }

  private burstconfetti_boat(x: number, y: number) {
    const n = 18;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 160 + Math.random() * 180;
      this.confetti_boat.push({
        x,
        y,
        r: (Math.random() * 2 + 1) * this.dpr,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 40,
        hue: Math.floor(Math.random() * 360),
        a: 1,
      });
    }
  }

  private explode(x: number, y: number) {
    const n = 36;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 200 + Math.random() * 280;
      this.explosion.push({
        x,
        y,
        r: (Math.random() * 3 + 2) * this.dpr,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        col: i % 3 === 0 ? '#ffd166' : i % 3 === 1 ? '#ef4444' : '#ffa600',
        a: 1,
      });
    }
    this.shockwave = { x, y, r: 8 * this.dpr, a: 0.9 };
  }

  private circleHit(ax: number, ay: number, ar: number, bx: number, by: number, br: number) {
    const dx = ax - bx,
      dy = ay - by;
    return dx * dx + dy * dy <= (ar + br) * (ar + br);
  }

  private boatRadius() {
    return Math.max(20, this.world.boatSize * 0.33) * this.dpr;
  }

private checkPickups() {
  const r = this.boatRadius();
  for (let i = this.gifts.length - 1; i >= 0; i--) {
    const g = this.gifts[i];
    if (this.circleHit(this.boat.x, this.boat.y, r, g.x, g.y, g.r)) {
      // Gift collected — remove and give points; do NOT explode
      this.gifts.splice(i, 1);
      this.score += 50;
      this.whoosh = 0.5;
      this.burstconfetti_boat(g.x, g.y);
      this.addFoam(this.boat.x, this.boat.y + this.world.boatSize * 0.6 * this.dpr, this.boat.angle);
      // debug log to help you confirm the pickup
      // console.log('[boat-game] gift collected at', Math.round(g.x), Math.round(g.y), 'r:', Math.round(g.r));
    }
  }
}

  private checkCrash() {
  const r = this.boatRadius() * 0.95;
  for (const d of this.drums) {
    if (this.circleHit(this.boat.x, this.boat.y, r, d.x, d.y, d.r)) {
      // debug info to ensure crash source is drum
      // console.log('[boat-game] CRASH with drum at', Math.round(d.x), Math.round(d.y), 'r:', Math.round(d.r));
      this.explode(this.boat.x, this.boat.y);
      return true;
    }
  }
  return false;
}

  private updateHUD() {
    const scoreEl = document.getElementById('score');
    const bestEl = document.getElementById('best');
    if (scoreEl) scoreEl.textContent = `Score: ${Math.floor(this.score)}`;
    if (bestEl) bestEl.textContent = `Best: ${this.best}`;
  }

  private splash() {
    const ctx = this.ctx;
    const W = this.W();
    const H = this.H();
    ctx.save();
    ctx.fillStyle = '#000a';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = `${40 * this.dpr}px system-ui`;
    ctx.fillText('CRASH!', W / 2, H / 2 - 20 * this.dpr);
    ctx.font = `${20 * this.dpr}px system-ui`;
    ctx.fillText(`${Math.floor(this.score)} pts`, W / 2, H / 2 + 12 * this.dpr);
    ctx.font = `${16 * this.dpr}px system-ui`;
    // ctx.fillText('Tap to restart', W / 2, H / 2 + 42 * this.dpr);
    ctx.restore();
  }

  private updateEntities(dt: number, envSpeed: number) {
    const dxCurrent = Math.sin(this.t * 0.3) * this.world.currentDrift * this.dpr;
    const vDrum = envSpeed * this.world.drumFactor;
    const vGift = envSpeed * this.world.giftFactor;
    for (const d of this.drums) {
      d.y += vDrum * dt;
      d.x += dxCurrent * dt;
    }
    for (const g of this.gifts) {
      g.y += vGift * dt;
      g.x += dxCurrent * dt;
    }
    const off = this.H() + 120 * this.dpr;
    while (this.drums.length && this.drums[0].y > off) this.drums.shift();
    while (this.gifts.length && this.gifts[0].y > off) this.gifts.shift();
  }

  private step(time: number) {
    if (!this.last) this.last = time;
    const dt = Math.min(0.05, (time - this.last) / 1000);
    this.last = time;

    if (this.running) {
      this.t += dt;
      const envSpeed = (this.world.speed + this.world.speedGain * this.t) * this.dpr * (this.whoosh > 0 ? 1.25 : 1);
      if (this.whoosh > 0) this.whoosh -= dt;

      const dx = this.boat.targetX - this.boat.x;
      const desiredVx = this.clamp(dx * this.world.steerEase, -this.world.sideSpeed, this.world.sideSpeed) * this.dpr;
      this.boat.vx += (desiredVx - this.boat.vx) * Math.min(1, dt * 6);
      this.boat.x = this.clamp(this.boat.x + this.boat.vx * dt, 36 * this.dpr, this.W() - 36 * this.dpr);
      this.boat.angle = (this.boat.vx / (this.world.sideSpeed * this.dpr)) * (Math.PI / 7);

      this.spawn.drumTimer -= dt;
      this.spawn.giftTimer -= dt;
      if (this.spawn.drumTimer <= 0) {
        this.spawnDrum();
        this.spawn.drumTimer = this.randExp(this.spawn.drumMean);
      }
      if (this.spawn.giftTimer <= 0) {
        this.spawnGift();
        this.spawn.giftTimer = this.randExp(this.spawn.giftMean);
      }

      this.updateEntities(dt, envSpeed);
      this.addFoam(this.boat.x, this.boat.y + this.world.boatSize * 0.55 * this.dpr, this.boat.angle);

      this.score += envSpeed * dt * 0.05;
      this.score = Math.round(this.score);

      this.checkPickups();

      if (this.checkCrash()) {
        this.running = false;
        this.sendResultToApi(false, this.score);

        this.confetti = true;
        // Switch UI screens safely inside Angular zone
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

      this.updateHUD();
    }

    this.ctx.clearRect(0, 0, this.W(), this.H());
    this.drawSea(dt);
    this.drawDrums();
    this.drawGifts();
    this.drawFoam(dt);
    this.drawBoat();
    this.drawconfetti_boat(dt);
    this.drawExplosion(dt);

    if (!this.running) {
      // if waiting for tap, draw overlay; else draw crash splash
      if (this.waitingForTap) {
        this.drawTapToPlayOverlay();
      } else {
        this.splash();
      }
    }

    this.animationFrameId = requestAnimationFrame(this.step.bind(this));
  }

  private spawnDrum() {
  const visualSize = this.world.drumSize * this.dpr;
  // Make the visual size unchanged but increase hit radius to be more forgiving as a "danger" object
  const hitRadius = Math.max(18 * this.dpr, visualSize * 0.42); // 42% of visual size, min 18px
  this.drums.push({
    x: this.randX(),
    y: -80 * this.dpr,
    r: hitRadius,
  });
}

// -- improved spawnGift: smaller hit radius so gifts are less likely to overlap drum collision zone --
private spawnGift() {
  const visualSize = this.world.giftSize * this.dpr;
  // gifts are pickups, so make hit area smaller than visual to avoid accidental crashes
  const hitRadius = Math.max(10 * this.dpr, visualSize * 0.35); // 28% of visual size, min 10px
  this.gifts.push({
    x: this.randX(),
    y: -80 * this.dpr,
    r: hitRadius,
  });
}


  restart() {
    this.ngZone.runOutsideAngular(() => {
      this.reset();
    });
  }

  /**
   * Full reset used for UI "restart" or initial initialization.
   * This intentionally sets running=false so the game won't auto-start.
   */
  private reset() {
    this.running = false; // keep false until user taps (reset does not auto-start)
    this.last = 0;
    this.t = 0;
    this.score = 0;
    this.whoosh = 0;
    this.boat.x = this.W() / 2;
    this.boat.y = this.H() * this.world.boatY;
    this.boat.vx = 0;
    this.boat.targetX = this.boat.x;
    this.boat.angle = 0;

    this.drums.length = 0;
    this.gifts.length = 0;
    this.foam.length = 0;
    this.confetti_boat.length = 0;
    this.explosion.length = 0;
    this.shockwave = null;

    this.spawn.drumTimer = 0;
    this.spawn.giftTimer = 0;

    this.updateHUD();

    // if panel visible, ensure waiting state so user taps to start
    if (this.showGamePanel) {
      this.waitingForTap = true;
      this.attachStartListener();
    }
  }

  /**
   * Reset entity state but DO NOT force running = false.
   * Use this when starting the game so we don't undo the start flag.
   */
  private resetStateOnly() {
    // do the same as reset() except do not set this.running = false
    this.last = 0;
    this.t = 0;
    this.score = 0;
    this.whoosh = 0;
    this.boat.x = this.W() / 2;
    this.boat.y = this.H() * this.world.boatY;
    this.boat.vx = 0;
    this.boat.targetX = this.boat.x;
    this.boat.angle = 0;

    this.drums.length = 0;
    this.gifts.length = 0;
    this.foam.length = 0;
    this.confetti_boat.length = 0;
    this.explosion.length = 0;
    this.shockwave = null;

    this.spawn.drumTimer = 0;
    this.spawn.giftTimer = 0;

    this.updateHUD();
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
      this.sendResultToApi(false, this.score);
      history.pushState(null, '', window.location.href);
    }
  };
  handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (this.showGamePanel) {
      event.preventDefault();     
      event.returnValue = '';  
      this.sendResultToApi(false, this.score);
      history.pushState(null, '', window.location.href);
    }
  };

  // ---------- Tap-to-play overlay rendering ----------
  private drawTapToPlayOverlay() {
    if (!this.ctx || !this.canvasRef?.nativeElement) return;
    const canvas = this.canvasRef.nativeElement;
    const dpr = this.dpr;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    // draw background scene lightly so user sees boat preview
    // clear drawing area in CSS coords (transform not used here)
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw sea and boat in low opacity to hint at game
    this.drawSea(0);
    this.drawDrums();
    this.drawGifts();
    this.drawBoat();

    // overlay
    this.ctx.save();
    this.ctx.globalAlpha = 0.55;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.ctx.restore();

    // "Tap to Play" text (use CSS coordinates scaled by dpr)
    this.ctx.save();
    this.ctx.scale(dpr, dpr); // draw text using CSS px coordinates
    this.ctx.font = '28px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = '#fff';
    const cx = cssW / 2;
    const cy = cssH / 2 - 10;
    this.ctx.fillText('Tap to Play', cx, cy);
    this.ctx.font = '14px system-ui';
    this.ctx.fillText('Tap the canvas to start', cx, cy + 34);
    this.ctx.restore();
  }

  //  async coustomerIdUpdateInstaContest() {

  //   if (this.instaUserId && this.contestId && this.userId) {
  //     await this.supabaseService.linkInstaCustomerToContest({
  //       contestId: this.contestId,
  //       instaUserId: this.instaUserId,
  //       customerId: this.userId
  //     });
  //   }
  // }

}
