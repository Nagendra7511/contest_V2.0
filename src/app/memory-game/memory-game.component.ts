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
  animating?: boolean;
}

@Component({
  selector: 'my-memory-game',
  standalone: true,
  imports: [CommonModule, RouterLink, LoginModalComponent, ProfileModalComponent, ConfittiComponent],
  templateUrl: './memory-game.component.html',
  styleUrls: ['./memory-game.component.css'],
})
export class MemoryGameComponent implements OnInit, OnDestroy {
  gridSize = 4;
  maxTries = 5;
  treasurePosition = { x: 0, y: 0 };
  tries = 0;
  clickCount = 0;
  // gameOver = false;
  cells: Array<{ x: number; y: number; content: string; backgroundColor: string; disabled: boolean; animate: boolean; revealAnimation: boolean }> = [];
  message = '';
  treasureImage = '';
  treasureDescription = '';
  endModalVisible = false;

  tileOptions: string[] = [];
  tiles: Tile[] = [];
  selections: Tile[] = [];
  boardLocked = false;
  matches = 0;
  moves = 0;
  time = '01:00';
  timer: any;
  secondsLeft = 60;
  totalScore = 0;
  gameOver = false;


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
  contest_Expired = false;
  showContesExpired = false;
  insta_post_view = false;
  
  userId: string | null = null;
  isLoggedIn = false;
  isContestAssigned = false;
  participationCount: number | null = null;
  score = 0;

  showModal = false;
  showProfileModal = false;
  admin_view = false;
  store_id: string | null = null;
  confetti = false;
  brand: any[] = []; 
  totalResultCount!: number;
  daysLeft: number = 0;
  
  gameMusic!: HTMLAudioElement;
  isMusicPlaying = false;

  profile: any = null;

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



  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    public utilService: UtilService,
    private authserivice: AuthService,
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
    this.tileOptions = this.contest?.game_config.images;
  }

  async loadGameData(): Promise<void> {
    document.body.classList.add('memory-active');

    const contestId = this.route.snapshot.queryParamMap.get('cid');
    const insta_user_id = this.route.snapshot.queryParamMap.get('ig');

    // Store user_inst_ID in localStorage
    if (insta_user_id) {
      localStorage.setItem('user_inst_ID', insta_user_id);
    }
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

      const hasPlayed = await this.supabaseService.checkIfContestPlayed(this.userId, this.contest.contest_id);
      this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
      // console.log('Has played:', hasPlayed);
      if (hasPlayed) {
      //  this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);

        const data = await this.supabaseService.getUserResult(this.contest.contest_id, this.userId);
        this.gameResult = data;
        this.showWelcomeScreen = false;
        this.showGamePanel = false;
        this.showGameResult = true;
        this.loading = false;
        return;
      }


      if (contestData.insta_post) {

        if (insta_user_id) {
          if (!this.isLoggedIn) {
            // Before login → validate IG
            const check = await this.supabaseService.validateAndUpdateInstaUser(insta_user_id);
            if (!check.valid) {
              this.showAccessMessage = true;
              this.insta_post_view = true; // invalid IG
              this.loading = false;
              return;
            }
            this.showLoginButton = true; // IG valid → show login button
            this.loading = false;
            return;
          } else {
            
            // After login → validate IG & update profile if empty
            const profile = await this.supabaseService.getProfile(this.userId!);
            const check = await this.supabaseService.validateAndUpdateInstaUser(insta_user_id, profile);
            if (!check.valid) {
              this.showAccessMessage = true;
              this.insta_post_view = true; // invalid IG
              this.loading = false;
              return;
            }

            // this.onGameFinished();
            // this.endGame();
          }
        }
        else {
          // 🚨 No IG param at all → treat as invalid
          this.showAccessMessage = true;
          this.insta_post_view = true;
          this.loading = false;
          return;
        }
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

      // if (!this.userId || !this.contest?.contest_id) return;

      // const hasPlayed = await this.supabaseService.checkIfContestPlayed(this.userId, this.contest.contest_id);
      // this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
      // console.log('Has played:', hasPlayed);
      if (hasPlayed) {
        // this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);

        const data = await this.supabaseService.getUserResult(this.contest.contest_id, this.userId);
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
      // this.timer = this.contest?.game_config?.time_limit;
      // this.maxTries = this.contest?.game_config?.tries;
      // console.log('timer:', this.timer);
      // console.log('tries:', this.tries);
      this.tileOptions = this.contest?.game_config.images;

      this.showWelcomeScreen = true;
    } catch (error) {
      console.error('Error fetching contest or user data:', error);
      this.router.navigate(['/dashboard']);
    }

    this.loading = false;
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('memory-active');
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
  if (!this.userId || !this.contest?.contest_id) return;

  const hasPlayed = await this.supabaseService.checkIfContestPlayed(this.userId, this.contest.contest_id);
  if (hasPlayed) {
    this.loadGameData();
  }
  this.playMusic();
  this.showWelcomeScreen = false;
  this.showGamePanel = true;
  this.showGameUpdate = false;
  this.endModalVisible = false;

  this.analyticsService.sendEvent('game_start', {
    game_type: 'Memory-game',
    contest_id: this.contest.contest_id
  });

  if (!isPlatformBrowser(this.platformId)) return;

  if (this.timer) clearInterval(this.timer);

  this.selections = [];
  this.boardLocked = true;
  this.matches = 0;
  this.moves = 0;

  this.time = this.contest?.game_config?.time_limit;
  this.totalScore = 0;
  this.showGameUpdate = false;

  this.timer = this.contest?.game_config?.time_limit;
  this.secondsLeft = this.contest?.game_config?.time_limit;
  this.tileOptions = this.contest?.game_config.images;

  this.loading = true;
  await this.preloadImages(this.tileOptions);
  this.loading = false;


  const shuffled = this.shuffleArray([
    ...this.tileOptions,
    ...this.tileOptions,
  ]);

  this.tiles = shuffled.map((value, index) => ({
    id: index,
    value,
    flipped: false,
    matched: false,
  }));

  setTimeout(() => {
    this.boardLocked = false;
    this.startTimer();
  }, this.tiles.length * 100);

  
}


  // StartGame(): void {
  //   if (!isPlatformBrowser(this.platformId)) return;

  //   if (this.timer) clearInterval(this.timer);

  //   this.selections = [];
  //   this.boardLocked = true;
  //   this.matches = 0;
  //   this.moves = 0;
  //   this.secondsLeft = 60;
  //   this.time = '01:00';
  //   this.totalScore = 0;
  //   this.showGameUpdate = false;

  //   const shuffled = this.shuffleArray([
  //     ...this.tileOptions,
  //     ...this.tileOptions,
  //   ]);
  //   this.tiles = shuffled.map((value, index) => ({
  //     id: index,
  //     value,
  //     flipped: false,
  //     matched: false,
  //   }));

  //   setTimeout(() => {
  //     this.boardLocked = false;
  //     this.startTimer();
  //   }, this.tiles.length * 100);
  // }

  startTimer(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.updateTimeDisplay();

    this.timer = setInterval(() => {
      this.secondsLeft--;
      this.updateTimeDisplay();

      if (this.secondsLeft <= 0) {
        this.endGame();
      }
    }, 1000);
  }

  updateTimeDisplay(): void {
    this.time = this.secondsLeft < 10 ? `0${this.secondsLeft}` : `${this.secondsLeft}`;
  }

  selectTile(tile: Tile): void {
  if (!isPlatformBrowser(this.platformId)) return;
  if (this.boardLocked || tile.flipped || tile.matched || this.showGameUpdate) return;

  tile.flipped = true;
  tile.animating = true; // 🔥 ADD
  this.selections.push(tile);

  // Remove animating state after animation completes
  setTimeout(() => {
    tile.animating = false;
  }, 1800); // must match CSS animation duration

  if (this.selections.length === 2) {
    this.boardLocked = true;

    const [first, second] = this.selections;

    if (first.value === second.value) {
      // MATCHED
      setTimeout(() => {
        this.selections.forEach(t => {
          t.matched = true;
          t.animating = false;
        });

        this.matches++;
        this.selections = [];
        this.boardLocked = false;

        if (this.matches === this.tileOptions.length) {
          this.endGame();
        }
      }, 1800);
    } else {
      // NOT MATCHED
      setTimeout(() => {
        this.selections.forEach(t => {
          t.flipped = false;
          t.animating = false;
        });

        this.selections = [];
        this.boardLocked = false;
      }, 1600);
    }
  }
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

    if (this.timer) clearInterval(this.timer);
    // this.showGameUpdate = true;  
    const elapsedTime = 60 - this.secondsLeft;
    const timeBonus = this.secondsLeft * 1;
    const matchBonus = this.matches * 10;
    const movePenalty = this.moves * 1;
    //  console.log('timeBonus:', timeBonus , 'matchBonus:', matchBonus, 'movePenalty:', movePenalty);
    this.totalScore = Math.round((matchBonus > 0 ? timeBonus : 0) + matchBonus - movePenalty);

    this.cdr.detectChanges();
    this.sendResultToApi(false, this.totalScore);
    this.confetti = true;
    setTimeout(() => {
      (async () => {
        this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
        this.pauseMusic();
        this.showGamePanel = false;
        this.showGameUpdate = true;
       this.confetti = false;
       document.body.classList.remove('game-running');
      })();
    }, 3500);
    
  }



  shuffleArray(array: any[]): any[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }



  // async endGame(isWinner: boolean): Promise<void> {
  //   this.gameOver = true;
  //   this.stopTimer();

  //   if (isWinner) {
  //     this.score = ((this.maxTries - this.tries) * 10) + (this.remainingTime * 1);

  //     this.endModalVisible = true;
  //     this.cdr.detectChanges();
  //     this.sendResultToApi(true, this.score);

  //     setTimeout(() => {
  //       (async () => {
  //         this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
  //         console.log('Participation count:', this.participationCount);


  //         this.showGamePanel = false;
  //         this.showGameUpdate = true;

  //       })();
  //     }, 2500);
  //   } else {
  //     this.score = 0;

  //     this.endModalVisible = true;
  //     this.cdr.detectChanges();

  //     this.sendResultToApi( false, 0);

  //     setTimeout(() => {
  //       (async () => {
  //         this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
  //         console.log('Participation count:', this.participationCount);


  //         this.showGamePanel = false;
  //         this.showGameUpdate = true;

  //       })();
  //     }, 2500);
  //   }
  // }



  private sendResultToApi(isWinner: boolean, score: number): void {

    if (!this.userId || !this.contestId) {
      console.error('Missing userId or contestId. Aborting API call.');
      return;
    }

    // const resultKey = `resultSent_${this.userId}_${this.contestId}`;
    // if (localStorage.getItem(resultKey)) {
    //   console.warn('Result already sent, skipping duplicate API call.');
    //   return;
    // }
    // localStorage.setItem(resultKey, 'true');

    const result = {
      customer_id: this.userId,
      contest_id: this.contestId,
      is_winner: isWinner,
      score: score || 0,
      voucher_assigned: '',
      expiry_date: null,
    };

    this.supabaseService.updateContestResults(result)
      .then((error) => {
        if (error) {
          console.error('Error saving result:', error);
        } else {
          // console.log('Result successfully saved.');
        }
      })
      .catch(error => {
        console.error('Error saving result:', error);
      });
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
    if (!this.userId || !this.contestId) {
      console.error('Missing userId or contestId – cannot save participation.');
      return;
    }
    const success = await this.supabaseService.playContest(this.userId, this.contestId);
    if (success) {
      // console.log('Contest participation saved!');
    } else {
      // console.error('Failed to update participation');
    }
    this.utilService.clearPlayState();
  }
    async customerCreateOnStore() {
    if (this.userId && this.store_id) {
      try {
        const response = await this.supabaseService.addCustomerToStore(this.userId, this.store_id);
        // console.log("Customer store link:", response);
      } catch (err) {
        console.error("Error writing customer_store", err);
      }
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
}
