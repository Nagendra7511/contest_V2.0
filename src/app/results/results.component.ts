import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../services/supabase.service';
import { AuthService } from '../services/auth.service';
import { UtilService } from '../services/util.service';
import { AnalyticsService } from '../services/analytics.service';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './results.component.html',
  styleUrls: ['./results.component.css']
})
export class ResultsComponent implements OnInit {
  searchTerm: string = '';
  contestsPrivate: any[] = [];
  leaderBoardList: any[] = [];
  allContests: any[] = [];
  message: string = '';
  message1: string = '';
  notificationMessage: string = '';
  messageError: string = '';
  loading: boolean = true;
  userId: string | null = null;
  originalPrivateContests: any[] = [];
  private_hide : boolean = true;
  profile: any = null;
  instaUserId: string | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService,
    private router: Router,
    private utilService: UtilService,
    private analyticsService: AnalyticsService
  ) {}

  async ngOnInit() {
    this.loading = true;
    this.message1 = '';
    this.userId = this.authService.getUserId();

    const profile = await this.supabaseService.getProfile(this.userId!);
    this.profile = profile;

    const username = this.profile.instagram_url;

    const instaUser = await this.supabaseService.getInstaUserByUsername(username);
    this.instaUserId = instaUser?.uuid ?? null;

    if (!this.userId && !this.instaUserId) {
      this.message1 = 'No History available';
      this.loading = false;
      return;
    }
    
    try {
      const privateContests = await this.supabaseService.getContestsHistory(this.userId!, this.instaUserId!);
      const now = new Date();

      this.originalPrivateContests = privateContests.filter(c =>
        c.has_played === true && new Date(c.end_date) >= now
      );

      if (this.originalPrivateContests.length === 0) {
        this.message1 = 'No History available';
        this.private_hide = false;  
      }

      // Show full list (no pagination)
      this.contestsPrivate = [...this.originalPrivateContests];
    } catch (error) {
      console.error('Error fetching contests:', error);
      this.message = 'Failed to load contests. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  filterContests() {
    const term = this.searchTerm.toLowerCase();
    if (!term) {
      this.contestsPrivate = [...this.originalPrivateContests];
    } else {
      this.contestsPrivate = this.originalPrivateContests.filter(contest =>
        contest.contest_name?.toLowerCase().includes(term) || contest.stores.name?.toLowerCase().includes(term)
      );
    }
  }

  async getLeaderBoard(contestId: any) {
    this.loading = true;
    this.leaderBoardList = [];
    this.messageError = '';
    try {
      const leaderBoard = await this.supabaseService.getContestParticipants(contestId);
      if (!leaderBoard || leaderBoard.length === 0) {
        this.messageError = 'No Leaderboard data available';
      } else {
        if (leaderBoard.length < 5) {
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

  navigateToContest(contest: any): void {

    this.analyticsService.sendEvent('Results_view_click', {
      contest_id: contest.contest_id,
      contest_name: contest.name,
      user_id: this.userId
    });

    // const gameType = contest?.contest_type;
    // const contestId = contest?.contest_id;

    // if (gameType && contestId) {
    //   const targetUrl = `/${gameType}/${contestId}`;
    //   this.router.navigate([targetUrl]);
    // } else {
    //   this.router.navigate(['/dashboard']);
    // }

  const gameType = contest?.contest_type;
  const contestCid = contest?.contest_id || contest.id;   // <-- contest id
  const insta_user_id = contest?.user_inst_id;               // <-- user_inst_ID

  if (gameType && contestCid) {
    const targetUrl = `/${gameType}`;
    this.router.navigate([targetUrl], {
      queryParams: { cid: contestCid, id: insta_user_id }
    });
  } else {
    this.router.navigate(['/dashboard']);
  }
  }
}
