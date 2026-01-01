import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, ChangeDetectorRef, PLATFORM_ID, ElementRef, ViewChild, AfterViewInit, HostListener} from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { UtilService } from '../services/util.service';
import { AnalyticsService } from '../services/analytics.service';
import { AuthService } from '../services/auth.service';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';
import { ConfittiComponent } from '../confitti/confitti.component';
import { Location } from '@angular/common';
import { LocationService } from '../services/location.service';
// import { console } from 'node:inspector';

@Component({
  selector: 'app-dino-game',
  imports: [CommonModule, RouterLink, LoginModalComponent, ProfileModalComponent, ConfittiComponent],
  templateUrl: './dino-game.component.html',
  styleUrl: './dino-game.component.css'
})
export class DinoGameComponent implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild('gameCanvas', { static: false })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  ctx!: CanvasRenderingContext2D;
  assetsLoaded = false;

  // New state for tap-to-play
  waitingForTap = false;
  private canvasPointerDownHandler?: (e: Event) => void;

  // Game variables
  dino = { x: 50, y: 0, width: 50, height: 50, vy: 0, jumping: false };
  obstacles: any[] = [];
  score = 0;
  speed = 200;
  spawnInterval = 1500;
  spawnTimer = 0;
  groundY = 0;
  gameOver = false;
  running = false;
  lastTime = 0;

  // Assets
  dinoImg = new Image();
  poleImg = new Image();

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

  gameMusic!: HTMLAudioElement;
  isMusicPlaying = false;
  profile: any = null;
  instaUserId: string | null = null;

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
    private location: Location
  ) { }

  async ngOnInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('popstate', this.handleBackNavigation);
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    }

    const profile = await this.supabaseService.getProfile(this.userId!);
    this.profile = profile;

    this.initMusic();
    this.loadGameData();

  }

  // Assets

  powerUpImg = new Image();

  // Power-ups
  powerUps: any[] = [];

  ngAfterViewInit(): void {


    let loaded = 0;
    const totalAssets = 3;
    const onLoad = () => {
      loaded++;
      if (loaded === totalAssets) {
        this.assetsLoaded = true;
      }
    };
    this.dinoImg.onload = onLoad;
    this.poleImg.onload = onLoad;
    this.powerUpImg.onload = onLoad;
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
      ($('#infoModal') as any).modal('show');
    }
  }


  async loadGameData(): Promise<void> {
    document.body.classList.add('dino-active');

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

    // Store user_inst_ID in localStorage
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
      // console.log('Contest Data:', contestData);
      if (!contestData) throw new Error('Contest not found');
      this.contest = contestData;

      const now = new Date();
      const expDate = new Date(contestData.end_date);
      this.contest_Expired = expDate < now;

      const timeDiff = expDate.getTime() - now.getTime();
      this.daysLeft = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));

      // Check if brand or not
      if (brandUser && brandUser.length > 0) {
        this.store_id = brandUser[0].store_id;
        const brandContest = await this.supabaseService.getBrandContestsByID(contestId);

        //total counts contests
        const brandData = await this.supabaseService.getBrandStoreID(this.store_id!);
        this.brand = brandData || [];
        this.totalResultCount = this.brand.reduce((sum: number, contest: any) => sum + (contest.result_count || 0), 0);


        this.participationCount = await this.supabaseService.getContestCount(contestId)
        if (brandContest) {
          this.contest = brandContest;
          this.showWelcomeScreen = true;
          this.loading = false;
          this.admin_view = true;
          return;
        }
      }

      
      // 🔹 Location restriction check
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

      this.poleImg.src = 'https://i.postimg.cc/Zq4xPqRf/fire.png';
      this.dinoImg.src = this.contest?.game_config.images.image1 || 'https://i.postimg.cc/137GjQJr/dragon.png';
      this.powerUpImg.src = this.contest?.game_config.images.image2 || 'https://i.postimg.cc/6QyTynzr/star.png';



      //total counts contests
      const brandData = await this.supabaseService.getBrandStoreID(this.store_id!);
      this.brand = brandData || [];
      this.totalResultCount = this.brand.reduce((sum: number, contest: any) => sum + (contest.result_count || 0), 0);
     const hasPlayed = await this.supabaseService.checkIfContestPlayed({
        contestId: this.contest.contest_id,
        customerId: this.userId ?? null,
         instaUserId: this.instaUserId ?? null
      });
      this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
      // console.log('Has played:', hasPlayed);
      if (hasPlayed) {
        //  this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);

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


      // Check if contest is Loggedin or not
      if (!this.isLoggedIn) {
        this.showLoginButton = true;
        this.loading = false;
        return;
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

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('dino-active');
    }
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('popstate', this.handleBackNavigation);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
    this.pauseMusic();

    // remove canvas pointer listener if attached
    if (this.canvasRef?.nativeElement && this.canvasPointerDownHandler) {
      try {
        this.canvasRef.nativeElement.removeEventListener('pointerdown', this.canvasPointerDownHandler);
      } catch (e) {
        // ignore
      }
      this.canvasPointerDownHandler = undefined;
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

  async startGame(): Promise<void> {
    ($('#infoModal') as any).modal('hide');
    document.body.classList.add('game-running');
    this.onGameFinished();
    this.customerCreateOnStore();
    if (!this.contest?.contest_id) return;
     const hasPlayed = await this.supabaseService.checkIfContestPlayed({
        contestId: this.contest.contest_id,
        customerId: this.userId ?? null,
         instaUserId: this.instaUserId ?? null
      });
    if (hasPlayed) {
      this.loadGameData();
      return;
    }

    this.analyticsService.sendEvent('game_start', {
      game_type: 'dino-bird',
      contest_id: this.contest.contest_id
    });

    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.assetsLoaded) return;

    // Prepare UI state: show the game canvas/panel but DON'T start the loop yet.
    this.showWelcomeScreen = false;
    this.showGamePanel = true;
    this.showGameUpdate = false;

    setTimeout(() => {
      const ctx = this.canvasRef.nativeElement.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      this.ctx = ctx;

      this.resizeCanvas();
      this.resetGame();

      // Draw the initial tap-to-play overlay (not running yet).
      this.drawTapToPlayOverlay();

      // Set waiting state and attach pointerdown to canvas to start on user action.
      this.waitingForTap = true;
      // Use pointerdown for mouse/touch/finger/stylus
      this.canvasPointerDownHandler = (e: Event) => this.onCanvasTap(e as PointerEvent);
      this.canvasRef.nativeElement.addEventListener('pointerdown', this.canvasPointerDownHandler);
    }, 0);
  }

  resetGame() {
    this.obstacles = [];
    this.score = 0;
    this.speed = 200;
    this.spawnInterval = 1500;
    this.dino.vy = 0;
    this.dino.jumping = false;
    this.gameOver = false;
    this.dino.y = this.groundY - this.dino.height;
    this.lastTime = performance.now();
    this.spawnTimer = 0;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  gameLoop(timestamp: number) {
    if (!this.running) return;

    const delta = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    this.update(delta);
    this.draw();

    requestAnimationFrame(this.gameLoop.bind(this));
  }

  update(delta: number) {
    if (this.gameOver) return;

    // Dino physics
    this.dino.vy += 800 * delta;
    this.dino.y += this.dino.vy * delta;
    if (this.dino.y > this.groundY - this.dino.height) {
      this.dino.y = this.groundY - this.dino.height;
      this.dino.vy = 0;
      this.dino.jumping = false;
    }

    // Spawn obstacles
    this.spawnTimer += delta * 1000;
    if (this.spawnTimer > this.spawnInterval) {
      this.obstacles.push({ x: this.ctx.canvas.width, width: 20, height: 50 });

      // Occasionally spawn a power-up with the obstacle
      if (Math.random() < 0.5) {
        this.powerUps.push({
          x: this.ctx.canvas.width + 120,
          y: this.groundY - 50, // float above ground
          size: 50,
          collected: false,
          blastTimer: 0,
        });
      }

      this.spawnTimer = 0;
    }

    // Move obstacles & detect collision
    this.obstacles.forEach((obstacle) => {
      obstacle.x -= this.speed * delta;
      if (
        obstacle.x < this.dino.x + this.dino.width &&
        obstacle.x + obstacle.width > this.dino.x &&
        this.dino.y + this.dino.height > this.groundY - obstacle.height
      ) {
        this.endGame();
      }
    });

    // Remove off-screen obstacles
    this.obstacles = this.obstacles.filter((o) => o.x + o.width > 0);

    // Move power-ups & detect collision
    this.powerUps.forEach((p) => {
      p.x -= this.speed * delta;

      if (
        !p.collected &&
        p.x < this.dino.x + this.dino.width &&
        p.x + p.size > this.dino.x &&
        p.y + p.size > this.dino.y &&
        p.y < this.dino.y + this.dino.height
      ) {
        p.collected = true;
        this.score += 50; // bonus score
      }
    });

    // Remove off-screen power-ups
    this.powerUps = this.powerUps.filter((p) => p.x + p.size > 0);

    // Increase score gradually
    this.score += delta * 10;
  }

  draw() {
    if (!this.ctx) return;
    const canvas = this.ctx.canvas;
    // since we set transform in resizeCanvas to scale by dpr,
    // drawing coordinates use CSS pixels (groundY/dino.y are in CSS pixels)
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Ground line
    this.ctx.fillStyle = '#1ABC9C';
    this.ctx.fillRect(0, this.groundY, canvas.width, 2);

    // Dino
    try {
      this.ctx.drawImage(
        this.dinoImg,
        this.dino.x,
        this.dino.y,
        this.dino.width,
        this.dino.height
      );
    } catch (e) {
      // fallback rectangle if image not ready
      this.ctx.fillStyle = '#333';
      this.ctx.fillRect(this.dino.x, this.dino.y, this.dino.width, this.dino.height);
    }

    // Obstacles
    this.obstacles.forEach((o) => {
      try {
        this.ctx.drawImage(
          this.poleImg,
          o.x,
          this.groundY - o.height,
          o.width,
          o.height
        );
      } catch (e) {
        this.ctx.fillStyle = 'red';
        this.ctx.fillRect(o.x, this.groundY - o.height, o.width, o.height);
      }
    });

    // Power-ups
    this.powerUps.forEach((p) => {
      if (!p.collected) {
        try {
          this.ctx.drawImage(this.powerUpImg, p.x, p.y, p.size, p.size);
        } catch (e) {
          this.ctx.fillStyle = 'yellow';
          this.ctx.fillRect(p.x, p.y, p.size, p.size);
        }
      } else if (p.blastTimer < 10) {
        p.blastTimer++;
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = 'red';
        this.ctx.fillText('💥+50', p.x, p.y);
      }
    });

    // Score
    this.ctx.fillStyle = '#000';
    this.ctx.font = '18px Arial';
    this.ctx.fillText(`Score: ${Math.floor(this.score)}`, 60, 50);
  }

  @HostListener('window:resize')
  resizeCanvas() {
    if (!this.canvasRef || !this.canvasRef.nativeElement) return;
    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.min(window.innerWidth - 40, 1000);
    const cssH = Math.max(250, Math.min(400, Math.round(cssW * 0.33)));
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    if (!this.ctx) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      this.ctx = ctx;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.groundY = cssH - 40;
    this.dino.y = this.groundY - this.dino.height;

    // If we're showing the tap overlay, redraw it so it aligns to new size
    if (this.waitingForTap) {
      this.drawTapToPlayOverlay();
    } else if (this.running) {
      // draw a frame to adjust to resize
      this.draw();
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (!this.running) return;               // require game running
    if (event.code === 'Space' && !this.dino.jumping && !this.gameOver) {
      this.jump();
    }
  }

  @HostListener('window:click', ['$event'])
  handleMouseClick(event: MouseEvent) {
    if (!this.running) return;               // require game running
    if (!this.dino.jumping && !this.gameOver) {
      this.jump();
    }
  }

  @HostListener('window:touchstart', ['$event'])
  handleTouch(event: TouchEvent) {
    if (!this.running) return;               // require game running
    if (!this.dino.jumping && !this.gameOver) {
      this.jump();
    }
  }

  jump() {
    this.dino.vy = -400;
    this.dino.jumping = true;
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

  endGame(): void {

    if (!isPlatformBrowser(this.platformId)) return;
    if (this.gameOver) return;
    this.gameOver = true;
    this.running = false;

    this.score = Math.round(this.score);
    // console.log('Game Over! Final Score:', this.score);
    this.sendResultToApi(false, this.score);
    this.confetti = true;

    this.cdr.detectChanges();

    setTimeout(async () => {
      this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
      this.pauseMusic();
      this.showGamePanel = false;
      this.showGameUpdate = true;
      this.confetti = false;
      document.body.classList.remove('game-running');
    }, 3500);

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
      .then(() => {
        this.loading = false;
      })
      .catch((err: any) => {
        console.error(err);
        this.loading = false;
      });
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
      this.endGame();
      // stop them from leaving until score saved
      history.pushState(null, '', window.location.href);
    }
  };
  handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (this.showGamePanel) {
      event.preventDefault();     
      event.returnValue = '';  
      this.endGame();
      history.pushState(null, '', window.location.href);
    }
  };

  // ---------- Tap-to-play helpers ----------
  private onCanvasTap(ev: PointerEvent) {
    // Only proceed if we were waiting for the tap
    if (!this.waitingForTap) return;

    // Remove the listener right away
    if (this.canvasRef?.nativeElement && this.canvasPointerDownHandler) {
      this.canvasRef.nativeElement.removeEventListener('pointerdown', this.canvasPointerDownHandler);
      this.canvasPointerDownHandler = undefined;
    }
    this.waitingForTap = false;

    // Start the audio and the game loop
    this.playMusic();
    this.resetGame();
    this.start(); // starts the requestAnimationFrame loop and sets running = true

    // small visual: clear overlay and immediately draw initial frame
    this.draw();
  }

  private drawTapToPlayOverlay() {
    if (!this.ctx || !this.canvasRef?.nativeElement) return;
    const canvas = this.ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    // clear using full pixel size (clearRect expects device coords but transform is set)
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw basic scene: ground and dino
    // Ground (using CSS coordinates)
    this.ctx.fillStyle = '#1ABC9C';
    this.ctx.fillRect(0, this.groundY, cssW, 2);

    // draw dino (center-left)
    const dx = this.dino.x;
    const dy = this.dino.y;
    try {
      this.ctx.drawImage(this.dinoImg, dx, dy, this.dino.width, this.dino.height);
    } catch (e) {
      // If image not ready, draw a placeholder rectangle
      this.ctx.fillStyle = '#333';
      this.ctx.fillRect(dx, dy, this.dino.width, this.dino.height);
    }

    // Semi transparent dark overlay (cover full CSS area)
    this.ctx.save();
    this.ctx.globalAlpha = 0.6;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, cssW, cssH);
    this.ctx.restore();

    // "Tap to Play" text
    this.ctx.font = '30px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = '#fff';
    const cx = cssW / 2;
    const cy = this.groundY / 2;
    this.ctx.fillText('Tap to Play', cx, cy);

    // small hint under text
    this.ctx.font = '14px Arial';
    this.ctx.fillText('Tap or click the canvas to start', cx, cy + 36);
  }

}
