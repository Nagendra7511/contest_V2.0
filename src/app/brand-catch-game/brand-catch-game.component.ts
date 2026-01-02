import { ElementRef, ViewChild, OnInit, Renderer2, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnDestroy, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
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
  selector: 'app-brand-catch-game',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileModalComponent, LoginModalComponent, ConfittiComponent],
  templateUrl: './brand-catch-game.component.html',
  styleUrls: ['./brand-catch-game.component.css']
})
export class BrandCatchGameComponent implements OnInit, OnDestroy {
  @ViewChild('gameArea') gameArea?: ElementRef;

  private _basket?: ElementRef;
  @ViewChild('basket')
  set basketRef(el: ElementRef | undefined) {
    if (el) {
      this._basket = el;
      this.initBasketPosition();
    }
  }
  get basket(): ElementRef | undefined {
    return this._basket;
  }

  score = 0;
  gameOver = false;
  basketX = 0;
  spawnInterval: any;
  dragging = false;
  timeLeft = 100;
  timer: any;


  // NEW FLAG — controls tap overlay
  allowSpawning = false;

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
  profile: any = null;
  instaUserId: string | null = null;
insta_flow_LoginButton = false;
hasPlayed = false;

  // brandImages = [
  //   'https://i.postimg.cc/FFccrS7R/flappy.png',
  //   'https://i.postimg.cc/FFccrS7R/flappy.png',
  //   'https://i.postimg.cc/FFccrS7R/flappy.png',
  // ];

  brandImages = [];

  constructor(
    private renderer: Renderer2,
    private router: Router,
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private authserivice: AuthService,
    public utilService: UtilService,
    private analyticsService: AnalyticsService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef,
    private locationService: LocationService,
    private location: Location
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
      this.showModal = false;
      this.showLoginButton = false;
      this.showProfileModal = false;
      const updatedProfile = await this.supabaseService.getProfile(this.userId!);
      const isComplete = !!updatedProfile?.first_name?.trim();
      this.authserivice.setProfileComplete(isComplete);
            this.insta_flow_LoginButton = false;
            if (!this.hasPlayed) {
              ($('#infoModal') as any).modal('show');
            }
    }
  }

  async loadGameData(): Promise<void> {
    document.body.classList.add('brand-catch-active');

    const contestId = this.route.snapshot.queryParamMap.get('cid');
    const insta_user_ig = this.route.snapshot.queryParamMap.get('ig');

        // 🔍 Fetch insta user if IG param exists
    if (insta_user_ig) {
      const instaData = await this.supabaseService.getContestInstaId(insta_user_ig);

      if (!instaData) {
        // console.error('Invalid insta_user_ig');
        return;
      }

      this.instaUserId = instaData.insta_user; // ✅ actual insta user ID
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
          this.brandImages = this.contest.game_config.images;
          this.showWelcomeScreen = true;
          this.loading = false;
          this.admin_view = true;
          return;
        }
      }

      
      this.brandImages = this.contest.game_config.images;
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

      this.hasPlayed = await this.supabaseService.checkIfContestPlayed({
        contestId: this.contest.contest_id,
        customerId: this.userId ?? null,
         instaUserId: this.instaUserId ?? null
      });

      this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);

      if (this.hasPlayed) {
        const data = await this.supabaseService.getUserResult({
          contestId: this.contest.contest_id,
          customerId: this.userId ?? null,
          instaUserId: this.instaUserId ?? null
        });
        this.gameResult = data;
        this.showWelcomeScreen = false;
        this.showGamePanel = false;
        this.showGameResult = true;
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
          ? await this.supabaseService.validateAndUpdateInstaUser(insta_user_ig)
          : await this.supabaseService.validateAndUpdateInstaUser(
            insta_user_ig,
            await this.supabaseService.getProfile(this.userId!)
          );
         
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



  /** Initialize basket position */
  private initBasketPosition() {
    if (!this.basket) return;
    this.basketX = window.innerWidth / 2 - 60;
    this.basket.nativeElement.style.left = `${this.basketX}px`;
  }

  /** STEP 1 – From Welcome → Game Panel (Tap overlay) */

  async startGame(): Promise<void> {
    ($('#infoModal') as any).modal('hide');
    document.body.classList.add('game-running');
    // this.onGameFinished();
    // this.customerCreateOnStore();
    if (!this.contest?.contest_id) return;
     this.hasPlayed = await this.supabaseService.checkIfContestPlayed({
        contestId: this.contest.contest_id,
        customerId: this.userId ?? null,
         instaUserId: this.instaUserId ?? null
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
    this.loading = true;
    this.gameOver = false;
    this.score = 0;
    this.timeLeft = this.contest.game_config.time_limit || 90;

    this.brandImages = this.contest.game_config.images;

    this.loading = true;
    await this.preloadImages(this.brandImages);
    this.loading = false;



    this.analyticsService.sendEvent('game_start', {
      game_type: 'brand-catch-game',
      contest_id: this.contest.contest_id
    });
    this.score = 0;
    this.gameOver = false;
    this.allowSpawning = false; // show the tap-to-play overlay

    if (this.spawnInterval) {
      clearInterval(this.spawnInterval);
    }

  }

  private preloadImages(images: string[]): Promise<void> {
    return Promise.all(
      images.map((src) => {
        return new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.src = src;
          img.onload = () => resolve();
          img.onerror = () => {
            console.error(`Failed to load image: ${src}`);
            resolve(); // resolve anyway to avoid blocking the game
          };
        });
      })
    ).then(() => { });
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

    startTimer(): void {
    this.timer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.clearTimer();
        this.finishGame();
      }
    }, 1000);
  }

  clearTimer(): void {
    if (this.timer) clearInterval(this.timer);
  }

  ngOnDestroy(): void {
    this.clearTimer();
    
    if (isPlatformBrowser(this.platformId) && this.timer) {
      clearInterval(this.timer);
    }

    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('brand-catch-active');
    }

    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('popstate', this.handleBackNavigation);
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
    this.pauseMusic();
  }


  /** STEP 2 – Tap overlay clicked → Start falling items */
  beginActualGameplay() {
    if (this.allowSpawning) return;

    this.allowSpawning = true;
    // if (!isPlatformBrowser(this.platformId)) return;
    this.startTimer();
    // start falling
    this.spawnInterval = setInterval(() => this.spawnItem(), 900);
  }

  /** Pointer / drag controls */
  onPointerDown(event: any) {
    if (this.gameOver || !this.showGamePanel) return;
    this.dragging = true;
    event.preventDefault();
  }

  onPointerUp() {
    this.dragging = false;
  }

  onPointerMove(event: any) {
    if (!this.dragging || this.gameOver || !this.showGamePanel || !this.basket)
      return;

    let clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;

    this.basketX = clientX - 60;

    if (this.basketX < 0) this.basketX = 0;
    if (this.basketX > window.innerWidth - 120)
      this.basketX = window.innerWidth - 120;

    this.basket.nativeElement.style.left = `${this.basketX}px`;
  }

  /** Click left/right halves to move basket */
  clickMove(event: MouseEvent) {
    if (this.gameOver || !this.showGamePanel || !this.basket) return;

    if (!this.allowSpawning) return; // block basket movement before tap-to-play

    const mid = window.innerWidth / 2;
    this.basketX += event.clientX < mid ? -50 : 50;

    if (this.basketX < 0) this.basketX = 0;
    if (this.basketX > window.innerWidth - 120)
      this.basketX = window.innerWidth - 120;

    this.basket.nativeElement.style.left = `${this.basketX}px`;
  }

  /** Keyboard control */
  @HostListener('window:keydown', ['$event'])
  keyMove(event: KeyboardEvent) {
    if (this.gameOver || !this.showGamePanel || !this.basket) return;
    if (!this.allowSpawning) return; // block before tap-to-play

    if (event.key === 'ArrowLeft') {
      this.basketX -= 30;
    } else if (event.key === 'ArrowRight') {
      this.basketX += 30;
    } else {
      return;
    }

    if (this.basketX < 0) this.basketX = 0;
    if (this.basketX > window.innerWidth - 120)
      this.basketX = window.innerWidth - 120;

    this.basket.nativeElement.style.left = `${this.basketX}px`;
    event.preventDefault();
  }

  /** Spawn items (only when allowSpawning = true) */
  spawnItem() {
    if (!this.allowSpawning || this.gameOver || !this.gameArea) return;

    const img: HTMLImageElement = this.renderer.createElement('img');
    img.src = this.brandImages[Math.floor(Math.random() * this.brandImages.length)];
    this.renderer.addClass(img, 'falling');

    const startX = Math.random() * (window.innerWidth - 60);
    img.style.left = `${startX}px`;
    img.style.top = '-70px';

    this.renderer.appendChild(this.gameArea.nativeElement, img);

    const speed = 3 + Math.random() * 2;

    const fall = () => {
      if (this.gameOver) return;

      const y = parseFloat(img.style.top);
      img.style.top = `${y + speed}px`;

      const imgRect = img.getBoundingClientRect();
      const basketRect = this.basket?.nativeElement.getBoundingClientRect();

      // Basket collision
      if (
        basketRect &&
        imgRect.bottom >= basketRect.top &&
        imgRect.left < basketRect.right &&
        imgRect.right > basketRect.left &&
        imgRect.bottom <= basketRect.bottom + 40
      ) {
        this.createPop(imgRect.left + 25, imgRect.top + 25);
        this.score += 50;
        this.renderer.removeChild(this.gameArea!.nativeElement, img);
        return;
      }

      // Floor hit → game over
      if (imgRect.bottom >= window.innerHeight - 40) {
        this.renderer.removeChild(this.gameArea!.nativeElement, img);
        this.finishGame();
        return;
      }

      requestAnimationFrame(fall);
    };

    fall();
  }

  createPop(x: number, y: number) {
    if (!this.gameArea) return;
    const pop = this.renderer.createElement('div');
    pop.className = 'pop';
    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
    this.renderer.appendChild(this.gameArea.nativeElement, pop);

    setTimeout(() => pop.remove(), 400);
  }

  /** End game */
  finishGame() {
    if (this.gameOver) return;
    this.gameOver = true;

    if (this.spawnInterval) {
      clearInterval(this.spawnInterval);
    }

    this.sendResultToApi(false, this.score);
    this.confetti = true;
    this.cdr.detectChanges();

    setTimeout(async () => {
      this.gameOver = true;
      this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
      this.pauseMusic();
      this.showGamePanel = false;
      this.showGameUpdate = true;
      this.confetti = false;
      document.body.classList.remove('game-running');
    }, 3500);
  }

  restartGame() {
    this.score = 0;
    this.gameOver = false;

    this.showWelcomeScreen = true;
    this.showGamePanel = false;
    this.showGameUpdate = false;
    this.allowSpawning = false;
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
      this.finishGame();
      history.pushState(null, '', window.location.href);
    }
  };
  handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (this.showGamePanel) {
      event.preventDefault();
      event.returnValue = '';
      this.finishGame();
      history.pushState(null, '', window.location.href);
    }
  };
}
