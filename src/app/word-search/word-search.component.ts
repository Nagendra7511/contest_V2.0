import { ElementRef, ViewChild } from '@angular/core';
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

interface FoundWord {
  word: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

@Component({
  selector: 'app-word-search',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileModalComponent, LoginModalComponent, ConfittiComponent],
  templateUrl: './word-search.component.html',
  styleUrls: ['./word-search.component.css'],
})
export class WordSearchComponent implements OnInit, OnDestroy {
  @ViewChild('gridCanvas') gridCanvas!: ElementRef<HTMLCanvasElement>;
  ctx!: CanvasRenderingContext2D;

  gridSize = 10;
  cellSize = 35;
  letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  grid: string[][] = [];
  // words = ['APPLE', 'BANANA', 'CARROT', 'GRAPE'];
  words: string[] = [];
  foundWords: FoundWord[] = [];

  isPlaying = false;
  gameOver = false;
  score = 0;
  timer = 60;
  intervalId: any;

  startPos: any = null;
  endPos: any = null;
  isDragging = false;

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
    }
  }

  async loadGameData(): Promise<void> {
    document.body.classList.add('word-grid-active');

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
      console.log('Contest Data:', contestData);
      const now = new Date();
      const expDate = new Date(contestData.end_date);
      this.contest_Expired = expDate < now;

      const timeDiff = expDate.getTime() - now.getTime();
      this.daysLeft = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));

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
          this.words = this.contest.game_config.words
            .map((w: string) => w.replace(/\s+/g, '').toUpperCase());

          this.showWelcomeScreen = true;
          this.loading = false;
          this.admin_view = true;
          return;
        }
      }

      

      this.words = this.contest.game_config.words
        .map((w: string) => w.replace(/\s+/g, '').toUpperCase());

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
      
      this.hasPlayed = await this.supabaseService.checkIfContestPlayed({
        contestId: this.contest.contest_id,
        customerId: this.userId ?? null,
         instaUserId: this.instaUserId ?? null
      });
      this.participationCount = await this.supabaseService.getContestCount(this.contest.contest_id);

      if (this.hasPlayed) {
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
      document.body.classList.remove('word-grid-active');
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
    if (this.showGamePanel) return;
    this.playMusic();
    this.showWelcomeScreen = false;
    this.showGamePanel = true;
    this.showGameUpdate = false;
    this.loading = true;
    this.gameOver = false;
    this.score = 0;
    this.timer = this.contest.game_config.time_limit || 80;
    this.words = this.contest.game_config.words
      .map((w: string) => w.replace(/\s+/g, '').toUpperCase());

    this.loading = false;
    this.foundWords = [];
    this.initGrid();
    this.cdr.detectChanges();

    setTimeout(() => {
      this.drawGrid();
      this.startTimer();
      this.attachEvents();
    });
    this.analyticsService.sendEvent('game_start', {
      game_type: 'word-grid-game',
      contest_id: this.contest.contest_id
    });

    if (!isPlatformBrowser(this.platformId)) return;
    // this.startTimer();
  }




  initGrid() {

    this.grid = Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(''));


    const placeWord = (word: string) => {
      const directions = [
        { dx: 1, dy: 0 },  // horizontal
        { dx: 0, dy: 1 },  // vertical
        { dx: 1, dy: 1 },  // diagonal down-right
        { dx: 1, dy: -1 }  // diagonal up-right
      ];

      let placed = false;
      while (!placed) {
        const dir = directions[Math.floor(Math.random() * directions.length)];
        const xStart = Math.floor(Math.random() * this.gridSize);
        const yStart = Math.floor(Math.random() * this.gridSize);

        let x = xStart;
        let y = yStart;
        let canPlace = true;

        for (let i = 0; i < word.length; i++) {
          if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) {
            canPlace = false;
            break;
          }
          if (this.grid[y][x] !== '' && this.grid[y][x] !== word[i]) {
            canPlace = false;
            break;
          }
          x += dir.dx;
          y += dir.dy;
        }

        if (canPlace) {
          x = xStart;
          y = yStart;
          for (let i = 0; i < word.length; i++) {
            this.grid[y][x] = word[i];
            x += dir.dx;
            y += dir.dy;
          }
          placed = true;
        }
      }
    };

    // Place all words
    this.words.forEach(placeWord);

    // Fill remaining empty cells
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        if (this.grid[i][j] === '') {
          this.grid[i][j] = this.letters[Math.floor(Math.random() * this.letters.length)];
        }
      }
    }
  }

  drawGrid() {
    const canvas = this.gridCanvas?.nativeElement;
    if (!canvas) return;

    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (!this.ctx) return;

    canvas.width = this.gridSize * this.cellSize;
    canvas.height = this.gridSize * this.cellSize;

    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.font = '18px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Draw cells and letters
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        const x = j * this.cellSize;
        const y = i * this.cellSize;

        this.ctx.strokeStyle = '#ccc';
        this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);
        this.ctx.fillStyle = '#000';
        this.ctx.fillText(this.grid[i][j], x + this.cellSize / 2, y + this.cellSize / 2);
      }
    }

    // Highlight found words
    this.foundWords.forEach(f => this.highlightWord(f.start, f.end, 'rgba(0,255,0,0.4)'));
  }

  startTimer() {
    clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      this.timer--;
      if (this.timer <= 0) this.endGame();
    }, 1000);
  }



  attachEvents() {
    const canvas = this.gridCanvas.nativeElement;

    const getPos = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((clientX - rect.left) / this.cellSize);
      const y = Math.floor((clientY - rect.top) / this.cellSize);
      return { x, y };
    };

    const start = (x: number, y: number) => {
      this.startPos = getPos(x, y);
      this.isDragging = true;
    };

    const move = (x: number, y: number) => {
      if (!this.isDragging || !this.startPos) return;
      this.endPos = getPos(x, y);
      this.drawGrid();
      this.previewSelection();
    };

    const end = (x: number, y: number) => {
      if (!this.startPos) return;
      this.endPos = getPos(x, y);
      this.checkSelection();
      this.isDragging = false;
      this.startPos = null;
      this.endPos = null;
    };

    // Mouse events
    canvas.onmousedown = (e) => start(e.clientX, e.clientY);
    canvas.onmousemove = (e) => move(e.clientX, e.clientY);
    canvas.onmouseup = (e) => end(e.clientX, e.clientY);

    // Touch events
    canvas.ontouchstart = (e) => {
      const t = e.touches[0];
      start(t.clientX, t.clientY);
    };
    canvas.ontouchmove = (e) => {
      const t = e.touches[0];
      move(t.clientX, t.clientY);
    };
    canvas.ontouchend = (e) => {
      const t = e.changedTouches[0];
      end(t.clientX, t.clientY);
    };
  }

  previewSelection() {
    if (!this.startPos || !this.endPos) return;

    const dx = Math.sign(this.endPos.x - this.startPos.x);
    const dy = Math.sign(this.endPos.y - this.startPos.y);

    let x = this.startPos.x;
    let y = this.startPos.y;

    this.ctx.fillStyle = 'rgba(238, 122, 20, 0.2)';

    while (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
      this.ctx.fillRect(
        x * this.cellSize,
        y * this.cellSize,
        this.cellSize,
        this.cellSize
      );
      if (x === this.endPos.x && y === this.endPos.y) break;
      x += dx;
      y += dy;
    }
  }

  checkSelection() {
    if (!this.startPos || !this.endPos) return;

    const dx = Math.sign(this.endPos.x - this.startPos.x);
    const dy = Math.sign(this.endPos.y - this.startPos.y);

    let word = '';
    let x = this.startPos.x;
    let y = this.startPos.y;

    while (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
      word += this.grid[y][x];
      if (x === this.endPos.x && y === this.endPos.y) break;
      x += dx;
      y += dy;
    }

    const reversedWord = word.split('').reverse().join('');

    let foundWord = null;

    if (this.words.includes(word) && !this.isWordFound(word)) {
      foundWord = word;
    } else if (this.words.includes(reversedWord) && !this.isWordFound(reversedWord)) {
      foundWord = reversedWord;
    }

    if (foundWord) {
      this.foundWords.push({
        word: foundWord,
        start: this.startPos,
        end: this.endPos,
      });
      this.score += 10;
      if (this.foundWords.length === this.words.length) {
        this.endGame();
      }
    }

    this.drawGrid();
  }

  highlightWord(start: any, end: any, color = 'rgba(88, 175, 88, 0.4)') {
    const dx = Math.sign(end.x - start.x);
    const dy = Math.sign(end.y - start.y);
    let x = start.x;
    let y = start.y;

    this.ctx.fillStyle = color;

    while (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
      this.ctx.fillRect(
        x * this.cellSize,
        y * this.cellSize,
        this.cellSize,
        this.cellSize
      );
      if (x === end.x && y === end.y) break;
      x += dx;
      y += dy;
    }
  }

  isWordFound(word: string): boolean {
    return this.foundWords.some((f) => f.word === word);
  }

  endGame(): void {
    clearInterval(this.intervalId);
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.timer) clearInterval(this.timer);
    const bonusPoints = this.timer * 2;
    this.score += bonusPoints;
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
      instaUserId: this.instaUserId ?? null,
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
