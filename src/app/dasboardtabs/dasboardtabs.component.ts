import { Component, OnInit } from '@angular/core';
import { ContestsComponent } from '../contests/contests.component';
import { ResultsComponent } from '../results/results.component';
import { AnnoucementsComponent } from '../annoucements/annoucements.component';
import { SupabaseService } from '../services/supabase.service';
import { AuthService } from '../services/auth.service';
import { UtilService } from '../services/util.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dasboardtabs',
  imports: [ContestsComponent, ResultsComponent, AnnoucementsComponent, CommonModule, RouterLink],
  templateUrl: './dasboardtabs.component.html',
  styleUrl: './dasboardtabs.component.css'
})
export class DasboardtabsComponent implements OnInit {

  userId: string | null = null;
  profile: any = null;
  private mutationObserver?: MutationObserver;

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService,
    private utilService: UtilService
  ) { }
  async ngOnInit() {

    const htmlEl = document.documentElement;

    // Initial cleanup
    if (htmlEl.hasAttribute('native-dark-active')) {
      htmlEl.removeAttribute('native-dark-active');
    }

    // Remove injected style if it exists
    const darkStyle = document.getElementById('dark-mode-native-style');
    if (darkStyle) darkStyle.remove();

    // ✅ Continuous watcher
    this.mutationObserver = new MutationObserver(() => {
      // Remove native-dark-active whenever it appears
      if (htmlEl.hasAttribute('native-dark-active')) {
        htmlEl.removeAttribute('native-dark-active');
      }

      // Remove injected dark style if Chrome re-adds it
      const styleTag = document.getElementById('dark-mode-native-style');
      if (styleTag) styleTag.remove();
    });

    // Watch for attribute or style tag changes
    this.mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['native-dark-active']
    });

    this.mutationObserver.observe(document.head, {
      childList: true
    });


    this.userId = this.authService.getUserId();
    
    // console.log(this.userId);
    const profile = await this.supabaseService.getProfile(this.userId!);
    // console.log('profile',profile);
     this.profile = profile;
    
  }

}
