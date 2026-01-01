import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, AfterViewInit, ChangeDetectorRef, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterOutlet, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { UtilService } from '../services/util.service';
import { isPlatformBrowser } from '@angular/common';
import { AnalyticsService } from '../services/analytics.service';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { AuthService } from '../services/auth.service';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';
import { ConfittiComponent } from '../confitti/confitti.component';
import { Location } from '@angular/common';
import { LocationService } from '../services/location.service';

interface Item {
  id: string;
  sorted: boolean;
  color: string;
  currentCategory?: string;
  // add other properties your item has
}

@Component({
  selector: 'app-drapdrop-game',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, LoginModalComponent, ProfileModalComponent, ConfittiComponent],
  templateUrl: './drapdrop-game.component.html',
  styleUrls: ['./drapdrop-game.component.css']
})
export class DrapdropGameComponent implements OnInit, AfterViewInit, OnDestroy {
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef,
    private supabaseService: SupabaseService,
    private authserivice: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object,
    public utilService: UtilService,
    private analyticsService: AnalyticsService,
    private locationService: LocationService,
    private location: Location
  ) { }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // console.log(`Key pressed: ${event.key}`);
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


  score = 0;
  timer = 0;
  timerInterval: any;
  gameOver = false;
  gameResultMessage = '';
  dropCount = 0;
  message = '';
  contest: any = {};
  selectedOffer: any;
  userId: any;
  isLoggedIn = false;
  isContestAssigned = false;
  showLoginButton = false;
  showAccessMessage = false;
  loading = true;
  public showWelcomeScreen = false;
  public showGamePanel = false;
  public showGameUpdate = false;
  participationCount: number | null = null;
  finalScore: number = 0;
  showGameResult = false;
  gameResult: any;
  contest_Expired = false;
  showContesExpired = false;
  daysLeft: number = 0;
  insta_post_view = false;
  
  gameMusic!: HTMLAudioElement;
  isMusicPlaying = false;

  profile: any = null;
  instaUserId: string | null = null;


  correctItems: { [key: string]: string[] } = {};
  items = [{ id: '', name: '', sorted: false, color: '' }];
  modalStyles: { [key: string]: string } = {};
  currentHoverCategory: string | null = null;
  confetti = false;
  admin_view = false;
  store_id: string | null = null;
  brand: any[] = []; 
  totalResultCount!: number;
  // Touch tracking
  private activeTouchItem: any = null;
  private lastTouchCategory: string | null = null;

  hasMoved = false;

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

  async loadGameData(): Promise<void> {  
    document.body.classList.add('drag-active');

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
          this.initializeGameConfig();
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
      
      this.timer = this.contest?.game_config?.time_limit;
    

      if (!this.contest.is_private) {
        this.showWelcomeScreen = true;
        this.loading = false;
        this.initializeGameConfig();
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
      this.initializeGameConfig();
    } catch (error) {
      console.error('Error fetching contest or user data:', error);
      this.router.navigate(['/dashboard']);
    }

    this.loading = false;

    this.modalStyles = {
      display: 'flex',
      background: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      alignItems: 'center'
    };
  }

  getCategoryKeys(): string[] {
    return Object.keys(this.correctItems);
  }

  initializeGameConfig(): void {
  const gameConfig = this.contest?.game_config;
  if (!gameConfig || !gameConfig.drop_zones) return;

  const dropZones = gameConfig.drop_zones;

  const updatedCorrectItems: { [key: string]: string[] } = {};
  const itemSet = new Set<string>();

  for (const [categoryName, categoryObject] of Object.entries(dropZones)) {
    const key = categoryName.trim().toLowerCase();

    // NEW FORMAT → categoryObject.items = [{label:"Apple"}, ...]
    const itemsArray =
      Array.isArray((categoryObject as any).items)
        ? (categoryObject as any).items.map((i: any) => String(i.label).trim().toLowerCase())
        : [];

    updatedCorrectItems[key] = itemsArray;

    itemsArray.forEach((item: string) => itemSet.add(item));
  }

  // Convert Set → items array
  let updatedItems = Array.from(itemSet).map(item => ({
    id: item,
    name: this.capitalize(item),
    sorted: false,
    color: ''
  }));

  updatedItems = this.shuffleArray(updatedItems);

  this.correctItems = updatedCorrectItems;
  this.items = updatedItems;
}


  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('drag-active');
    }
    if (isPlatformBrowser(this.platformId)) {
    window.removeEventListener('popstate', this.handleBackNavigation);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }
    this.pauseMusic();
  }

  ngAfterViewInit() { }

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
    }
    this.playMusic();
    this.timer = this.contest?.game_config?.time_limit;
    this.showWelcomeScreen = false;
    this.showGamePanel = true;
    this.showGameUpdate = false;

    this.analyticsService.sendEvent('game_start', {
      game_type: 'drag-drop',
      contest_id: this.contest.contest_id
    });

    this.timerInterval = setInterval(() => this.updateTimer(), 1000);
  }

  updateTimer(): void {
    
    this.timer--;
    if (this.timer <= 0 && !this.gameOver) {
      this.finishGame();
    }
  }

  allowDrop(event: DragEvent) {
    event.preventDefault();
  }

  onDragStart(event: DragEvent, itemId: string) {
    event.dataTransfer?.setData('text', itemId);
  }


  onTouchStart(event: TouchEvent, itemId: string) {
    this.activeTouchItem = itemId;
    this.hasMoved = false;

    const original = document.getElementById(itemId);
    if (original) {
      const clone = original.cloneNode(true) as HTMLElement;
      clone.id = 'ghost-drag-item';
      clone.style.position = 'fixed';
      clone.style.pointerEvents = 'none';
      clone.style.opacity = '0.8';
      clone.style.zIndex = '1000';
      clone.style.width = original.offsetWidth + 'px';
      clone.style.height = original.offsetHeight + 'px';

      document.body.appendChild(clone);

      const touch = event.touches[0];
      clone.style.left = touch.clientX - original.offsetWidth / 2 + 'px';
      clone.style.top = touch.clientY - original.offsetHeight / 2 + 'px';
    }
  }


  onTouchMove(event: TouchEvent) {
    event.preventDefault();
    if (this.activeTouchItem) {
      this.hasMoved = true;

      const ghost = document.getElementById('ghost-drag-item');
      if (ghost) {
        const touch = event.touches[0];
        ghost.style.left = touch.clientX - ghost.offsetWidth / 2 + 'px';
        ghost.style.top = touch.clientY - ghost.offsetHeight / 2 + 'px';
      }

      const touch = event.touches[0];
      const hoveredElement = document.elementFromPoint(touch.clientX, touch.clientY);
      let newCategory: string | null = null;

      if (hoveredElement) {
        const dropZone = hoveredElement.closest('.category');
        newCategory = dropZone?.id || null;
      }

      // If hovered category changes, update the highlight
      if (this.currentHoverCategory !== newCategory) {
        // Remove previous highlight
        if (this.currentHoverCategory) {
          const prevEl = document.getElementById(this.currentHoverCategory);
          if (prevEl) prevEl.style.boxShadow = '';
        }
        this.currentHoverCategory = newCategory;
      }
    }
  }



  onTouchEnd(event: TouchEvent, categoryHint: string | null) {
    const ghost = document.getElementById('ghost-drag-item');
    if (ghost) {
      ghost.remove();
    }

    if (!this.activeTouchItem) return;

    const draggedItem = this.items.find(item => item.id === this.activeTouchItem);
    if (!draggedItem) return;

    if (!this.hasMoved) {
      this.activeTouchItem = null;
      return;
    }

    const touch = event.changedTouches[0];
    const touchedElement = document.elementFromPoint(touch.clientX, touch.clientY);
    let category: string | null = categoryHint;

    if (touchedElement) {
      const dropZone = touchedElement.closest('.category');
      category = dropZone?.id || null;
    }

    if (category) {
      // Item dropped inside a category
      const dropZoneElement = document.getElementById(category);
      if (!dropZoneElement) {
        // Defensive: no such element, treat as invalid drop
        this.resetDraggedItem(draggedItem);
        return;
      }

      if (this.correctItems[category]?.includes(this.activeTouchItem)) {
        // Correct drop
        draggedItem.sorted = true;
        draggedItem.color = 'green';

        // Move item visually inside the category container
        this.moveItemToCategory(draggedItem, dropZoneElement);

        this.score++;
        this.dropCount++;
      } else {
        // Wrong drop inside category
        draggedItem.sorted = true;
        draggedItem.color = 'red';
        this.dropCount++;
        // Optionally snap back to original position so user can retry
        // this.resetDraggedItem(draggedItem);
      }
    } else {
      // Dropped outside any category -> reset and allow retry
      this.resetDraggedItem(draggedItem);
    }

    this.activeTouchItem = null;
    this.hasMoved = false;

    const allItemsDropped = this.dropCount === this.items.length;
    if ((allItemsDropped || this.timer <= 0) && !this.gameOver) {
      this.finishGame();
    }
  }

  resetDraggedItem(item: { id: string; name: string; sorted: boolean; color: string; currentCategory?: string }) {
    item.color = ''; // default color
    item.sorted = false;
    item.currentCategory = undefined;
    // your logic to reset position etc.
  }

  moveItemToCategory(item: Item, categoryElement: HTMLElement) {
    item.currentCategory = categoryElement.id;
    // your logic to move the item visually
  }



  onDrop(event: DragEvent, category: string) {
    event.preventDefault();
    const itemId = event.dataTransfer?.getData('text');
    if (itemId) {
      const draggedItem = this.items.find(item => item.id === itemId);

      if (draggedItem && this.correctItems[category]?.includes(itemId)) {
        draggedItem.sorted = true;
        draggedItem.color = this.getCategoryColor(category);
        this.score++;
      } else if (draggedItem) {
        draggedItem.sorted = true;
        draggedItem.color = 'red';
      }

      this.dropCount++;
      this.activeTouchItem = null;
      this.lastTouchCategory = category;

      const allItemsDropped = this.dropCount === this.items.length;
      if ((allItemsDropped || this.timer <= 0) && !this.gameOver) {
        this.finishGame();
      }
    }
  }


  private finishGame(): void {
    this.gameOver = true;
    clearInterval(this.timerInterval);

    const totalItems = this.items.length;
    const correctItemScore = (this.score / totalItems) * 70;
    const totalTime = this.contest?.game_config?.time_limit || 45;
    const timeBonus = ((this.timer / totalTime) * 30);
    const finalScore = Math.round(correctItemScore + (correctItemScore > 0 ? timeBonus : 0));
    this.finalScore = finalScore;

    // const isWinner = this.score > 0;
    this.message = `You scored ${this.finalScore}`;

    this.sendResultToApi(false, finalScore);
    this.confetti = true;
    this.openPopup();

    
    // this.showWelcomeScreen = false;
    // this.showGamePanel = false;
    // this.showGameUpdate = true;
  }

  openPopup() {
    setTimeout(async () => {
      this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);
      this.pauseMusic();
      this.showWelcomeScreen = false;
      this.showGamePanel = false;
      this.showGameUpdate = true;
      this.confetti = false;
      document.body.classList.remove('game-running');
    }, 3500);
  }

  getCategoryColor(category: string): string {
    return 'green';
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

  endGame(message: string) {
    this.gameOver = true;
    this.gameResultMessage = message;
    clearInterval(this.timerInterval);
    if (this.score === this.items.length) {
      this.triggerFireworks();
    }
  }

  restartGame() {
    location.reload();
  }

  triggerFireworks() { }

  private async sendResultToApi(isWinner: boolean, finalScore: number): Promise<void> {

  if (!this.contest.contestId) {
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
    contest_id: this.contest.contestId,

    // ✅ send ONLY ONE identifier
    customer_id: this.userId ?? null,
    insta_user_id: this.instaUserId ?? null,

    is_winner: isWinner,
    score: this.finalScore || 0,
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
    this.utilService.getLeaderBoard(contestId).then(() => {
      this.loading = false;
    }).catch((err: any) => {
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
  handleBackNavigation = (event: PopStateEvent) => {
    if (this.showGamePanel) {
      this.finishGame();
      // stop them from leaving until score saved
      history.pushState(null, '', window.location.href);
    }
  };
  handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (this.showGamePanel) {
      event.preventDefault();     
      event.returnValue = '';  
      this.finishGame();
      history.pushState(null, '', window.location.href);
    }
  };
}
