import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../services/supabase.service';
import { AuthService } from '../services/auth.service';
import { UtilService } from '../services/util.service';
import { AnalyticsService } from '../services/analytics.service';


@Component({
  selector: 'app-contests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contests.component.html',
  styleUrls: ['./contests.component.css']
})
export class ContestsComponent implements OnInit {
  searchTerm: string = '';
  contestsPublic: any[] = [];
  contestsPrivate: any[] = [];
  leaderBoardList: any[] = [];
  allContests: any[] = [];
  message: string = '';
  message1: string = '';
  notificationMessage: string = '';
  messageError: string = '';
  loading: boolean = true;
  no_public_contests: boolean = true;
  no_pravite_contests: boolean = true;
  userId: string | null = null;
  originalPublicContests: any[] = [];
  originalPrivateContests: any[] = [];

  public_hide : boolean = true;
  private_hide : boolean = true;
  brand_hide : boolean = true;

  currentPagePrivate: number = 1;
  pageSizePrivate: number = 3;  
  totalPagesPrivate: number = 1; 
  pageSize: number = 3; 
  store_id: string | null = null;
  contestsBrand: any[] = [];
  brandContests: any[] = [];

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService,
    private router: Router,
    private utilService: UtilService,
    private analyticsService: AnalyticsService
  ) { }

  async ngOnInit() {
  document.body.classList.remove('game-running');
  this.loading = true;
  this.message = '';
  this.message1 = '';
  this.userId = this.authService.getUserId();

  // console.log(this.userId);

  if (!this.userId) {
    this.message1 = 'No Contests Available';
    this.loading = false;
    return;
  }

  const brandUser = await this.supabaseService.getBrandUser(this.userId);
  this.store_id = (brandUser && brandUser.length > 0) ? brandUser[0].store_id : null;

  if (this.store_id) {
    const brandContests = await this.supabaseService.getBrandContests(this.store_id);
    this.brandContests = brandContests ?? [];
    const now = new Date();
    // this.contestsBrand = this.brandContests.filter((contest: any) => {
    //   const expDate = new Date(contest.end_date);
    //   return expDate >= now;
    // });

    this.contestsBrand = this.brandContests
  .filter((contest: any) => {
    const expDate = new Date(contest.end_date);
    return expDate >= now;
  })
  .map((contest: any) => {
    const expDate = new Date(contest.end_date);
    const timeDiff = expDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)); // Only days
    return {
      ...contest,
      daysLeft
    };
  });

    // console.log(brandContests);
    this.loading = false;
    this.public_hide = false;
    this.private_hide = false;
    return;
  }
 
  else{
    this.brand_hide = false
    try {
    const publicContests = await this.supabaseService.getContestsPublic(this.userId);
    const now = new Date();

    // ✅ Filter out expired public contests
    // this.contestsPublic = publicContests.filter(contest => {
    //   const expDate = new Date(contest.end_date);
    //   return expDate >= now;
    // });
    this.contestsPublic = publicContests
  .filter(contest => {
    const expDate = new Date(contest.end_date);
    return expDate >= now;
  })
  .map(contest => {
    const expDate = new Date(contest.end_date);
    const timeDiff = expDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    return {
      ...contest,
      daysLeft
    };
  });

    this.originalPublicContests = [...this.contestsPublic]; // Store filtered copy
    if (this.contestsPublic.length === 0) {
      this.public_hide = false;
      this.message = 'No Active Contests Available';
    }

    const privateContests = await this.supabaseService.getContestsPrivate(this.userId);
    
    // ✅ Filter out expired private contests
    // this.contestsPrivate = privateContests.filter(contest => {
    //   const expDate = new Date(contest.end_date);
    //   return expDate >= now;
    // });

    this.contestsPrivate = privateContests
  .filter(contest => {
    const expDate = new Date(contest.end_date);
    return expDate >= now;
  })
  .map(contest => {
    const expDate = new Date(contest.end_date);
    const timeDiff = expDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    return {
      ...contest,
      daysLeft
    };
  });


    this.originalPrivateContests = [...this.contestsPrivate]; // Store filtered copy
    if (this.contestsPrivate.length === 0) {
      this.private_hide = false;
      this.message1 = 'No Contests Available';
    }

    // Combine all (filtered) contests
    this.allContests = [...this.contestsPublic, ...this.contestsPrivate];
    this.totalPagesPrivate = Math.ceil(this.contestsPrivate.length / this.pageSize);
    this.updatePagePrivate();

  } catch (error) {
    console.error('Error fetching contests:', error);
    this.message = 'Failed to load contests. Please try again.';
  } finally {
    this.loading = false;
  }
  }

  
}


  // Pagination methods for private contests
  updatePagePrivate() {
    const startIndex = (this.currentPagePrivate - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
  
    // Always slice from originalPrivateContests to maintain full list integrity
    this.contestsPrivate = this.originalPrivateContests.slice(startIndex, endIndex);
  }
  

  

  // Handle next page for private contests
  nextPagePrivate() {
    if (this.currentPagePrivate < this.totalPagesPrivate) {
      this.currentPagePrivate++;
      this.updatePagePrivate();
    }
  }

  // Handle previous page for private contests
  previousPagePrivate() {
    if (this.currentPagePrivate > 1) {
      this.currentPagePrivate--;
      this.updatePagePrivate();
    }
  }

  

  // Play contest method
  // async handlePlay(contestId: string) {
  //   if (!this.userId) {
  //     console.error('User ID is missing! Cannot join contest.');
  //     return;
  //   }
  //   const success = await this.supabaseService.playContest(this.userId, contestId);
  //   if (success) {
  //     this.contestsPublic = this.contestsPublic.filter(c => c.contest_id !== contestId);
  //   } else {
      
  //   }
  // }

  onPlayClick(contest: any) {

    this.analyticsService.sendEvent('play_click', {
      contest_id: contest.contest_id,
      contest_name: contest.name,
      contest_type: contest.contest_type,
      user_id: this.userId
    });

    this.utilService.setPlayState(contest.contest_id, this.userId!);
    this.navigateToContest(contest);
    // this.onGameFinished();
  }
  

  filterContests() {
    const term = this.searchTerm.toLowerCase();
  
    this.contestsPublic = this.originalPublicContests.filter(contest =>
      contest.contest_name?.toLowerCase().includes(term) || contest.stores.name?.toLowerCase().includes(term) 
    );
    if (!term) {
      // Reset to original and pagination
      this.currentPagePrivate = 1;
      this.totalPagesPrivate = Math.ceil(this.originalPrivateContests.length / this.pageSize);
      this.updatePagePrivate();
    } else {
      const filteredPrivate = this.originalPrivateContests.filter(contest =>
        contest.contest_name?.toLowerCase().includes(term) || contest.stores.name?.toLowerCase().includes(term)
      );
  
      this.currentPagePrivate = 1; // Always go to first page after filter
      this.contestsPrivate = filteredPrivate;
      this.totalPagesPrivate = Math.ceil(filteredPrivate.length / this.pageSize);
    }
  }


  // Leaderboard fetching method
  async getLeaderBoard(contestId: any) {
    this.loading = true;
    this.leaderBoardList = [];
    this.messageError = '';
    try {
      const leaderBoard = await this.supabaseService.getContestParticipants(contestId);
      if (!leaderBoard || leaderBoard.length === 0) {
        this.notificationMessage = 'Looks a bit quiet here… start playing and see your name shine!';
      } else {
        if (leaderBoard.length < 5) {
          // alert('Looks a bit quiet here… start playing and see your name shine!');
          this.notificationMessage = 'Looks a bit quiet here… start playing and see your name shine!';
        }
        this.leaderBoardList = leaderBoard;
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      this.messageError = 'Failed to fetch leaderboard';
    } finally {
      this.loading = false;
    }
  }

  // Navigating to contest
  async onGameFinished() {
    const success = await this.utilService.submitPlay();
    if (success) {
      // console.log('Contest participation saved!');
    } else {
      console.error('Failed to update participation');
    }
    this.utilService.clearPlayState();
  }
  
  navigateToContest(contest: any): void {
  if (contest.insta_post) {
  // navigate to external Instagram URL
  // window.open(contest.insta_post_url, '_blank');
  // external link - same tab
   window.location.href = contest.insta_post_url;
}
  const gameType = contest?.contest_type;
  const contestId = contest?.contest_id || contest.id;   
  // const userInstId = contest?.id;               

  if (gameType && contestId) {
    const targetUrl = `/${gameType}`;
    this.router.navigate([targetUrl], {
      queryParams: { cid: contestId}
    });

  } else {
    this.router.navigate(['/dashboard']);
  }
}



}
