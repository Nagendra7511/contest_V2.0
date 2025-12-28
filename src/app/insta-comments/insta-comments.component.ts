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
import { LocationService } from '../services/location.service';


@Component({
  selector: 'app-insta-comments',
  standalone: true,
  imports: [CommonModule, RouterLink, LoginModalComponent, ProfileModalComponent, ConfittiComponent],
  templateUrl: './insta-comments.component.html',
  styleUrl: './insta-comments.component.css'
})
export class InstaCommentsComponent implements OnInit, OnDestroy {



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

  profile: any = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private authserivice: AuthService,
    public utilService: UtilService,
    private analyticsService: AnalyticsService,
    private locationService: LocationService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit(): Promise<void> {
    this.userId = localStorage.getItem('userId');
    const profile = await this.supabaseService.getProfile(this.userId!);
    this.profile = profile;

    this.loadGameData();
   
    // this.backgroundImageUrl = this.contest?.game_config?.image;
    // this.resetTiles();
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

      const brandUser = await this.supabaseService.getBrandUser(this.userId!);
      if (brandUser && brandUser.length > 0) {
        this.loadGameData();
        this.showModal = false;
        this.showLoginButton = false;
        this.showProfileModal = false;
        this.authserivice.setProfileComplete(true);
        return;
      }

      const profile = await this.supabaseService.getProfile(this.userId!);
      const firstName = profile?.first_name?.trim();

      if (firstName) {
        setTimeout(() => {
          (async () => {
            this.loadGameData();
            this.showModal = false;
            this.showLoginButton = false;
            this.showProfileModal = false;

            const updatedProfile = await this.supabaseService.getProfile(this.userId!);
            const isComplete = !!updatedProfile?.first_name?.trim();
            this.authserivice.setProfileComplete(isComplete);
          })();
        }, 500);
      } else {
        this.showModal = false;
        this.showLoginButton = false;
        this.showProfileModal = true;
      }

    } else if (event?.profileUpdated) {
      setTimeout(() => {
        (async () => {
          this.loadGameData();
          this.showProfileModal = false;
          this.showModal = false;
          const updatedProfile = await this.supabaseService.getProfile(this.userId!);
          const isComplete = !!updatedProfile?.first_name?.trim();
          this.authserivice.setProfileComplete(isComplete);
        })();
      }, 500);
    }
  }


  async loadGameData(): Promise<void> {
    document.body.classList.add('insta-active');

    const contestId = this.route.snapshot.queryParamMap.get('cid');
    const userInstId = this.route.snapshot.queryParamMap.get('ig');
    // console.log('userInstId:', userInstId);
    // alert(userInstId);
    // Store user_inst_ID in localStorage
    if (userInstId) {
      localStorage.setItem('user_inst_ID', userInstId);
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

        if (userInstId) {
          if (!this.isLoggedIn) {
            // Before login → validate IG
            const check = await this.supabaseService.validateAndUpdateInstaUser(userInstId);
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
            const check = await this.supabaseService.validateAndUpdateInstaUser(userInstId, profile);
            if (!check.valid) {
              this.showAccessMessage = true;
              this.insta_post_view = true; // invalid IG
              this.loading = false;
              return;
            }

            this.onGameFinished();
            this.customerCreateOnStore();
            this.endGame();

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

      // this.backgroundImageUrl = this.contest?.game_config?.image;

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


      this.showWelcomeScreen = true;
    } catch (error) {
      console.error('Error fetching contest or user data:', error);
      this.router.navigate(['/dashboard']);
    }

    this.loading = false;
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('insta-active');
    }
    
  }

  async startGame(): Promise<void> {

    if (isPlatformBrowser(this.platformId)) {
      window.open('https://www.instagram.com', '_blank');
    }
    this.onGameFinished();
    this.customerCreateOnStore();
    if (!this.userId || !this.contest?.contest_id) return;

    const hasPlayed = await this.supabaseService.checkIfContestPlayed(this.userId, this.contest.contest_id);
    if (hasPlayed) {
      this.loadGameData();
      return;
    }
    this.endGame();
    // this.showWelcomeScreen = false;
    // this.showGamePanel = true;
    // this.showGameUpdate = false;

    this.analyticsService.sendEvent('game_start', {
      game_type: 'insta-game',
      contest_id: this.contest.contest_id
    });

    if (!isPlatformBrowser(this.platformId)) return;

    // this.startTimer();
  }






  endGame(): void {

    
    this.sendResultToApi(false);
    this.cdr.detectChanges();
    this.confetti = true;

    setTimeout(async () => {
      this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
      this.showWelcomeScreen = false;
      this.showGamePanel = false;
      this.showGameUpdate = true;
      this.confetti = false;
      this.cdr.detectChanges();
    }, 3500);
  }


  private sendResultToApi(isWinner: boolean): void {

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
  

}
