import { Component, ElementRef, ViewChild, OnInit, AfterViewInit, OnDestroy, Inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SupabaseService } from '../services/supabase.service';
import { UtilService } from '../services/util.service';
import { RouterLink } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { AnalyticsService } from '../services/analytics.service';
import { AuthService } from '../services/auth.service';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { ConfittiComponent } from '../confitti/confitti.component';
import { LocationService } from '../services/location.service';

@Component({
  selector: 'app-scratch-card',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileModalComponent, LoginModalComponent, ConfittiComponent],
  templateUrl: './scratch-card.component.html',
  styleUrl: './scratch-card.component.css',
})
export class ScratchCardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scratchCanvas', { static: false }) scratchCanvasRef!: ElementRef;
  private ctx!: CanvasRenderingContext2D;

  public showWelcomeScreen = false;
  public showGamePanel = false;
  public showGameUpdate = false;
  public showLoginButton = false;
  public showAccessMessage = false;
  public celebrationEmojis: {
    icon: string;
    left: number;
    delay: number;
    rotation: number;
  }[] = [];
  public rewardMessage = '';
  public rewardRevealed = false;
  public contest: any = {};
  public selectedOffer: any;
  public ex_date: any = {};
  public isLoggedIn = false;
  public isContestAssigned = false;
  public loading = true;
  private userId: string | null = null;
  participationCount: number | null = null;

  private isDrawing = false;
  private rewardSent = false;

  contest_Expired = false;
  showContesExpired = false;
  insta_post_view = false;

  gameResult: any;
  showGameResult = false;
  voucher_Code: string = 'Better Luck';
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
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService,
    private authserivice: AuthService,
    public utilService: UtilService,
    private analyticsService: AnalyticsService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private locationService: LocationService
  ) { }

  async ngOnInit(): Promise<void> {

    this.userId = localStorage.getItem('userId');
    const profile = await this.supabaseService.getProfile(this.userId!);
    this.profile = profile;

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
    document.body.classList.add('scratch-card-active');

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
      throw new Error('Contest ID is null');
    }

    if (!contestId) {
      this.router.navigate(['/dashboard']);
      return;
    }

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

      
      if (this.contest_Expired) {
        this.showContesExpired = true;
        this.loading = false;
        return;
      }

      // this.userId = localStorage.getItem('userId')!;
      // this.isLoggedIn = !!this.userId;

      // Always show contest name (even before login)
      // if (!this.isLoggedIn) {
      //   localStorage.setItem('redirectUrl', this.router.url);
      //   this.showLoginButton = true;
      //   this.loading = false;
      //   return;
      // }

      // this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
      // console.log('Has played:', hasPlayed);
      if (hasPlayed) {
        // this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);

        const data = await this.supabaseService.getUserResult({
          contestId: this.contest.contest_id,
          customerId: this.userId ?? null,
          instaUserId: this.instaUserId ?? null
        });
        this.gameResult = data;
        // console.log('User ID:', this.userId);
        // console.log('Contest ID', this.contest.contest_id);
        // console.log('Contest results:', data);
        // console.log('Participation count:', this.participationCount);
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

      // If private, verify assignment
      const assignedContests = await this.supabaseService.getAllContest_assigned(this.userId);
      // console.log('Assigned contests:', assignedContests);
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
      document.body.classList.remove('scratch-card-active');
    }
    this.pauseMusic();
  }

  ngAfterViewInit(): void {

  }


  async startGame(): Promise<void> {
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
    }

    this.playMusic();
    const customerData = await this.supabaseService.getContestProbability({
      contestId: this.contest.contest_id,
      customerId: this.userId ?? null,
      instaUserId: this.instaUserId ?? null
    });

    this.contest.probability_of_winning = customerData?.probability_of_winning ?? 1;

    this.showWelcomeScreen = false;
    this.showGamePanel = true;
    this.showGameUpdate = false;

    setTimeout(() => {
      if (this.scratchCanvasRef) {
        this.initializeCanvas();
      }
    }, 100);

    this.analyticsService.sendEvent('game_start', {
      game_type: 'Scratch-card',
      contest_id: this.contest.contest_id
    });

  }

  private initializeCanvas(): void {
    const canvas = this.scratchCanvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    canvas.width = 240;
    canvas.height = 240;

    this.drawRewardCanvas();

    canvas.addEventListener('mousedown', (e: MouseEvent) =>
      this.startScratching(e.offsetX, e.offsetY)
    );
    canvas.addEventListener('mousemove', (e: MouseEvent) =>
      this.scratching(e.offsetX, e.offsetY)
    );
    canvas.addEventListener('mouseup', () => this.stopScratching());
    canvas.addEventListener('mouseout', () => this.stopScratching());

    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      this.startScratching(touch.clientX - rect.left, touch.clientY - rect.top);
    });
    canvas.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      this.scratching(touch.clientX - rect.left, touch.clientY - rect.top);
    });
    canvas.addEventListener('touchend', () => this.stopScratching());
    canvas.addEventListener('touchcancel', () => this.stopScratching());
  }

  private drawRewardCanvas(): void {
    const canvas = this.scratchCanvasRef.nativeElement;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const gradient = this.ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#F1C40F');
    gradient.addColorStop(1, '#1ABC9C');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);

    const image = new Image();
    image.src = 'images/gift-1.png';
    // image.src = this.contest.game_config.card_configuration;
    image.onload = () => {
      const imgWidth = 100;
      const imgHeight = 100;
      this.ctx.drawImage(
        image,
        centerX - imgWidth / 2,
        centerY - imgHeight / 2,
        imgWidth,
        imgHeight
      );

      this.ctx.fillStyle = '#f1c40f';
      this.ctx.font = 'bold 12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(this.rewardMessage, centerX, centerY + imgHeight / 2 + 20);
    };
  }

  private startScratching(x: number, y: number): void {
    this.isDrawing = true;
    this.revealScratch(x, y);
  }

  private scratching(x: number, y: number): void {
    if (this.isDrawing) {
      this.revealScratch(x, y);
    }
  }

  private stopScratching(): void {
    this.isDrawing = false;
  }

  private async revealScratch(x: number, y: number): Promise<void> {
    const canvas = this.scratchCanvasRef.nativeElement;
    const radius = 20;
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    this.ctx.fill();

    this.checkIfRewardRevealed(canvas);
  }

  private async checkIfRewardRevealed(canvas: HTMLCanvasElement): Promise<void> {
    const imageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
    let revealedPixels = 0;

    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i + 3] < 255) revealedPixels++;
    }

    const scratchedPercentage = revealedPixels / (canvas.width * canvas.height);

    if (scratchedPercentage > 0.6 && !this.rewardRevealed) {
      this.rewardRevealed = true;
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
      // this.launchCelebrationEmojis();

      const isWinner = Math.random() < (this.contest.probability_of_winning || 0);
      // console.log('Is winner:', isWinner);

      const key = `resultSent_${this.userId}_${this.contest.contest_id}`;

      if (isWinner) {
        const offerName = this.contest.game_config?.offer?.trim();
        const matchedOffer = this.contest.offers.find((o: any) => o.name?.trim() === offerName);

        if (matchedOffer) {
          const voucher = await this.utilService.getRandomVoucher(matchedOffer);
          // this.voucher_Code = voucher;
          this.voucher_Code = voucher ? voucher : 'Better Luck';

          this.selectedOffer = matchedOffer;
          this.rewardMessage = matchedOffer.name;
          this.ex_date = matchedOffer.expiryDate ? `Expires: ${matchedOffer.expiryDate}` : '';

          if (!this.rewardSent && !localStorage.getItem(key)) {
            await this.sendResultToApi(matchedOffer, voucher, this.contest.contest_id, true);
            this.rewardSent = true;
            localStorage.setItem(key, 'true');
            // console.log('Win result sent to API');
          }
        } else {
          console.error('Matched offer not found');
        }
      } else {
        this.rewardMessage = 'Better Luck';
        this.ex_date = '';

        if (!this.rewardSent && !localStorage.getItem(key)) {
          await this.sendResultToApi({ name: this.rewardMessage }, 'Better luck', this.contest.contest_id, false);
          this.rewardSent = true;
          localStorage.setItem(key, 'true');
          // console.log('Loss result sent to API');
        }
      }
      this.confetti = true;
      setTimeout(() => {
        (async () => {
          this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
          // console.log('Participation count:', this.participationCount);
          this.pauseMusic();
          this.confetti = false;
          this.showGamePanel = false;
          this.showGameUpdate = true;
          document.body.classList.remove('game-running');
        })();
      }, 3500);
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

  // private launchCelebrationEmojis(): void {
  //   this.celebrationEmojis = [];
  //   const icons = ['🎉', '🎁', '✨', '💥', '🎊'];
  //   for (let i = 0; i < 30; i++) {
  //     this.celebrationEmojis.push({
  //       icon: icons[Math.floor(Math.random() * icons.length)],
  //       left: Math.random() * 100,
  //       delay: Math.random() * 0.8,
  //       rotation: Math.random() * 360,
  //     });
  //   }
  // }

  private sendResultToApi(offer: any, voucher: string, contestId: string, isWinner: boolean): void {
   if (!this.contest.contestId) {
    // // console.error('Missing contestId. Aborting API call.');
    return;
  }

  // ✅ At least one identifier must exist
  if (!this.userId && !this.instaUserId) {
    // // console.error('No valid user identifier (customer or insta)');
    return;
  }

    const isValidVoucher = isWinner && voucher?.trim() !== '';
    const result = {
    contest_id: contestId,
    // ✅ send ONLY ONE identifier
    customer_id: this.userId ?? null,
    insta_user_id: this.instaUserId ?? null,
    is_winner: isWinner,
    score: null,
    voucher_assigned: isValidVoucher ? `${offer.name} : ${voucher}` : `Better Luck`,
      expiry_date: isWinner ? offer.expiryDate : null,
    };

    this.supabaseService.updateContestResults(result).then(async () => {
      if (isWinner && offer) {
        const updatedVouchers = offer.remainingVoucherNumbers
          .split(',')
          .filter((item: string) => item !== voucher)
          .join(',');
        offer.remainingVoucherNumbers = updatedVouchers;

        const offerIndex = this.contest.offers.findIndex((o: any) => o.name === offer.name);
        if (offerIndex !== -1) {
          this.contest.offers[offerIndex] = offer;
        }

        await this.supabaseService.updateContests(this.contest);
      }

    }).catch(err => {
      // console.error('Error saving result:', err);
      // localStorage.removeItem(key);
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

  if (!this.contest.contestId) {
    console.error('Missing contestId');
    return;
  }

  const contestData = await this.supabaseService.getContestById(this.contest.contestId);

  // ✅ NULL GUARD (fixes TS error)
  if (!contestData) {
    // console.error('Contest not found');
    return;
  }

  this.store_id = contestData.store_id; // ✅ now safe

  const payload = {
    contestId: this.contest.contestId,
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
}
