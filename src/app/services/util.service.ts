import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class UtilService {
  private currentContestId: string | null = null;
  private userId: string | null = null;
  leaderBoardList: any[] = [];
  messageError: string = '';
  notificationMessage: string = '';
  loading: boolean = true;
  private storeId: string | null = null;
  private instaUserId: string | null = null;

  constructor(private supabaseService: SupabaseService, private route: ActivatedRoute) {}

  setPlayState(
    contestId: string,
    storeId: string,
    userId?: string | null,
    instaUserId?: string | null
  ): void {
    this.currentContestId = contestId;
    this.storeId = storeId;
    this.userId = userId ?? null;
    this.instaUserId = instaUserId ?? null;
  }

  // async submitPlay(): Promise<boolean> {
  //   if (this.userId && this.currentContestId) {
  //     return await this.supabaseService.playContest(this.userId, this.currentContestId);
  //   }
  //   return false;
  // }

 async submitPlay(): Promise<boolean> {
  if (!this.currentContestId || !this.storeId) {
    console.error('Missing contestId or storeId');
    return false;
  }

  if (!this.userId && !this.instaUserId) {
    console.error('No valid identifier');
    return false;
  }

  return await this.supabaseService.playContest({
    contestId: this.currentContestId,
    storeId: this.storeId,
    customerId: this.userId,
    instaUserId: this.instaUserId
  });
}


  clearPlayState(): void {
  this.currentContestId = null;
  this.storeId = null;
  this.userId = null;
  this.instaUserId = null;
  }

  getRandomVoucher(offer: any): string {
    if (!offer?.remainingVoucherNumbers) return '';

    const vouchersArray = offer.remainingVoucherNumbers
      .split(',')
      .map((v: string) => v.trim())
      .filter((v: string) => v); 

    if (vouchersArray.length === 0) return '';

    const randomIndex = Math.floor(Math.random() * vouchersArray.length);
    return vouchersArray[randomIndex];
  }

  getRandomElement<T>(arr: T[]): T | null {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * arr.length);
    return arr[randomIndex];
  }
   // Leaderboard fetching method
   async getLeaderBoard(contestId: any) {
    this.loading = true;
    this.leaderBoardList = [];
    this.messageError = '';
    try {
      const leaderBoard = await this.supabaseService.getContestParticipants(contestId);
      if (!leaderBoard || leaderBoard.length === 0) {
       
        this.messageError = 'No Leaderboard data available';
         this.notificationMessage = 'Looks a bit quiet here… start playing and see your name shine!';
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
}
