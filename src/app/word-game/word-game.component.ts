import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  selector: 'app-word-game',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileModalComponent, LoginModalComponent, ConfittiComponent],
  templateUrl: './word-game.component.html',
  styleUrls: ['./word-game.component.css']
})
export class WordGameComponent implements OnInit, OnDestroy {
  alphabet: string[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  selectedWord = '';
  displayedWord: string[] = [];
  clue = '';
  categoryName = '';
  lives = 6;
  timer = 0;
  gameOver = false;
  gameStarted = false;
  scoreMessage = '';
  formattedTime = '00:00';
  guessedLetters: { [key: string]: 'correct' | 'wrong' } = {};

  private interval: any;

  contestId: any;
  userId: string | null = null;
  isLoggedIn = false;
  isContestAssigned = false;

  contest: any = {};
  selectedOffer: any;
  participationCount: number | null = null;
  loading = true;
  showLoginButton = false;
  showAccessMessage = false;
  showWelcomeScreen = false;
  showGamePanel = false;
  showGameUpdate = false;
  showGameResult = false;
  gameResult: any;
  insta_post_view = false;

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


  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private authserivice: AuthService,
    public utilService: UtilService,
    private analyticsService: AnalyticsService,
    @Inject(PLATFORM_ID) private platformId: Object,
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
            ($('#infoModal') as any).modal('show'); 
    } 
  }


  async loadGameData(): Promise<void> {

    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.add('word-active');
    }

    // this.contestId = this.route.snapshot.paramMap.get('id');
    this.contestId = this.route.snapshot.queryParamMap.get('cid');
    const insta_user_ig = this.route.snapshot.queryParamMap.get('ig');

    // Store user_inst_ID in localStorage
    // if (insta_user_id) {
    //   localStorage.setItem('user_inst_ID', insta_user_id);
    // }
    
    if (!this.contestId) {
      console.error('Contest ID not found');
      this.router.navigate(['/dashboard']);
      return;
    }

    try {
     this.userId = this.authserivice.getUserId() ?? '';
      const brandUser = await this.supabaseService.getBrandUser(this.userId!); 

      const contestData = await this.supabaseService.getContestById(this.contestId);
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
        const brandContest = await this.supabaseService.getBrandContestsByID(this.contestId);

         //total counts contests
        const brandData = await this.supabaseService.getBrandStoreID(this.store_id!);
        this.brand = brandData || [];
        this.totalResultCount = this.brand.reduce((sum: number, contest: any) => sum + (contest.result_count || 0), 0);


        this.participationCount = await this.supabaseService.getContestCount(this.contestId)
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

      // const hasPlayed = await this.supabaseService.checkIfContestPlayed(this.userId, this.contest.contest_id);

      // console.log('Participation Count:', this.participationCount);
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

      // If the contest is private, check if the user is assigned
      const assignedContests = await this.supabaseService.getAllContest_assigned(this.userId);
      const isAssigned = assignedContests.some((c: any) => c.contest_id === this.contestId);

      this.isContestAssigned = isAssigned;
      this.showWelcomeScreen = isAssigned;
      this.showAccessMessage = !isAssigned;
      this.loading = false;

      if (!this.isContestAssigned) {
        this.showContesExpired = true;
        this.loading = false;
        return;
      }
    } catch (error) {
      console.error('Error loading contest or assignment status:', error);
      this.router.navigate(['/dashboard']);
      this.loading = false;
    }

    const gameConfig = this.contest?.game_config;
    if (gameConfig) {
      this.timer = gameConfig.time_limit ?? 60;
      this.clue = gameConfig.hint ?? '';
      this.categoryName = gameConfig.category ?? '';
      this.selectedWord = (gameConfig.word ?? '').toUpperCase();
    }
  }
  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('word-active');
    }
    if (isPlatformBrowser(this.platformId)) {
    window.removeEventListener('popstate', this.handleBackNavigation);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }
    this.pauseMusic();
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
    console.error('Contest not found');
    return;
  }

  const insta_user_ig = this.route.snapshot.queryParamMap.get('ig');
  this.store_id = contestData.store_id; // ✅ now safe

  const payload = {
    contestId: this.contestId,
    storeId: this.store_id || '',
    customerId: null as string | null,
    instaUserId: null as string | null
  };

  // 🔍 Fetch insta user mapping if IG param exists
  if (insta_user_ig) {
    const instaData = await this.supabaseService.getContestInstaId(insta_user_ig);

    if (!instaData) {
      console.error('Invalid insta_user_ig');
      return;
    }

    payload.instaUserId = instaData.insta_user;
  }

  // 🔐 Logged-in user
  if (this.userId) {
    payload.customerId = this.userId;
  }

  // 🚨 Final safety check
  if (!payload.customerId && !payload.instaUserId) {
    console.error('No valid identifier to save participation');
    return;
  }

  const success = await this.supabaseService.playContest(payload);

  if (!success) {
    console.warn('Contest already played or failed');
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

  async startGame(): Promise<void> {
    ($('#infoModal') as any).modal('hide');
    document.body.classList.add('game-running');
    this.onGameFinished();
    this.customerCreateOnStore();
    if (!this.userId || !this.contest?.contest_id) return;

    const hasPlayed = await this.supabaseService.checkIfContestPlayed(
      this.userId,
      this.contest.contest_id
    );

    if (hasPlayed) {
      this.loadGameData();
    }
    const gameConfig = this.contest?.game_config;
    if (gameConfig) {
      this.timer = gameConfig.time_limit ?? 60;
      this.clue = gameConfig.hint ?? '';
      this.categoryName = gameConfig.category ?? '';
      this.selectedWord = (gameConfig.word ?? '').toUpperCase();
    }
    this.playMusic();
    this.showWelcomeScreen = false;
    this.showGamePanel = true;
    this.showGameUpdate = false;

    this.analyticsService.sendEvent('game_start', {
      game_type: 'Word-game',
      contest_id: this.contest.contest_id
    });

    setTimeout(() => {
      this.gameStarted = true;
      // this.displayedWord = Array(this.selectedWord.length).fill('_');
      this.displayedWord = this.selectedWord.split('').map(char => (char === ' ' ? ' ' : '_'));

      // console.log('Displayed word:', this.displayedWord);  

      this.startTimer();
    }, 100);
  }


  startTimer() {
    clearInterval(this.interval);
    this.timer = this.contest?.game_config?.time_limit;
    this.formattedTime = this.formatTime(this.timer);

    this.interval = setInterval(() => {
      this.timer--;
      this.formattedTime = this.formatTime(this.timer);

      if (this.timer <= 0) {
        clearInterval(this.interval);
        this.endGame(false);
      }
    }, 1000);
  }


  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  guessLetter(letter: string) {
    if (!this.gameStarted || this.gameOver || this.guessedLetters[letter]) return;

    const guessedKey = letter.toUpperCase();

    if (this.selectedWord.toLowerCase().includes(letter.toLowerCase())) {
      this.guessedLetters[guessedKey] = 'correct';

      this.selectedWord.split('').forEach((char, index) => {
        if (char.toLowerCase() === letter.toLowerCase()) {
          this.displayedWord[index] = char;
        }
      });

      if (!this.displayedWord.includes('_')) {
        this.endGame(true);
      }
    } else {
      this.guessedLetters[guessedKey] = 'wrong';
      this.lives--;

      if (this.lives === 0) {
        this.endGame(false);
      }
    }
  }


  getHint() {
    if (!this.gameStarted) return;
    this.clue = `Hint: ${this.clue}`;
  }

  async endGame(won: boolean) {
    clearInterval(this.interval);
    this.gameOver = true;
    this.gameStarted = false;

    // Score calculation
    const correctGuesses = this.displayedWord.filter(char => char !== '_' && char !== ' ').length;
    const remainingTime = this.timer;
    let score = 0;

    if (correctGuesses > 0) {
      score = (correctGuesses * 5) + (this.lives * 3) + (remainingTime * 1);
    }
    const finalScore = Math.round(score);

    this.scoreMessage = `${finalScore}`;
    this.sendResultToApi(false, finalScore);
    this.confetti = true;
    setTimeout(() => {
      (async () => {
        this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
        this.confetti = false;
        this.pauseMusic();
        this.showGamePanel = false;
        this.showGameUpdate = true;
        document.body.classList.remove('game-running');
      })();
    }, 3500);
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


  private sendResultToApi(isWinner: boolean, score: number): void {

    if (!this.userId || !this.contestId) {
      console.error('Missing userId or contestId. Aborting API call.');
      return;
    }

    const resultKey = `resultSent_${this.userId}_${this.contestId}`;
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

}
