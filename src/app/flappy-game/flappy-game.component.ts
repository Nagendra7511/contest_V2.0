import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { UtilService } from '../services/util.service';
import { AnalyticsService } from '../services/analytics.service';
import { AuthService } from '../services/auth.service';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';
import { ElementRef, ViewChild, AfterViewInit, HostListener} from '@angular/core';
import { ConfittiComponent } from '../confitti/confitti.component';
import { Location } from '@angular/common';
import { LocationService } from '../services/location.service';

@Component({
  selector: 'app-flappy-game',
  standalone: true,
  imports: [CommonModule, RouterLink, LoginModalComponent, ProfileModalComponent, ConfittiComponent],
  templateUrl: './flappy-game.component.html',
  styleUrl: './flappy-game.component.css',
})
export class FlappyGameComponent implements OnInit, OnDestroy {

  @ViewChild('gameCanvas', { static: false })
  canvasRef!: ElementRef<HTMLCanvasElement>;
  ctx!: CanvasRenderingContext2D;
  canvas!: HTMLCanvasElement;

  bird: any;
  pipes: any[] = [];
  powerUps: any[] = [];
  score = 0;
  gameSpeed = 2;
  gravity = 0.4;
  gameRunning = false;

  birdImage = new Image();
  pipeImage = new Image();
  backgroundImage = new Image();
  icon1 = new Image();
  icon2 = new Image();
  icon3 = new Image();

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

    //  this.birdImage.src =
    //   'https://w7.pngwing.com/pngs/576/690/png-transparent-flappy-bird-new-bee-flappy-flying-bird-game-animals-bird.png';
    // this.pipeImage.src = 'https://i.postimg.cc/9ffPTvtS/pipe.png';
    // this.backgroundImage.src =
    //   'https://i.postimg.cc/1tJ47PWk/platform-game-background-template-1298309-35723.avif';
    // this.icon1.src =
    //   'https://cdn-icons-png.flaticon.com/512/1046/1046784.png'; 
    // this.icon2.src =
    //   'https://cdn-icons-png.flaticon.com/512/733/733201.png'; 
    //   this.icon3.src =
    //   'https://cdn-icons-png.flaticon.com/512/733/733201.png'; 

  // Bird Image
    this.pipeImage.src = 'https://i.postimg.cc/9ffPTvtS/pipe.png';
    this.birdImage.src = this.contest?.game_config?.images?.['Falppy Bird'] || 'https://i.postimg.cc/FFccrS7R/flappy.png';
    this.backgroundImage.src = this.contest?.game_config?.['images?.Flappy-game-Background'] || 'https://i.postimg.cc/1tJ47PWk/platform-game-background-template-1298309-35723.avif';
    this.icon1.src = this.contest?.game_config.images?.['Power-up1'] || '';
    this.icon2.src = this.contest?.game_config.images?.['Power-up2'] || '';
    this.icon3.src = this.contest?.game_config.images?.['Power-up3'] || '';
  }

  showModal = false;
  showProfileModal = false;
  isWaitingForStart = false;
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

    document.body.classList.add('flappy-active');

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

      this.pipeImage.src ='https://i.postimg.cc/9ffPTvtS/pipe.png';
      this.birdImage.src = this.contest?.game_config?.images?.['Falppy Bird'] || 'https://i.postimg.cc/FFccrS7R/flappy.png';
      this.backgroundImage.src = this.contest?.game_config?.['images?.Flappy-game-Background'] || 'https://i.postimg.cc/tTSFY7HX/flappy-bg-white.png';
      this.icon1.src = this.contest?.game_config.images?.['Power-up1'] || '';
      this.icon2.src = this.contest?.game_config.images?.['Power-up2'] || '';
      this.icon3.src = this.contest?.game_config.images?.['Power-up3'] || ''; 

       //total counts contests
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
      // console.log('Has played:', hasPlayed);
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
      document.body.classList.remove('flappy-active');
    }
    if (isPlatformBrowser(this.platformId)) {
    window.removeEventListener('popstate', this.handleBackNavigation);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }
    this.pauseMusic();
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
  ).then(() => {});
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

  this.playMusic();
  this.showWelcomeScreen = false;
  this.showGamePanel = true;
  this.showGameUpdate = false;

  this.loading = true;
  await this.preloadImages([
    this.pipeImage.src,
    this.birdImage.src,
    this.backgroundImage.src,
    this.icon1.src,
    this.icon2.src,
    this.icon3.src,
  ]);
  this.loading = false;

  this.analyticsService.sendEvent('game_start', {
    game_type: 'flappy-bird',
    contest_id: this.contest.contest_id
  });

  if (!isPlatformBrowser(this.platformId)) return;

  setTimeout(() => {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.canvas.width = window.innerWidth * 0.9;
    this.canvas.height = window.innerHeight * 0.6;

    this.bird = {
      x: 50,
      y: this.canvas.height / 2,
      size: 30,
      velocity: 0,
      flapStrength: -6,
      update: () => {
        this.bird.velocity += this.gravity;
        this.bird.y += this.bird.velocity;
        this.bird.y = Math.max(
          0,
          Math.min(this.bird.y, this.canvas.height - this.bird.size)
        );
      },
      draw: () => {
        this.ctx.drawImage(
          this.birdImage,
          this.bird.x - this.bird.size,
          this.bird.y - this.bird.size,
          this.bird.size * 2,
          this.bird.size * 2
        );
      },
      flap: () => {
        this.bird.velocity = this.bird.flapStrength;
      },
    };

    // RESET GAME STATE
    this.pipes = [];
    this.powerUps = [];
    this.score = 0;

    // Do NOT start game yet → wait for tap
    this.gameRunning = false;
    this.isWaitingForStart = true;

    // Show Tap to Play
    this.drawStartScreen();

  }, 0);
}
 
drawStartScreen() {
  if (!this.ctx) return;

  // Background
  this.ctx.drawImage(
    this.backgroundImage,
    0,
    0,
    this.canvas.width,
    this.canvas.height
  );

  // Bird idle
  this.bird.draw();

  // TAP TO PLAY TEXT
  this.ctx.fillStyle = 'green';
  this.ctx.font = '36px Arial';
  this.ctx.textAlign = 'center';
  this.ctx.fillText(
    'Tap to Play',
    this.canvas.width / 2,
    this.canvas.height / 2
  );
}





    gameLoop() {
  // Stop running if waiting
  if (this.isWaitingForStart) {
    this.drawStartScreen();
    return;
  }

  if (!this.gameRunning) return;

  this.ctx.drawImage(
    this.backgroundImage,
    0,
    0,
    this.canvas.width,
    this.canvas.height
  );

  this.bird.update();
  this.bird.draw();

  this.pipes.forEach((pipe, i) => {
    pipe.x -= this.gameSpeed;
    this.ctx.drawImage(
      this.pipeImage,
      pipe.x,
      pipe.y,
      pipe.width,
      pipe.height
    );

    if (pipe.x + pipe.width < 0) this.pipes.splice(i, 1);

    const b = this.bird;
    if (
      b.x + b.size > pipe.x &&
      b.x - b.size < pipe.x + pipe.width &&
      b.y + b.size > pipe.y &&
      b.y - b.size < pipe.y + pipe.height
    ) {
      this.endGame();
    }
  });

  this.powerUps.forEach((p, i) => {
    p.x -= this.gameSpeed;

    if (!p.collected) {
      this.ctx.drawImage(
        p.image,
        p.x - p.size / 2,
        p.y - p.size / 2,
        p.size,
        p.size
      );
    } else if (p.blastTimer < 10) {
      p.blastTimer++;
      this.ctx.font = '28px Arial';
      this.ctx.fillStyle = 'red';
      this.ctx.fillText('💥', p.x, p.y);
    }

    const dx = p.x - this.bird.x;
    const dy = p.y - this.bird.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (!p.collected && distance < p.size/1.2) {
      this.score += 50;
      p.collected = true;
    }

    if (p.x + p.size < 0 || (p.collected && p.blastTimer > 10)) {
      this.powerUps.splice(i, 1);
    }
  });

  const pipeSpacing = 400;

  if (
    this.pipes.length === 0 ||
    this.pipes[this.pipes.length - 1].x < this.canvas.width - pipeSpacing
  ) {
    this.spawnPipes();
  }

  this.ctx.fillStyle = 'red';
  this.ctx.font = '24px Arial';
  this.ctx.textAlign = 'right';
  this.ctx.fillText(`Score: ${this.score}`, this.canvas.width - 20, 40);

  this.score++;
  requestAnimationFrame(() => this.gameLoop());
}


  spawnPipes() {
    const gapHeight = 260;
    const pipeWidth = 30;
    const topHeight = Math.random() * (this.canvas.height / 2);
    const bottomY = topHeight + gapHeight;

    this.pipes.push({
      x: this.canvas.width,
      y: 0,
      width: pipeWidth,
      height: topHeight,
    });
    this.pipes.push({
      x: this.canvas.width,
      y: bottomY,
      width: pipeWidth,
      height: this.canvas.height - bottomY,
    });

    const emojiOptions = [
      { image: this.icon1, type: 'choco' },
      { image: this.icon2, type: 'bomb' },
       { image: this.icon3, type: 'bird' },
    ];
    const selected =
      emojiOptions[Math.floor(Math.random() * emojiOptions.length)];
    const emojiY = topHeight + gapHeight / 2;

    this.powerUps.push({
      x: this.canvas.width + pipeWidth / 2,
      y: emojiY,
      size: 50,
      image: selected.image,
      type: selected.type,
      collected: false,
      blastTimer: 0,
    });
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

    this.gameRunning = false;   
    this.bird.draw();

    this.sendResultToApi(false, this.score);
    this.confetti = true;

    this.cdr.detectChanges();

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
    }, 3500); 
    
  }

@HostListener('window:click')
@HostListener('window:touchstart')
@HostListener('window:keydown', ['$event'])
flapBird(event?: KeyboardEvent | TouchEvent) {

  // FIRST TAP → Start Game
  if (this.isWaitingForStart) {
    this.isWaitingForStart = false;
    this.gameRunning = true;

    this.spawnPipes();
    this.gameLoop();
    return; 
  }

  if (!this.gameRunning) return;

  if (event instanceof KeyboardEvent) {
    if (event.code === 'Space') {
      event.preventDefault();
      this.bird.flap();
    }
  } else {
    this.bird.flap();
  }
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
   // Navigating to contest
  // async onGameFinished() {
  //   const success = await this.utilService.submitPlay();
  //   if (success) {
  //   } else {
  //     console.error('Failed to update participation');
  //   }
  //   this.utilService.clearPlayState();
  // }
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
  handleBackNavigation = (event: PopStateEvent ) => {
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
