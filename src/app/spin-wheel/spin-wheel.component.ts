import { Component, Inject, OnInit, PLATFORM_ID, OnDestroy } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { UtilService } from '../services/util.service';
import { AnalyticsService } from '../services/analytics.service';
import { AuthService } from '../services/auth.service';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { ConfittiComponent } from '../confitti/confitti.component';
import { LocationService } from '../services/location.service';

@Component({
  selector: 'app-spin-wheel',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileModalComponent, LoginModalComponent, ConfittiComponent],
  templateUrl: './spin-wheel.component.html',
  styleUrls: ['./spin-wheel.component.css'],
})
export class SpinWheelComponent implements OnInit, OnDestroy {
  contest: any;
  labels: any[] = [];
  pieColors: string[] = [];
  message = 'Click the Spin Button to Start the Game';
  showWelcomeScreen = false;
  showGamePanel = false;
  showGameUpdate = false;
  isSpinning = false;
  hasSpun = false;
  isLoggedIn = false;
  isContestAssigned = false;
  loading = true;
  showLoginButton = false;
  showAccessMessage = false;
  userId: string | null = null;
  private canvas: any;
  private ctx: any;
  private arc: number = 0;
  private angle: number = 0;
  private animationFrame: any;
  ex_date: any;
  participationCount: number | null = null;
  gameResult: any;
  showGameResult = false;
  voucher_Code: string = 'Better Luck';
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
  instaUserId: string | null = null;
  insta_flow_LoginButton = false;
  hasPlayed = false;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private route: ActivatedRoute,
    private authserivice: AuthService,
    private supaBaseService: SupabaseService,
    private analyticsService: AnalyticsService,
    public utilService: UtilService,
    private locationService: LocationService
  ) { }

   async ngOnInit(): Promise<void> {
    this.userId = localStorage.getItem('userId');
    const profile = await this.supaBaseService.getProfile(this.userId!);
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

      const brandUser = await this.supaBaseService.getBrandUser(this.userId!); 
      if (brandUser && brandUser.length > 0) {     
        this.store_id = brandUser[0].store_id;   
      this.loadGameData();
                this.showModal = false;
                this.showLoginButton = false;
                this.showProfileModal = false;
                this.authserivice.setProfileComplete(true);
                return;
      }

      const profile = await this.supaBaseService.getProfile(this.userId!);
      const firstName = profile?.first_name?.trim();
      this.coustomerIdUpdateInstaContest(); 
      if (firstName) {
        setTimeout(() => {
          (async () => {
            this.loadGameData();
            this.showModal = false;
            this.showLoginButton = false;
            this.showProfileModal = false;

            const updatedProfile = await this.supaBaseService.getProfile(this.userId!);
            const isComplete = !!updatedProfile?.first_name?.trim();
            this.authserivice.setProfileComplete(isComplete);
            this.insta_flow_LoginButton = false;
          })();
        }, 500);
      } else {
        this.showModal = false;
        this.showLoginButton = false;
        this.showProfileModal = true;
        this.insta_flow_LoginButton = false;
      }

    } else if (event?.profileUpdated) {
      setTimeout(() => {
        (async () => {
          this.loadGameData();
          this.showProfileModal = false;
          this,this.showModal = false;
          const updatedProfile = await this.supaBaseService.getProfile(this.userId!);
          const isComplete = !!updatedProfile?.first_name?.trim();
          this.authserivice.setProfileComplete(isComplete);
            this.insta_flow_LoginButton = false;
        })();
      }, 500);
    }
  }


  async loadGameData(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      this.document.body.classList.add('spin-active');
    }

    const contestId = this.route.snapshot.queryParamMap.get('cid');
    const insta_user_ig = this.route.snapshot.queryParamMap.get('ig');

        // 🔍 Fetch insta user if IG param exists
    if (insta_user_ig) {
      const instaData = await this.supaBaseService.getContestInstaId(insta_user_ig);

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
      const brandUser = await this.supaBaseService.getBrandUser(this.userId!); 
      
      const contestData = await this.supaBaseService.getContestById(contestId);
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
        const brandContest = await this.supaBaseService.getBrandContestsByID(contestId);

         //total counts contests
        const brandData = await this.supaBaseService.getBrandStoreID(this.store_id!);
        this.brand = brandData || [];
        this.totalResultCount = this.brand.reduce((sum: number, contest: any) => sum + (contest.result_count || 0), 0);


        this.participationCount = await this.supaBaseService.getContestCount(contestId)
        if (brandContest) {
          this.contest = brandContest;
           this.prepareWheel();
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
      this.participationCount = await this.supaBaseService.getContestCount(this.contest.contest_id);
      this.userId = localStorage.getItem('userId')!;
      this.isLoggedIn = !!this.userId;

       //total counts contests
      const brandData = await this.supaBaseService.getBrandStoreID(this.store_id!);
      this.brand = brandData || [];
      this.totalResultCount = this.brand.reduce((sum: number, contest: any) => sum + (contest.result_count || 0), 0);
      this.hasPlayed = await this.supaBaseService.checkIfContestPlayed({
        contestId: this.contest.contest_id,
        customerId: this.userId ?? null,
         instaUserId: this.instaUserId ?? null
      });
      this.participationCount = await this.supaBaseService.getContestCount(this.contest.contest_id);
      // console.log('Has played:', hasPlayed);
      if (this.hasPlayed) {
      //  this.participationCount = await this.supaBaseService.getContestCount(this.contest.contest_id);

        const data = await this.supaBaseService.getUserResult({
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
          ? await this.supaBaseService.validateAndUpdateInstaUser(insta_user_ig!)
          : await this.supaBaseService.validateAndUpdateInstaUser(insta_user_ig!,
            await this.supaBaseService.getProfile(this.userId!)
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
          ? await this.supaBaseService.validateAndUpdateInstaUser(insta_user_ig)
          : await this.supaBaseService.validateAndUpdateInstaUser(
            insta_user_ig,
            await this.supaBaseService.getProfile(this.userId!)
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
      this.prepareWheel();

      

      if (!this.contest.is_private) {
        this.showWelcomeScreen = true;
        this.loading = false;
        return;
      }

      // If private, verify assignment
      const assignedContests = await this.supaBaseService.getAllContest_assigned(this.userId);
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
      this.document.body.classList.remove('spin-active');
    }
     this.pauseMusic();
  }

  // prepareWheel(): void {
  //   this.labels = this.contest.game_config.segments || [];
  //   this.pieColors = this.labels.map(
  //     () => '#' + Math.floor(Math.random() * 16777215).toString(16)
  //   );
  // }
  prepareWheel(): void {
    const labels: any[] = this.contest.game_config.segments || [];

    const splitLabel = (label: string): string => {
      const maxChars = 16;

      if (label.length <= maxChars) {
        return label;
      }

      const midpoint = Math.floor(label.length / 2);

      // Try to split on the last space before midpoint
      const spaceIndex = label.lastIndexOf(' ', midpoint);
      if (spaceIndex !== -1 && spaceIndex > 4) {
        return label.slice(0, spaceIndex) + '\n' + label.slice(spaceIndex + 1);
      }

      // If no space (single word), force split at midpoint
      return label.slice(0, midpoint) + '\n' + label.slice(midpoint);
    };

    // Shuffle and transform labels with line breaks
    this.labels = labels
      .map((label: any) => ({ label, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ label }) => splitLabel(label));

    // Generate distinct HSL colors
    const totalSegments = this.labels.length;
    this.pieColors = this.labels.map((_, index) => {
      const hue = Math.floor((360 / totalSegments) * index);
      return `hsl(${hue}, 70%, 60%)`;
    });
  }


  async startGame(): Promise<void> {
    document.body.classList.add('game-running');
    this.onGameFinished();
    this.customerCreateOnStore();
    if (!this.contest?.contest_id) return;

    this.hasPlayed = await this.supaBaseService.checkIfContestPlayed({
        contestId: this.contest.contest_id,
        customerId: this.userId ?? null,
         instaUserId: this.instaUserId ?? null
      });

    if (this.hasPlayed) {
      this.loadGameData();
      return
    }
     
    const customerData = await this.supaBaseService.getContestProbability({
      contestId: this.contest.contest_id,
      customerId: this.userId ?? null,
      instaUserId: this.instaUserId ?? null
    });

    this.contest.probability_of_winning = customerData?.probability_of_winning ?? 1;

    this.playMusic();
    this.showWelcomeScreen = false;
    this.showGamePanel = true;
    this.showGameUpdate = false;
    this.hasSpun = false;
    this.message = 'Click the Spin Button to Start the Game';

    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.canvas = this.document.getElementById('wheel') as HTMLCanvasElement;
        if (this.canvas) {
          this.ctx = this.canvas.getContext('2d');
          this.arc = (Math.PI * 2) / this.labels.length;
          this.drawWheel();
        }
      }, 100);
    }
    this.analyticsService.sendEvent('game_start', {
      game_type: 'Spin-Wheel',
      contest_id: this.contest.contest_id
    });
  }

  drawWheel(): void {
    const { width, height } = this.canvas;
    const radius = width / 2;
    this.ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < this.labels.length; i++) {
      const angle = this.arc * i + this.angle;
      this.ctx.beginPath();
      this.ctx.fillStyle = this.pieColors[i];
      this.ctx.moveTo(width / 2, height / 2);
      this.ctx.arc(width / 2, height / 2, radius, angle, angle + this.arc);
      this.ctx.fill();

      this.ctx.save();
      this.ctx.translate(width / 2, height / 2);
      this.ctx.rotate(angle + this.arc / 2);
      this.ctx.textAlign = 'right';
      this.ctx.fillStyle = '#000';
      this.ctx.font = '12px sans-serif';

      const lines: string[] = this.labels[i].split('\n');
      const lineHeight = 14;
      const startY = -(lineHeight * (lines.length - 1)) / 2;

      lines.forEach((line: string, j: number) => {
        this.ctx.fillText(line, radius - 10, startY + j * lineHeight);
      });

      this.ctx.restore();
    }
  }

  getDotStyle(index: number) {
    const radius = 150;
    const angle = (2 * Math.PI * index) / this.labels.length;
    const x = 150 + (radius - 6) * Math.cos(angle) - 6;
    const y = 150 + (radius - 6) * Math.sin(angle) - 6;
    return {
      top: `${y}px`,
      left: `${x}px`,
    };
  }


  spinWheel(): void {
    if (!isPlatformBrowser(this.platformId) || this.isSpinning || this.hasSpun) return;

    this.isSpinning = true;
    this.message = 'Spinning...';

    const probability = this.contest?.probability_of_winning ?? 1;
    const isWinner = Math.random() < probability;

    const winningLabels = this.labels.filter(label =>
      this.contest.offers.some((offer: any) =>
        offer.name?.toLowerCase().trim() === (label?.name || label)?.toLowerCase().trim()
      )
    );

    const losingLabels = this.labels.filter(label =>
      (label?.name || label).toLowerCase().includes('better luck')
    );

    const targetLabels = isWinner ? winningLabels : losingLabels;
    const finalLabel = targetLabels[Math.floor(Math.random() * targetLabels.length)];
    const finalIndex = this.labels.findIndex(label =>
      (label?.name || label).toLowerCase().trim() === (finalLabel?.name || finalLabel).toLowerCase().trim()
    );

    if (finalIndex === -1) {
      console.error('Final label not found in labels array.');
      return;
    }

    const sliceDegrees = 360 / this.labels.length;
    const targetDegrees = 360 - (finalIndex * sliceDegrees + sliceDegrees / 2) + 90;

    const extraSpins = 5 * 360;
    const targetAngle = (extraSpins + targetDegrees) * (Math.PI / 180);
    const startAngle = this.angle;
    const duration = 4000;
    const startTime = performance.now();

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const t = Math.min(elapsed / duration, 1);
      const easedT = easeOutCubic(t);

      this.angle = startAngle + (targetAngle - startAngle) * easedT;
      this.angle %= Math.PI * 2;

      this.drawWheel();

      if (t < 1) {
        this.animationFrame = requestAnimationFrame(animate);
      } else {
        this.isSpinning = false;
        this.hasSpun = true;
        this.angle = targetAngle % (Math.PI * 2);
        this.drawWheel();
        this.onSpinComplete(finalLabel, isWinner);
      }
    };

    this.animationFrame = requestAnimationFrame(animate);
  }


  async onSpinComplete(finalLabel: any, isWinner: boolean): Promise<void> {
    const contestId = this.contest?.contest_id;
    if (!contestId) return;

    const selectedLabel = finalLabel?.name || finalLabel;
    let matchedOffer = null;
    if (isWinner) {
      matchedOffer = this.contest.offers.find(
        (offer: any) =>
          offer.name?.toLowerCase().trim() === selectedLabel.toLowerCase().trim()
      );
    }

    if (!isWinner || !matchedOffer || matchedOffer.voucherNumbers === 0) {
      this.message = `${selectedLabel}`;
      await this.sendResultToApi({ name: selectedLabel }, selectedLabel, false, contestId);
    } else {
      const selectedVoucher = await this.utilService.getRandomVoucher(matchedOffer) || 'Better Luck';
      this.voucher_Code = selectedVoucher;
      this.message = matchedOffer.name;
      this.ex_date = `Expires: ${matchedOffer.expiryDate}`;
      await this.sendResultToApi(matchedOffer, selectedVoucher, true, contestId);
    }
    this.confetti = true;
    setTimeout(async () => {
      this.participationCount = await this.supaBaseService.getContestCount(this.contest.contest_id);
      // console.log('Participation count:', this.participationCount);
      this.pauseMusic();
      this.confetti = false;
      this.showGamePanel = false;
      if (!this.isLoggedIn) {
              this.insta_flow_LoginButton = true;
            }
      this.showGameResult = true;
      document.body.classList.remove('game-running');
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


  async sendResultToApi(prize: any, voucher: string, isWinner: boolean, contestId: string): Promise<void> {
    const userId = localStorage.getItem('userId');
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
    voucher_assigned: isValidVoucher ? `${prize.name} : ${voucher}` : `Better Luck`,
    expiry_date: isWinner ? prize.expiryDate : null,
    };

    // console.log('Sending result to API:', result);

    try {
      await this.supaBaseService.updateContestResults(result);

      if (isWinner) {
        const offerIndex = this.contest.offers.findIndex(
          (offer: any) => offer.name === prize.name
        );

        if (offerIndex !== -1) {
          const updatedVouchers = this.contest.offers[offerIndex].remainingVoucherNumbers
            .split(',')
            .filter((item: string) => item !== voucher)
            .join(',');

          this.contest.offers[offerIndex].remainingVoucherNumbers = updatedVouchers;

          await this.supaBaseService.updateContests({
            contest_id: this.contest.contest_id,
            offers: this.contest.offers,
          });
        }
      }
    } catch (err) {
      console.error('Error saving result or updating offers:', err);
      // localStorage.removeItem(resultKey);
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

  if (!this.contest.contestId) {
    console.error('Missing contestId');
    return;
  }

  const contestData = await this.supaBaseService.getContestById(this.contest.contestId);

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

  const success = await this.supaBaseService.playContest(payload);

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
    const response = await this.supaBaseService.addUserToStore({
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

   async coustomerIdUpdateInstaContest() {

    if (this.instaUserId && this.contest.contestId && this.userId) {
      await this.supaBaseService.linkInstaCustomerToContest({
        contestId: this.contest.contestId,
        instaUserId: this.instaUserId,
        customerId: this.userId
      });
    }
  }
}
