import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { CommonModule } from '@angular/common';
import { UtilService } from '../services/util.service';

declare var bootstrap: any;

@Component({
  selector: 'app-brand-info',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './brand-info.component.html',
  styleUrls: ['./brand-info.component.css']
})
export class BrandInfoComponent {

  storeId!: string;
  brand: any[] = [];
  totalResultCount!: number;
  loading = true;
  brandInfo: any = {};

  selectedShareUrl: string = '';
  activeTab: string = 'info';
  copyBtnText: string = "Copy Link";

  profile: any = null;
  userId: string | null = null;
  contest_Expired: boolean = false;
  storeData: {
    name: string;
    logo: string;
  } | null = null;
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    public utilService: UtilService,
    private supabaseService: SupabaseService
  ) { }

  async ngOnInit() {
    this.userId = localStorage.getItem('userId');
    const profile = await this.supabaseService.getProfile(this.userId!);
    this.profile = profile;

    this.storeId = this.route.snapshot.paramMap.get('storeId')!;
    this.storeData = await this.supabaseService.getStore(this.storeId);

    const brandData = await this.supabaseService.getBrandStoreID(this.storeId);

    this.brand = brandData || [];
    this.brandInfo = this.brand[0]?.stores?.links || {};

    this.brand = (brandData || []).map((item: any) => {
      const now = new Date();
      const expDate = new Date(item.end_date);
      expDate.setHours(23, 59, 59, 999);
      return {
        ...item,
        expired: expDate < now   // ← Add per-item flag
      };
    });

    this.totalResultCount = this.brand.reduce(
      (sum: number, c: any) => sum + (c.result_count || 0),
      0
    );

    this.loading = false;

    // Handle shared links with ?tab=info or ?tab=links
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab) {
      this.activeTab = tab;
      if (tab === 'links' || tab === 'info') {
        this.activeTab = tab;
      }
    }
  }

  // Track active tab
  setActiveTab(tab: string) {
    this.activeTab = tab;
  }

  navigateToContest(contest: any): void {
    const gameType = contest?.contest_type;
    const contestCid = contest?.contest_id || contest.id;

    if (gameType && contestCid) {
      this.router.navigate([`/${gameType}`], {
        queryParams: { cid: contestCid }
      });
    }
  }

  openLeaderboard(contestId: string, event: MouseEvent) {
    event.stopPropagation();
    this.loading = true;

    this.utilService.getLeaderBoard(contestId)
      .then(() => {
        this.loading = false;
        const modalElement = document.getElementById('leaderboardModal1');
        if (modalElement) {
          const modal = new bootstrap.Modal(modalElement);
          modal.show();
        }
      })
      .catch(() => this.loading = false);
  }

  openLink(url: string) {
    if (url) window.open(url, "_blank");
  }

  // -------------------------
  // SHARE FUNCTIONS
  // -------------------------

  // Brand Share
  openBrandShare(url: string) {
    this.selectedShareUrl = url;
    this.showShareModal();
  }

  // Global Share
  openGlobalShare() {
    const baseUrl = window.location.origin + this.router.url.split('?')[0];
    this.selectedShareUrl = `${baseUrl}?tab=${this.activeTab}`;
    this.showShareModal();
  }

  showShareModal() {
    const modalEl = document.getElementById('shareModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  copyLink() {
    navigator.clipboard.writeText(this.selectedShareUrl);

    // Change button text
    this.copyBtnText = "Copied!";

    // Reset after 10 seconds
    setTimeout(() => {
      this.copyBtnText = "Copy Link";
    }, 10000);
  }

  shareTo(type: string) {

    const encodedUrl = encodeURIComponent(this.selectedShareUrl);
    let shareUrl = '';

    switch (type) {

      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodedUrl}`;
        break;

      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;

      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}`;
        break;

      // Instagram (limited support)
      case 'instagram':
        shareUrl = `https://www.instagram.com/?url=${encodedUrl}`;
        break;

      // Snapchat (official share)
      case 'snapchat':
        shareUrl = `https://www.snapchat.com/scan?attachmentUrl=${encodedUrl}`;
        break;

      // Threads (new share endpoint)
      case 'threads':
        shareUrl = `https://www.threads.net/intent/post?text=${encodedUrl}`;
        break;

      // TikTok (best supported URL)
      case 'tiktok':
        shareUrl = `https://www.tiktok.com/share?url=${encodedUrl}`;
        break;
    }

    window.open(shareUrl, "_blank");
  }


}
