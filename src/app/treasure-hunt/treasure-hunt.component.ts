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

@Component({
  selector: 'app-treasure-hunt',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileModalComponent, LoginModalComponent, ConfittiComponent],
  templateUrl: './treasure-hunt.component.html',
  styleUrl: './treasure-hunt.component.css'
})
export class TreasureHuntComponent implements OnInit, OnDestroy {
  gridSize = 4;
  maxTries = 5;
  treasurePosition = { x: 0, y: 0 };
  tries = 0;
  clickCount = 0;
  gameOver = false;
  cells: Array<{ x: number; y: number; content: string; imageSrc: string; backgroundColor: string; disabled: boolean; animate: boolean; revealAnimation: boolean }> = [];
  message = '';
  treasureImage = '';
  treasureDescription = '';
  endModalVisible = false;

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
  // Timer and Score
  timer: any;
  timeLimit = 60; // seconds
  remainingTime = this.timeLimit;
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
  customerInstaId: string | null = null;

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
    document.body.classList.add('treasure-active');
   
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
      this.userId = localStorage.getItem('userId')!;
      this.isLoggedIn = !!this.userId;
      this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);

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
        const data = await this.supabaseService.getUserResult({
          contestId: this.contest.contest_id,
          customerId: this.userId ?? null,
          instaUserId: this.instaUserId ?? null
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
      this.timer = this.contest?.game_config?.time_limit;
      this.showWelcomeScreen = true;
    } catch (error) {
      console.error('Error fetching contest or user data:', error);
      this.router.navigate(['/dashboard']);
    }

    this.loading = false;   
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('treasure-active');
    }
    if (isPlatformBrowser(this.platformId)) {
    window.removeEventListener('popstate', this.handleBackNavigation);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }
    this.stopTimer();
    this.pauseMusic();
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
    this.showWelcomeScreen = false;
    this.showGamePanel = true;
    this.showGameUpdate = false;
    this.endModalVisible = false;

    this.remainingTime = this.timeLimit;
    this.startTimer();
    this.initGame();
    this.analyticsService.sendEvent('game_start', {
      game_type: 'treasure-hunt',
      contest_id: this.contest.contest_id
    });
  }

  startTimer(): void {
    this.timer = setInterval(() => {
      this.remainingTime--;
      if (this.remainingTime <= 0) {
        this.remainingTime = 0;
        this.stopTimer();
        this.endGame(false); // Time over = loss
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  initGame(): void {
    this.tries = 0;
    this.clickCount = 0;
    this.gameOver = false;
    this.score = 0;
    this.cells = [];
    this.message = '';
    this.treasureImage = '';
    this.treasureDescription = '';

    this.treasurePosition = {
      x: Math.floor(Math.random() * this.gridSize),
      y: Math.floor(Math.random() * this.gridSize),
    };

    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        this.cells.push({
          x: i,
          y: j,
          content: '',
          imageSrc: 'images/treasure_gif.gif',
          backgroundColor: '#ffff',
          disabled: false,
          animate: false,
          revealAnimation: false,
        });
      }
    }
  }

  async handleCellClick(cell: any): Promise<void> {
    if (this.gameOver || cell.disabled) return;

    this.clickCount++;
    this.tries++;

    const isTreasure = cell.x === this.treasurePosition.x && cell.y === this.treasurePosition.y;
    // cell.content = isTreasure ? '✅' : '❌';
    cell.backgroundColor = isTreasure ? '#1ABC9C' : '#f16666';
     cell.imageSrc = isTreasure
    ? 'images/treasure.png'
    : 'images/no_treasure.png';

    cell.disabled = true;

    cell.revealAnimation = true;
    setTimeout(() => {
      cell.revealAnimation = false;
    }, 800);

    if (!this.contestId) {
      console.error('Contest ID not found');
      return;
    }

    if (isTreasure) {
      this.endGame(true);
    } else if (this.tries >= this.maxTries) {
      this.endGame(false);
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

  async endGame(isWinner: boolean): Promise<void> {
    this.gameOver = true;
    this.stopTimer();

    if (isWinner) {
      this.score = ((this.maxTries - this.tries) * 10) + (this.remainingTime * 1);

      //socre condition

      // console.log('Score:', this.score);
      this.treasureDescription = 'You did it!';
      // this.selectedOffer = this.utilService.getRandomElement(this.contest.offers);
      // this.message = this.selectedOffer.name;
      // this.treasureImage = this.selectedOffer.background_image;
      this.endModalVisible = true;
      this.cdr.detectChanges();

      // const selectedVoucher = await this.utilService.getRandomVoucher(this.selectedOffer);
      this.sendResultToApi(false, this.score);
      this.confetti = true;
      setTimeout(() => {
        (async () => {
          this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
          // console.log('Participation count:', this.participationCount);
          this.pauseMusic();
          this.confetti = false;
          this.showGamePanel = false;
          if (!this.isLoggedIn) {
              this.insta_flow_LoginButton = true;
            }
          this.showGameResult = true;

        })();
      }, 3500);
    } else {
      this.score = 0;
      // console.log('Game Over! Score:', this.score);
      // this.message = 'Oops, Better Luck Next Time!';
      this.treasureDescription = 'The Treasure Was Hidden at a Secret Spot!';
      this.highlightTreasureCell();
      this.endModalVisible = true;
      this.cdr.detectChanges();

      this.sendResultToApi(false, 0);
      this.confetti = true;
      setTimeout(() => {
        (async () => {
          this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
          // console.log('Participation count:', this.participationCount);
          this.pauseMusic();
          this.confetti = false;
          this.showGamePanel = false;
          if (!this.isLoggedIn) {
              this.insta_flow_LoginButton = true;
            }
          this.showGameResult = true;
          document.body.classList.remove('game-running');
        })();
      }, 3500);
    }
  }

  highlightTreasureCell(): void {
    const treasureCell = this.cells.find(
      (cell) => cell.x === this.treasurePosition.x && cell.y === this.treasurePosition.y
    );
    if (treasureCell) {
      treasureCell.imageSrc = 'images/treasure.png';
      treasureCell.backgroundColor = '#1ABC9C';
      treasureCell.content = '';
    }
  }

  private async sendResultToApi(isWinner: boolean, score: number): Promise<void> {

  if (!this.contestId) {
    // // console.error('Missing contestId. Aborting API call.');
    return;
  }
    // console.log('insta iD', this.instaUserId);

  // ✅ At least one identifier must exist
  if (!this.userId && !this.instaUserId) {
    // // console.error('No valid user identifier (customer or insta)');
    return;
  }


  const result = {
    contest_id: this.contestId,

    // ✅ send ONLY ONE identifier
    customer_id: this.userId ?? null,
    insta_user_id: this.instaUserId ? null : this.instaUserId,

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
    // // console.error('Error saving result:', err);
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
      this.endGame(false);
      // stop them from leaving until score saved
      history.pushState(null, '', window.location.href);
    }
  };
  handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (this.showGamePanel) {
      event.preventDefault();     
      event.returnValue = '';  
     this.endGame(false);
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
