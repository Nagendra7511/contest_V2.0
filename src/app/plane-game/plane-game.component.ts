import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, ChangeDetectorRef, NgZone, HostListener } from '@angular/core';
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

interface BgCloud { x: number; y: number; w: number; h: number; s: number; layer: number; }
interface Gift { x: number; y: number; w: number; h: number; vx: number; img: HTMLImageElement; }
interface Obstacle { x: number; y: number; w: number; h: number; vx: number; img: HTMLImageElement; }
interface confetti_plane { x: number; y: number; vx: number; vy: number; g: number; life: number; s: number; hue: number; }
interface Explosion { x: number; y: number; vx: number; vy: number; life: number; s: number; c: string; }

@Component({
  selector: 'app-plane-game',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileModalComponent, LoginModalComponent, ConfittiComponent],
  templateUrl: './plane-game.component.html',
  styleUrls: ['./plane-game.component.css']
})
export class PlaneGameComponent implements AfterViewInit, OnDestroy {

  @ViewChild('gameCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  // SCREEN STATES
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

  // GAME STATES
  score = 0;
  muted = false;
  running = false;
  gameOver = false;

  // Tap-to-start flags
  overlayVisible = true;             // overlay circle shown
  waitingForTapStart = false;        // waits for first tap

  // Canvas / sizes
  DPR = 1;
  W = 0; H = 0; groundY = 0;

  // Entities
  clouds: BgCloud[] = [];
  gifts: Gift[] = [];
  obstacles: Obstacle[] = [];
  confetti_plane: confetti_plane[] = [];
  explosions: Explosion[] = [];

  // Plane physics
  plane = { x: 0, y: 0, vy: 0, r: 26 };
  GRAV = 0; FLAP = 0; MAXVY = 0;

  SPEED = 250;
  lastSpawn = 0;
  spawnEvery = 1300;
  nextType: 'gift' | 'obstacle' = 'gift';

  tapQueued = false;
  animationId: any;

  // IMAGE ASSETS
  planeImg = new Image();
  bombImg = new Image();
  giftImgs: HTMLImageElement[] = [];
  giftImageUrls: string[] = [ ]
  giftSize = 50;

  profile: any = null;
  instaUserId: string | null = null;
  insta_flow_LoginButton = false;
  hasPlayed = false;
  customerInstaId: string | null = null;
  
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

  // -----------------------
  // LOAD STATIC IMAGES
  // -----------------------
  loadImages() {
  // fallback static assets (only used if dynamic URLs not available)
  this.planeImg.src = '/images/plane2.png';
  this.bombImg.src = '/images/bomb.png';

  // if no dynamic urls are set, populate giftImgs with fallback images
  if (!this.giftImageUrls || this.giftImageUrls.length === 0) {
    this.giftImgs = [
      Object.assign(new Image(), { src: '/images/gift-1.png' }),
      Object.assign(new Image(), { src: '/images/prize1.png' }),
      Object.assign(new Image(), { src: '/images/treasure.png' }),
    ];
  }
}

/**
 * Load gift image URLs into HTMLImageElement[] (this.giftImgs).
 * Falls back to static set if no URLs or if loading fails.
 */
private loadGiftImages(timeout = 5000): Promise<void> {
  return new Promise((resolve) => {
    const urls = Array.isArray(this.giftImageUrls) ? this.giftImageUrls : [];

    if (!urls.length) {
      // no dynamic images -> keep current this.giftImgs (fallback)
      resolve();
      return;
    }

    // reset
    this.giftImgs = [];
    let loaded = 0;
    const total = urls.length;
    let finished = false;

    const checkDone = () => {
      if (finished) return;
      if (loaded >= total) {
        finished = true;
        resolve();
      }
    };

    // guard: if nothing loads after timeout, resolve to avoid hang
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      // if none loaded, leave fallback/static images
      if (this.giftImgs.length === 0) {
        // keep whatever fallback is already set
      }
      resolve();
    }, timeout);

    urls.forEach((u: string) => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          loaded++;
          this.giftImgs.push(img);
          checkDone();
          if (loaded === total) clearTimeout(timer);
        };
        img.onerror = () => {
          loaded++;
          console.warn('Failed to load gift image:', u);
          checkDone();
          if (loaded === total) clearTimeout(timer);
        };
        img.src = u;
      } catch (err) {
        loaded++;
        console.warn('Error while creating gift Image for url', u, err);
        checkDone();
      }
    });
  });
}


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
    document.body.classList.add('plane-active');

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
          this.giftImageUrls = (this.contest?.game_config?.images || []).slice();
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
      
      this.giftImageUrls = (this.contest?.game_config?.images || []).slice();
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

  
  ngAfterViewInit(): void {
    // nothing auto-starts; user will call startGame()
    // attach pointer listeners to canvas once it's available
    setTimeout(() => {
      const canvas = this.canvasRef?.nativeElement;
      if (canvas) {
        // use passive: false so we can preventDefault on touch
        canvas.addEventListener('mousedown', this.onCanvasMouseDownBound, { passive: false });
        canvas.addEventListener('touchstart', this.onCanvasTouchStartBound, { passive: false });
      }
      // ensure initial sizing
      this.setupCanvas();
    }, 0);
  }

  ngOnDestroy(): void {

     // cleanup
     if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('plane-active');
    }
    if (isPlatformBrowser(this.platformId)) {
    window.removeEventListener('popstate', this.handleBackNavigation);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }
    cancelAnimationFrame(this.animationId);
    const canvas = this.canvasRef?.nativeElement;
    if (canvas) {
      canvas.removeEventListener('mousedown', this.onCanvasMouseDownBound);
      canvas.removeEventListener('touchstart', this.onCanvasTouchStartBound);
    }
    this.pauseMusic();
  }

  // bound handlers so we can remove them later easily
  private onCanvasMouseDownBound = (e: MouseEvent) => this.onCanvasMouseDown(e);
  private onCanvasTouchStartBound = (e: TouchEvent) => this.onCanvasTouchStart(e);

  setupCanvas() {
    this.DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this.W = Math.floor(window.innerWidth * this.DPR);
    this.H = Math.floor(window.innerHeight * this.DPR);
    this.groundY = this.H - Math.max(54 * this.DPR, this.H * 0.06);

    const canvas = this.canvasRef.nativeElement;
    canvas.width = this.W;
    canvas.height = this.H;
    // style width/height are controlled by CSS (or you can set here)
    // canvas.style.width = `${Math.floor(this.W / this.DPR)}px`;
    // canvas.style.height = `${Math.floor(this.H / this.DPR)}px`;
  }

  @HostListener('window:resize')
  onResize() {
    this.setupCanvas();
    this.initClouds();
    this.tunePhysics();
  }

  // INPUT HANDLING
  onCanvasMouseDown(event: MouseEvent) {
    if (event) event.preventDefault();

    // If waiting the first tap -> start gameplay
    if (this.waitingForTapStart) {
      this.startActualGameplay();
      return;
    }

    if (!this.running) return;
    this.tapQueued = true;
  }

  onCanvasTouchStart(event: TouchEvent) {
    if (event) event.preventDefault();

    if (this.waitingForTapStart) {
      this.startActualGameplay();
      return;
    }

    if (!this.running) return;
    this.tapQueued = true;
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    // Allow keyboard to start the game when waiting
    if (this.waitingForTapStart && (event.code === 'Space' || event.code === 'ArrowUp')) {
      event.preventDefault();
      this.startActualGameplay();
      return;
    }

    if (!this.running) return;

    if (event.code === 'Space' || event.code === 'ArrowUp') {
      event.preventDefault();
      this.tapQueued = true;
    }
  }

  // ---------------------
  // SCREEN FLOW
  // ---------------------
  async startGame() {

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
    this.loading = true;
    this.loadImages();
    // attempt to load dynamic gift images (await so gifts spawn with updated images)
    await this.loadGiftImages();
    this.loading = false;
    this.playMusic();
    this.showWelcomeScreen = false;
    this.showGamePanel = true;
    this.showGameUpdate = false;

    this.resetGame();

    // IMPORTANT: don't start physics yet — show Tap overlay
    this.running = false;
    this.gameOver = false;
    this.overlayVisible = true;
    this.waitingForTapStart = true;

    // setup and start loop (loop will pause physics until tap)
    setTimeout(() => {
      this.setupCanvas();
      this.initGameLogic();

      cancelAnimationFrame(this.animationId);
      this.loop(performance.now());
    }, 50);
    
    this.analyticsService.sendEvent('game_start_click', {
      game_type: 'plane-game',
      contest_id: this.contest.contest_id
    });

    if (!isPlatformBrowser(this.platformId)) return;
  }

  // Called when user actually taps the canvas for the first time
  startActualGameplay() {
    this.waitingForTapStart = false;
    this.overlayVisible = false;
    this.running = true;
    // Give the plane an initial flap for better feel
    this.plane.vy += this.FLAP * 0.6;
  }

  showGameOver() {
    this.running = false;
    this.gameOver = true;
    this.confetti = true;
    this.sendResultToApi(false, this.score);
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
  }

  // ---------------------
  // GAME LOGIC
  // ---------------------
  initGameLogic() {
    this.initClouds();
    this.tunePhysics();
  }

  initClouds() {
    this.clouds.length = 0;
    for (let l = 0; l < 3; l++) {
      const n = Math.ceil((this.W / this.DPR) / 220) + 3;
      for (let i = 0; i < n; i++) this.clouds.push(this.makeBgCloud(l));
    }
  }

  makeBgCloud(layer: number): BgCloud {
    const w = (120 + Math.random() * 200) *
      (layer === 0 ? 1.2 : layer === 1 ? 1 : 0.8) * this.DPR;

    const h = w * (0.4 + Math.random() * 0.15);

    return {
      x: Math.random() * this.W,
      y: Math.random() * this.H * 0.75,
      w, h,
      s: (0.15 + layer * 0.12) * this.DPR,
      layer
    };
  }

  tunePhysics() {
    // EXTRA SLOW & EASY PHYSICS
    this.GRAV = 420;      // slow falling
    this.FLAP = -260;     // gentle upward flap
    this.MAXVY = 380;     // limit max speed (slow)

    this.plane.x = this.W * 0.28;
    this.plane.y = this.H * 0.45;
    this.plane.vy = 0;
    this.plane.r = 26 * this.DPR;
  }

  rand(a: number, b: number) { return Math.random() * (b - a) + a; }
  groundTop() { return this.groundY - this.plane.r * 0.6; }

  // ---------------------
  // SPAWN GIFT
  // ---------------------
  spawnGift() {
    const size = this.giftSize * this.DPR;
    const img = this.giftImgs[Math.floor(Math.random() * this.giftImgs.length)] || this.giftImgs[0];

    this.gifts.push({
      x: this.W + size,
      y: this.rand(this.groundTop() * 0.2, this.groundTop() * 0.95),
      w: size,
      h: size,
      vx: -this.SPEED * (1 + Math.random() * 0.15),
      img
    });
  }

  // ---------------------
  // SPAWN BOMB
  // ---------------------
  spawnObstacle() {
    const size = 80 * this.DPR;

    this.obstacles.push({
      x: this.W + size,
      y: this.rand(this.groundTop() * 0.18, this.groundTop() * 0.9),
      w: size,
      h: size,
      vx: -this.SPEED * (1 + Math.random() * 0.2),
      img: this.bombImg
    });
  }

  bombCounter = 0;

  safeSpawn() {
    this.bombCounter++;

    // Spawn a bomb only every 3rd item
    if (this.bombCounter % 3 === 0) {
      this.spawnObstacle(); // 1 bomb
    } else {
      this.spawnGift();     // gifts otherwise
    }
  }

  resetGame() {
    this.score = 0;
    this.gifts = [];
    this.obstacles = [];
    this.confetti_plane = [];
    this.explosions = [];
    this.lastSpawn = 0;
    this.nextType = 'gift';
    this.gameOver = false;
    this.tunePhysics();
  }

  emitconfetti_plane(x: number, y: number, n = 24) {
    for (let i = 0; i < n; i++) {
      this.confetti_plane.push({
        x, y,
        vx: (Math.random() * 3.2 - 1.6) * this.DPR,
        vy: (Math.random() * 2.2 - 2.8) * this.DPR,
        g: (0.03 + Math.random() * 0.04) * this.DPR,
        life: 420 + Math.random() * 360,
        s: (2 + Math.random() * 2) * this.DPR,
        hue: Math.floor(Math.random() * 360)
      });
    }
  }

  // ---------------------
  // MAIN GAME LOOP
  // ---------------------
  loop(now: number) {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dt = 1 / 60;

    // Draw SKY + Clouds (always)
    this.drawSky(ctx);

    // If waiting for the user's first tap: show plane + overlay and DO NOT run physics
    if (this.waitingForTapStart) {
      this.drawPlane(ctx);
      if (this.overlayVisible) this.drawTapToStartOverlay(ctx);

      this.animationId = requestAnimationFrame(t => this.loop(t));
      return;
    }

    // GAME RUNNING PHYSICS
    if (this.running) {

      if (this.tapQueued) {
        this.plane.vy += this.FLAP;
        this.tapQueued = false;
      }

      this.plane.vy += this.GRAV * dt;
      this.plane.vy = Math.max(-this.MAXVY, Math.min(this.MAXVY, this.plane.vy));
      this.plane.y += this.plane.vy * dt;

      // GROUND COLLISION
      if (this.plane.y + this.plane.r * 0.55 >= this.groundY) {
        this.plane.y = this.groundY - this.plane.r * 0.55;
        this.showGameOver();
        
      }

      if (this.plane.y - this.plane.r * 0.9 < 0)
        this.plane.y = this.plane.r * 0.9;

      // SPAWN ITEMS
      this.lastSpawn += dt * 1000;
      while (this.lastSpawn > this.spawnEvery) {
        this.lastSpawn -= this.spawnEvery;
        this.safeSpawn();
      }
    }

    // DRAW GIFTS
    for (let i = this.gifts.length - 1; i >= 0; i--) {
      const g = this.gifts[i];
      g.x += g.vx * dt;
      this.drawGift(ctx, g);

      if (this.running) {
        const pw = this.plane.r * 1.8, ph = this.plane.r * 1.1;
        const px = this.plane.x - pw * 0.5;
        const py = this.plane.y - ph * 0.5;

        if (this.rectOverlap(px, py, pw, ph, g.x, g.y, g.w, g.h)) {
          this.emitconfetti_plane(g.x + g.w * 0.5, g.y + g.h * 0.5);
          this.score += 5;
          this.gifts.splice(i, 1);
          continue;
        }
      }

      if (g.x + g.w < -40 * this.DPR)
        this.gifts.splice(i, 1);
    }

    // DRAW OBSTACLES (BOMB)
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.x += o.vx * dt;

      this.drawBomb(ctx, o);

      if (this.running) {
        const pw = this.plane.r * 1.8, ph = this.plane.r * 1.1;
        const px = this.plane.x - pw * 0.5;
        const py = this.plane.y - ph * 0.5;

        if (this.rectOverlap(px, py, pw, ph, o.x, o.y, o.w, o.h)) {
          // explosion & game over
          this.explosions.push({
            x: o.x + o.w * 0.5, y: o.y + o.h * 0.5,
            vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
            life: 700, s: 18 * this.DPR, c: 'rgba(255,120,40,0.95)'
          });
          this.obstacles.splice(i, 1);
          this.showGameOver();
          continue;
        }
      }

      if (o.x + o.w < -50 * this.DPR)
        this.obstacles.splice(i, 1);
    }

    // confetti_plane DRAW
    for (let i = this.confetti_plane.length - 1; i >= 0; i--) {
      const p = this.confetti_plane[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.g;
      p.life -= dt * 1000;

      ctx.save();
      ctx.fillStyle = `hsl(${p.hue} 90% 60%)`;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.life % 300) / 1000);
      ctx.fillRect(-p.s * 0.5, -p.s * 0.5, p.s, p.s);
      ctx.restore();

      if (p.life <= 0 || p.y > this.H + 30)
        this.confetti_plane.splice(i, 1);
    }

    // EXPLOSIONS DRAW
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const e = this.explosions[i];
      e.x += e.vx;
      e.y += e.vy;
      e.vx *= 0.985;
      e.vy *= 0.985;
      e.life -= dt * 1000;

      ctx.fillStyle = e.c;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.s, 0, Math.PI * 2);
      ctx.fill();

      if (e.life <= 0)
        this.explosions.splice(i, 1);
    }

    // DRAW PLANE (on top)
    this.drawPlane(ctx);

    // Optionally draw HUD (score)
    ctx.save();
    ctx.fillStyle = '#013049';
    ctx.font = `${18 * this.DPR}px system-ui`;
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${Math.floor(this.score)}`, 14 * this.DPR, 28 * this.DPR);
    ctx.restore();

    // Next frame
    this.animationId = requestAnimationFrame(t => this.loop(t));
  }

  // ---------------------
  // COLLISION FUNCTION
  // ---------------------
  rectOverlap(ax: number, ay: number, aw: number, ah: number,
    bx: number, by: number, bw: number, bh: number): boolean {
    return ax < bx + bw && ax + aw > bx &&
      ay < by + bh && ay + ah > by;
  }

  // ---------------------
  // DRAW FUNCTIONS
  // ---------------------
  drawSky(ctx: CanvasRenderingContext2D) {
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, '#98ddff');
    g.addColorStop(1, '#e6f5ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);

    for (const c of this.clouds) {
      c.x -= c.s;
      if (c.x + c.w < 0) {
        c.x = this.W + 40 * this.DPR;
        c.y = Math.random() * this.H * 0.75;
      }
      this.puffy(ctx, c.x, c.y, c.w, c.h);
    }

    ctx.fillStyle = '#b7e9ff';
    ctx.fillRect(0, this.groundY, this.W, this.H - this.groundY);
  }

  drawPlane(ctx: CanvasRenderingContext2D) {
    const { x, y, r } = this.plane;
    const size = r * 2.5;

    ctx.save();
    ctx.translate(x, y);

    const tilt = Math.max(-0.8, Math.min(0.8, this.plane.vy / (this.MAXVY * 0.7)));
    ctx.rotate(tilt * 0.5);

    if (this.planeImg && this.planeImg.complete) {
      ctx.drawImage(this.planeImg, -size * 0.5, -size * 0.5, size, size);
    } else {
      // fallback: draw simple triangle plane
      ctx.fillStyle = '#114477';
      ctx.beginPath();
      ctx.moveTo(-size * 0.6, 0);
      ctx.lineTo(size * 0.6, -size * 0.35);
      ctx.lineTo(size * 0.6, size * 0.35);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawGift(ctx: CanvasRenderingContext2D, g: Gift) {
    if (g.img && g.img.complete) ctx.drawImage(g.img, g.x, g.y, g.w, g.h);
    else {
      ctx.fillStyle = '#ffdd66';
      ctx.fillRect(g.x, g.y, g.w, g.h);
    }
  }

  drawBomb(ctx: CanvasRenderingContext2D, o: Obstacle) {
    if (o.img && o.img.complete) ctx.drawImage(o.img, o.x, o.y, o.w, o.h);
    else {
      ctx.fillStyle = '#333';
      ctx.fillRect(o.x, o.y, o.w, o.h);
    }
  }

  // Tap-to-start overlay (circle centered)
  drawTapToStartOverlay(ctx: CanvasRenderingContext2D) {
    const radius = Math.min(this.W, this.H) * 0.18; // responsive radius

    // Draw soft circular background (only the circle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.W / 2, this.H / 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fill();
    ctx.closePath();

    // optional ring
    ctx.beginPath();
    ctx.arc(this.W / 2, this.H / 2, radius + 6 * this.DPR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,0.15)`;
    ctx.lineWidth = 2 * this.DPR;
    ctx.stroke();
    ctx.closePath();

    // text
    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.max(22, 36 * this.DPR)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Tap to Start", this.W / 2, this.H / 2);

    ctx.restore();
  }

  // CLOUD PUFF DRAWING
  puffy(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.save();
    const r = h * 0.35;
    const cx = x + w * 0.5;
    const cy = y + h * 0.5;

    const grad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(1, "rgba(255,255,255,0.7)");

    ctx.fillStyle = grad;
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    ctx.arc(cx - r * 1.2, cy, r, 0, Math.PI * 2);
    ctx.arc(cx, cy - r * 0.8, r * 1.1, 0, Math.PI * 2);
    ctx.arc(cx + r * 1.2, cy, r, 0, Math.PI * 2);
    ctx.arc(cx, cy + r * 0.8, r * 0.9, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
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
