import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
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

interface GameImage {
  top: number;
  left: number;
  size: number;
  url: string;
  shape: string;
}

@Component({
  selector: 'app-click-game',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileModalComponent, LoginModalComponent, ConfittiComponent],
 templateUrl: './click-game.component.html',
  styleUrls: ['./click-game.component.css']
})
export class ClickGameComponent implements OnInit, OnDestroy {
  score = 0;
  timeLeft = 300;
  started = false;
  gameOver = false;
  timer: any;
  currentImage: GameImage | null = null;
 
    
    totalScore = 0;
  
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
      private location: Location
    ) { }

  // imageList: string[] = [
  //   'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRggFyhY0QDqwzlnwaShoNcjY2d2rAc5tDYKmCyeWRlVrMDDPPR3O5oxgx899gv61-hQA4&usqp=CAU',
  //   'https://www.mockofun.com/wp-content/uploads/2019/12/circle-photo.jpg',
  // ];
  
  imageList: string[] = [];

  // Supported shape classes
  shapes: string[] = ['circle', 'triangle','square', 'star'];

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
      ($('#infoModal') as any).modal('show');
    }
  }
  
    async loadGameData(): Promise<void> {
      document.body.classList.add('price-active');
      
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
            this.imageList = this.contest.game_config.images;       
            this.showWelcomeScreen = true;
            this.loading = false;
            this.admin_view = true;
            return;
          }
        }
  
        

        this.imageList = this.contest.game_config.images;
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
       const hasPlayed = await this.supabaseService.checkIfContestPlayed({
        contestId: this.contest.contest_id,
        customerId: this.userId ?? null,
         instaUserId: this.instaUserId ?? null
      });
        this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
  
        if (hasPlayed) {
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
       
        if (hasPlayed) {
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
    this.clearTimer();
     if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('price-active');
    }
    if (isPlatformBrowser(this.platformId) && this.timer) {
      clearInterval(this.timer);
    }
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('popstate', this.handleBackNavigation);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
    this.pauseMusic();
  }

  async startGame(): Promise<void> {
    ($('#infoModal') as any).modal('hide');
    document.body.classList.add('game-running');
    this.onGameFinished();
    this.customerCreateOnStore();
    if ( !this.contest?.contest_id) return;
     const hasPlayed = await this.supabaseService.checkIfContestPlayed({
        contestId: this.contest.contest_id,
        customerId: this.userId ?? null,
         instaUserId: this.instaUserId ?? null
      });
    if (hasPlayed) {
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
    this.timeLeft = this.contest.game_config.time_limit || 60;
    
    this.imageList = this.contest.game_config.images;

    this.loading = true;
    await this.preloadImages(this.imageList);
    this.loading = false;
    
     this.showNewImage();

    this.analyticsService.sendEvent('game_start', {
      game_type: 'click-game',
      contest_id: this.contest.contest_id
    });

    if (!isPlatformBrowser(this.platformId)) return;
    this.startTimer();
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


  startTimer(): void {
    this.timer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.clearTimer();
        this.endGame();
      }
    }, 1000);
  }

  clearTimer(): void {
    if (this.timer) clearInterval(this.timer);
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


  

  // Random image + shape generation
  showNewImage(): void {
    this.currentImage = {
      top: this.randomInt(5, 70),
      left: this.randomInt(5, 70),
      size: this.randomInt(8, 20),
      url: this.imageList[this.randomInt(0, this.imageList.length - 1)],
      shape: this.shapes[this.randomInt(0, this.shapes.length - 1)]
    };
  }

  randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  onImageClick(): void {
    if (!this.showGamePanel || this.gameOver) return;
    this.score++;
    this.showNewImage();
  }


  endGame(): void {
    this.currentImage = null;
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.timer) clearInterval(this.timer);
    this.totalScore = this.score;
    this.sendResultToApi(false, this.totalScore);
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
      this.endGame();
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
  
}
  
