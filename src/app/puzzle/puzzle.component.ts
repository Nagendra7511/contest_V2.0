import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
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

interface Tile {
  id: number;
  value: string;
  flipped: boolean;
  matched: boolean;
}


@Component({
  selector: 'app-puzzle',
  standalone: true,
  imports: [CommonModule, RouterLink, LoginModalComponent, ProfileModalComponent, ConfittiComponent],
  templateUrl: './puzzle.component.html',
  styleUrl: './puzzle.component.css'
})
export class PuzzleComponent implements OnInit, OnDestroy {

  time = '01:00';
  timer: any;
  secondsLeft = 60;
  totalScore = 0;

  tiles: number[] = [];
  correctPositions: boolean[] = [];
  selectedTileIndex: number | null = null;
  gridSize = 3;
  private gameEnded = false;


  isGameOver: boolean = false;
  matchedCount: number = 0;
  backgroundImageUrl: string = '';


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
  score = 0;
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
    this.backgroundImageUrl = this.contest?.game_config?.image;
    this.resetTiles();
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
           if (!this.hasPlayed) {
              ($('#infoModal') as any).modal('show');
            }
            this.coustomerIdUpdateInstaContest();  
            ($('#infoModal') as any).modal('show'); 
    } 
  }


  async loadGameData(): Promise<void> {
    document.body.classList.add('puzzle-active');

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

       //total counts contests
      const brandData = await this.supabaseService.getBrandStoreID(this.store_id!);
      this.brand = brandData || [];
      this.totalResultCount = this.brand.reduce((sum: number, contest: any) => sum + (contest.result_count || 0), 0);
     this.hasPlayed = await this.supabaseService.checkIfContestPlayed({
        contestId: this.contest.contest_id,
        customerId: this.userId ?? null,
         instaUserId: this.instaUserId ?? null
      });
      this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
      // console.log('Has played:', hasPlayed);
      if (this.hasPlayed) {
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
        if (!this.isLoggedIn) {
          this.insta_flow_LoginButton = true;
          this.loading = false;
          return
        }
        const check = !this.isLoggedIn
          ? await this.supabaseService.validateAndUpdateInstaUser(insta_user_ig!)
          : await this.supabaseService.validateAndUpdateInstaUser(insta_user_ig!,
            await this.supabaseService.getProfile(this.userId!)
          );
          
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

      this.backgroundImageUrl = this.contest?.game_config?.image;
     

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
      document.body.classList.remove('puzzle-active');
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
         instaUserId: this.instaUserId ?? null
      });
    if (this.hasPlayed) {
      this.loadGameData();
      return;
    }
    this.playMusic();
    this.backgroundImageUrl = this.contest?.game_config?.image;
    this.showWelcomeScreen = false;
    this.showGamePanel = true;
    this.showGameUpdate = false;

    this.loading = true;
    await this.preloadImages([this.contest?.game_config?.image]); // ✅ FIXED
    this.loading = false;
    

    this.analyticsService.sendEvent('game_start', {
      game_type: 'puzzle-game',
      contest_id: this.contest.contest_id
    });

    if (!isPlatformBrowser(this.platformId)) return;

    if (this.timer) clearInterval(this.timer);
    this.time = this.contest?.game_config?.time_limit ?? '60';
    this.secondsLeft = +this.time;
    this.totalScore = 0;
    this.gameEnded = false;

    this.startTimer();
  }


  resetTiles(): void {
    this.tiles = Array.from({ length: this.gridSize * this.gridSize }, (_, i) => i);
    this.shuffleArray(this.tiles);
    this.correctPositions = Array(this.tiles.length).fill(false);
    this.updateCorrectPositions();
  }

  shuffleArray(array: number[]): void {
    let isDeranged = false;

    while (!isDeranged) {
      // Fisher-Yates shuffle
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }

      // Check if it's a derangement (no element in original position)
      isDeranged = array.every((value, index) => value !== index);
    }
  }


  onTileClick(index: number): void {

    this.updateCorrectPositions();
    const matched = this.getMatchedCount();

    if (this.getMatchedCount() === this.tiles.length) {
      this.endGame();
    }
    if (this.correctPositions[index]) return;

    if (this.selectedTileIndex === null) {
      this.selectedTileIndex = index;
    } else if (this.selectedTileIndex !== index) {
      [this.tiles[this.selectedTileIndex], this.tiles[index]] = [this.tiles[index], this.tiles[this.selectedTileIndex]];
      this.selectedTileIndex = null;
      this.updateCorrectPositions();
    } else {
      this.selectedTileIndex = null;
    }
  }

  updateCorrectPositions(): void {
    this.correctPositions = this.tiles.map((value, index) => value === index);

    const allMatched = this.correctPositions.every(v => v);
    if (allMatched && !this.gameEnded) {
      // this.totalScore = this.correctPositions.length + this.secondsLeft;
      this.endGame();
    }
  }

  isSelected(index: number): boolean {
    return this.selectedTileIndex === index;
  }

  getTileStyle(tileValue: number): { [key: string]: string } {
    const row = Math.floor(tileValue / this.gridSize);
    const col = tileValue % this.gridSize;

    return {
      'background-image': `url(${this.backgroundImageUrl})`,
      'background-size': `${this.gridSize * 100}% ${this.gridSize * 100}%`,
      'background-position': `${col * (100 / (this.gridSize - 1))}% ${row * (100 / (this.gridSize - 1))}%`
    };
  }

  startTimer(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.updateTimeDisplay();

    this.timer = setInterval(() => {
      this.secondsLeft--;
      this.updateTimeDisplay();

      if (this.secondsLeft <= 0 && !this.gameEnded) {
        // this.totalScore = this.correctPositions.filter(v => v).length; 
        this.endGame();
      }
    }, 1000);
  }

  getMatchedCount(): number {
    return this.correctPositions.filter(pos => pos).length;
  }


  updateTimeDisplay(): void {
    this.time = this.secondsLeft < 10 ? `0${this.secondsLeft}` : `${this.secondsLeft}`;
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
    if (!isPlatformBrowser(this.platformId) || this.gameEnded) return;
    this.gameEnded = true;
    if (this.timer) clearInterval(this.timer);

    // const isComplete = this.correctPositions.every(v => v);
    // const score = isComplete ? this.correctPositions.length + this.secondsLeft : this.correctPositions.filter(v => v).length;
    // this.sendResultToApi(isComplete, score);

    const matched = this.getMatchedCount();
    const timeBonus = this.secondsLeft;
    this.totalScore = matched * 10 + (matched > 0 ? timeBonus * 2 : 0);


    const isWinner = matched === this.tiles.length;

    this.cdr.detectChanges();
    this.sendResultToApi(false, this.totalScore);
    this.confetti = true;

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
      this.cdr.detectChanges();
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

   async coustomerIdUpdateInstaContest() {

     if (this.instaUserId && this.userId) {
    await this.supabaseService.linkInstaCustomerToContest({
      instaUserId: this.instaUserId,
      customerId: this.userId
    });

    await this.supabaseService.linkInstaCustomerToResults({
      instaUserId: this.instaUserId,
      customerId: this.userId
    });
  }
  }
}
