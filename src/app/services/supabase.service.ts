import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase!: SupabaseClient;
  private isBrowser: boolean;
  
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (this.isBrowser) {
      this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
    }
  }

  // constructor(@Inject(PLATFORM_ID) private platformId: Object) {
  //   this.isBrowser = isPlatformBrowser(this.platformId);
  //   this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  // }

  async getContestsPublic(userId: string) {
    
    const { data: contests, error: contestsError } = await this.supabase
      .from('contests')
      .select(`
        contest_id:id, contest_name:name, description, background_image, 
        start_date, end_date, num_of_vouchers, is_private,
        min_num_of_participants, max_num_of_tries_per_shop, 
        max_num_of_tries_per_contest, max_num_of_vouchers_per_day, 
        exclude_previous_winners, contest_type, offers, store_id, contest_created_at:created_at,final_section,game_config,welcome_section,active,insta_post,insta_comment,insta_message,insta_post_url,location,
        stores (
        name,
        logo
      )
      `)
      .eq('is_private', false)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (contestsError) {
        console.error('Error fetching public contests:', contestsError);
        return [];
    }

    // Fetch contests the user has already assigned
    const { data: assignedContests, error: assignedError } = await this.supabase
      .from('customers_on_contest')
      .select('contest_id')
      .eq('customer_id', userId);

    if (assignedError) {
        console.error('Error fetching assigned contests:', assignedError);
        return contests; 
    }

    const assignedContestIds = new Set(assignedContests.map((contest: any) => contest.contest_id));
    const filteredContests = contests.filter((contest: any) => !assignedContestIds.has(contest.contest_id));

    return filteredContests;
}



async getContestsPrivate(userId: string) {
  const { data, error } = await this.supabase
    .from('customer_contest_participation_view')
    .select(`
      *,
      stores (
        name,
        logo
      )
    `)
    .eq('customer_id', userId)
    .eq('has_played', false)
    .order('start_date', { ascending: false });

  if (error) {
    console.error('Error fetching data:', error);
    return [];
  }

  // Remove duplicates if needed
  const uniqueContests = data.filter(
    (value, index, self) =>
      index === self.findIndex((item) => item.contest_id === value.contest_id)
  );


  return uniqueContests;
}


async getContestsHistory(userId: string) {
  const { data, error } = await this.supabase
    .from('customer_contest_participation_view')
    .select(`
      *,
      stores (
        name,
        logo
      )
    `)
    .eq('customer_id', userId)
    .order('start_date', { ascending: false });

  if (error) {
    console.error('Error fetching data:', error);
    return [];
  }

  const uniqueContests = data.filter(
    (value, index, self) =>
      index === self.findIndex((item) => item.contest_id === value.contest_id)
  );

  return uniqueContests;
  
}






async getAllContest_assigned(userId: string) {
  const { data, error } = await this.supabase
    .from('customer_contest_participation_view')
    .select('*')
    .or(`customer_id.eq.${userId},is_private.eq.false`);


  if (error) {
    console.error('Error fetching data:', error);
    return [];
  }

  
  return data;
  
  
}

  // get contest results
  async getContestResults(userId: string) {

    const { data, error } = await this.supabase
      .from('contest_results')
      .select(`
      id,
      customer_id,
      contest_id,
      is_winner,
      voucher_assigned,
      expiry_date,
      score,
      created_date,
      contests(
        id,
        name,
        description,
        start_date,
        end_date,
        store_id
      ),
      customers(
        id,
        first_name,
        last_name,
        email,
        phone_number
      )
    `)
      .eq('customer_id', userId)
      .eq('is_winner', true);

    //  console.log('Fetching  contests for user:', data);
    if (error) {
      console.error('Error fetching data:', error);
      return [];
    }

    return data || [];
  }


  // update contest results
  async updateContestResults(updatedResults: any) {
    const { error } = await this.supabase
      .from('contest_results')
      .insert(updatedResults)

    if (error) {
      console.error('Error updating profile:', error);
    }

    return error;
  }

   // get Participation count
   async getContestCount(contestId: number | string) {
    const { count, error } = await this.supabase
    .from('contest_results')
    .select('*', { count: 'exact', head: true })
    .eq('contest_id', contestId);

  if (error) {
    console.error('Error fetching contest count:', error);
    return null;
  }

  return count;
  }

  async getUserResult(contestId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('contest_results')
      .select("*")
      .eq('contest_id', contestId)
      .eq('customer_id', userId)
      .maybeSingle()
  
    if (error) {
      console.error('Error fetching user result:', error);
      return null;
    }
  
    return data;
  }
  
  async updateContests(updatedResults: any) {
    const { error } = await this.supabase
      .from('contests')
      .update({ offers: updatedResults.offers }) // ensure offers is an array
      .eq('id', updatedResults.contest_id);
  
    if (error) {
      console.error('Error updating contest:', error);
      return { success: false, error }; // return error info if there's an issue
    } else {
      // console.log('Successfully updated contest');
      return { success: true }; // return success info
    }
  }
  


  async getContestParticipants(contestId: number | string) {

    const { data, error } = await this.supabase
      .from('leaderboard') 
      .select('*') 
      .eq('contest_id', contestId)
      // .eq('is_winner', true)
      .order('score', { ascending: false })
      .limit(10);
      // console.log('Passing contestId:', contestId); 
      // console.log('LeaderBoard', data);
    if (error) {
      console.error('Error fetching contest:', error);
      return [];
    }
    
    return data;
  }


  async getProfile(userId: string) {
    if (!isPlatformBrowser(this.platformId)) {
      console.warn('getProfile called on the server — skipping Supabase fetch');
      return null;
    }

    // console.log('Fetching profile for userId:', userId);

    const { data, error } = await this.supabase
      .from('customers')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Supabase error:', error);
      return null;
    }

    if (!data) {
      console.warn('No customer profile found for user:', userId);
    } else {
      // console.log('Customer profile fetched:', data);
    }

    return data;
  }
 


  // Update Profile Data
  async updateProfile(userId: string, updatedFields: any) {
    const { error } = await this.supabase
      .from('customers')
      .update(updatedFields)
      .eq('id', userId);

    if (error) {
      console.error('Error updating profile:', error);
    }

    return error;
  }

  // async playContest(userId: string, contestId: string) {
    
  //   const { error } = await this.supabase
  //     .from('customers_on_contest')
  //     .insert([{ customer_id: userId, contest_id: contestId  }]);
  
  //   if (error) {
  //     console.error('Error inserting data:', error);
  //     return false;
  //   }
    
  //   return true;
  // }

// creating a new entry only if not exists - customer_on_contest_table
async playContest(userId: string, contestId: string): Promise<boolean> {
  const { data: existing } = await this.supabase
    .from('customers_on_contest')
    .select('customer_id')
    .eq('customer_id', userId)
    .eq('contest_id', contestId)
    .maybeSingle();

  if (existing) {
    // console.log("User has already played this contest.");
    return false; // Already played
  }

  const { error } = await this.supabase
    .from('customers_on_contest')
    .insert({ customer_id: userId, contest_id: contestId });

  if (error) {
    console.error("Insert failed:", error);
    return false;
  }

  return true; // New entry saved
}

 

  async getContestById(contestId: string) {
    const { data, error } = await this.supabase
      .from('contests')
      .select(`
         contest_id:id, contest_name:name, description, background_image, 
        start_date, end_date, num_of_vouchers, is_private,
        min_num_of_participants, max_num_of_tries_per_shop, 
        max_num_of_tries_per_contest, max_num_of_vouchers_per_day, 
        exclude_previous_winners, contest_type, offers, store_id, contest_created_at:created_at,final_section,game_config,welcome_section,active,insta_post,insta_comment,insta_message,insta_post_url,location,
        stores (
        name,
        logo,
        links
      )
      `)
      .eq('id', contestId)
      // .eq('active', true)
      .single(); // Ensures we get one row or null
  
    if (error) {
      console.error('Error fetching contest by ID:', error);
      return null;
    }
  
    return data;
  }
  
  
  async checkIfContestPlayed(userId: string, contestId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('customer_contest_participation_view') 
      .select('has_played')
      .eq('customer_id', userId)
      .eq('contest_id', contestId)
      .maybeSingle();
  
    if (error) {
      console.error('Error checking has_played status:', error);
      return false;
    }
  
    return data?.has_played === true;
  }

  async getContestprobability(userId: string, contestId: string) {
    const { data, error } = await this.supabase
      .from('customer_contest_participation_view')
      .select('probability_of_winning, contest_id, customer_id')
      .eq('customer_id', userId)
      .eq('contest_id', contestId)
      .limit(1)  // optional, if only one expected
  
    if (error) {
      console.error('Error fetching probability:', error);
      return null;
    }
  
    // console.log('Probability of winning:', data);
    return data;
  }

   async getBrandUser(userId: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)

       if (error) {
      console.error('Supabase error:', error);
      return null;
      }
      else {
        // console.log('Brand profile fetched:', data);
      }
      return data;
  }
  async getBrandContests(store_id: string) {
    const { data, error } = await this.supabase
      .from('contests')
       .select(`
      *,
      stores (
        name,
        logo
      )
    `)
      .eq('store_id', store_id)

       if (error) {
      console.error('Supabase error:', error);
      return null;
      }
      else {
        // console.log('Brand contests fetched:', data);
      }
      return data;
  }
  
  async getBrandContestsByID(contestId: string) {
    const { data, error } = await this.supabase
      .from('contests')
      .select(`
         contest_id:id, contest_name:name, description, background_image, 
        start_date, end_date, num_of_vouchers, is_private,
        min_num_of_participants, max_num_of_tries_per_shop, 
        max_num_of_tries_per_contest, max_num_of_vouchers_per_day, 
        exclude_previous_winners, contest_type, offers, store_id, contest_created_at:created_at,final_section,game_config,welcome_section,active,
        stores (
        name,
        logo,
        links
      )
      `)
      .eq('id', contestId)
      .order('start_date', { ascending: false })
      // .eq('active', true)
      .single(); // Ensures we get one row or null
  
    if (error) {
      console.error('Error fetching contest by ID:', error);
      return null;
    }
  
    return data;
  }

  // async getBrandStoreID(store_id: string) {
  //   const { data, error } = await this.supabase
  //     .from('contests')
  //     .select(`
  //       contest_id:id, contest_name:name, description, background_image, 
  //       start_date, end_date, num_of_vouchers, is_private,
  //       min_num_of_participants, max_num_of_tries_per_shop, 
  //       max_num_of_tries_per_contest, max_num_of_vouchers_per_day, 
  //       exclude_previous_winners, contest_type, offers, store_id, contest_created_at:created_at,final_section,game_config,welcome_section,active,
  //       stores (
  //       name,
  //       logo,
  //       links
  //     )
  //     `)
  //     .eq('store_id', store_id)
  
  //   if (error) {
  //     console.error('Error fetching contest by ID:', error);
  //     return null;
  //   }
  
  //   return data;
  // }




  async getBrandStoreID(store_id: string) {
  const { data: contests, error } = await this.supabase
    .from('contests')
    .select(`
      contest_id:id, contest_name:name, description, background_image, 
      start_date, end_date, num_of_vouchers, is_private,
      min_num_of_participants, max_num_of_tries_per_shop, 
      max_num_of_tries_per_contest, max_num_of_vouchers_per_day, 
      exclude_previous_winners, contest_type, offers, store_id, contest_created_at:created_at,
      final_section, game_config, welcome_section, active,insta_post,insta_comment,insta_message,insta_post_url,location,
      stores (
        name,
        logo,
        links
      )
    `)
    .eq('store_id', store_id)
    .eq('active', true)
    .order('start_date', { ascending: false });

  if (error) {
    console.error('Error fetching contests by store ID:', error);
    return null;
  }

  // Fetch result count for each contest
  const contestsWithCounts = await Promise.all(
    contests.map(async (contest) => {
      const { count, error: countError } = await this.supabase
        .from('contest_results')
        .select('*', { count: 'exact', head: true })
        .eq('contest_id', contest.contest_id);

      if (countError) {
        console.error(`Error fetching result count for contest ${contest.contest_id}:`, countError);
      }

      return {
        ...contest,
        result_count: count ?? 0
      };
    })
  );

  return contestsWithCounts;
}

  async getContestInstaId(insta_user_id: string) {
    const { data, error } = await this.supabase.from('insta_user_on_contest')
      .select(`id, insta_user, username, contest_id`)
      .eq('id', insta_user_id)
      .single();
    if (error) {
      console.error('Error fetching contest by ID:', error);
      return null;
    }
    return data;
  }



  async validateAndUpdateInstaUser(insta_user_id: string, profile?: any) {
  try {
    const contestUser = await this.getContestInstaId(insta_user_id);

    if (!contestUser || !contestUser.insta_user) {
      return { valid: false, instagram_url: null };
    }

    const instagram_url = contestUser.username;

    localStorage.setItem('instagram_url', instagram_url);

    // Update profile only if needed
    if (profile && !profile.instagram_url) {
      await this.updateProfile(profile.id, { instagram_url });
    }

    // NEW: update insta_users table ONLY WHEN profile exists
    if (profile) {
      await this.updateInstaUsersTable(contestUser.insta_user, profile.id);
    }

    return { valid: true, instagram_url };
  } catch (err) {
    return { valid: false, instagram_url: null };
  }
}



  // Update insta_users table (identified + customer_id)
async updateInstaUsersTable(instaUserId: string, customerId: string) {
  // Fetch existing insta_users row
  const { data, error: fetchError } = await this.supabase
    .from('insta_users')
    .select('customer_id, identified')
    .eq('uuid', instaUserId)
    .single();

  if (fetchError) {
    console.error('Error fetching insta_users:', fetchError);
    return fetchError;
  }

  // If already linked, do NOT update
  if (data?.customer_id) {
    // Already linked -> Nothing to update
    return null;
  }

  // Perform update only if customer_id is NULL
  const { error } = await this.supabase
    .from('insta_users')
    .update({
      customer_id: customerId,
      identified: true
    })
    .eq('uuid', instaUserId);

  if (error) {
    console.error('Error updating insta_users table:', error);
  }

  return error;
}

// Check & Insert customer into customers_on_store only once
async addCustomerToStore(customer_id: string, store_id: string) {
  const { data: existing, error: selectError } = await this.supabase.from('customers_on_store')
    .select('*')
    .eq('customer_id', customer_id)
    .eq('store_id', store_id)
    .single();

  if (existing) {
    return { inserted: false, message: "Already exists", data: existing };
  }

  const { data, error } = await this.supabase.from('customers_on_store')
    .insert([{ customer_id, store_id }])
    .select()
    .single();
  if (error) throw error;

  return { inserted: true, message: "Inserted Successful", data };
}

async getStore(store_id: string) {
  const { data, error } = await this.supabase
    .from('stores')
    .select('name, logo')
    .eq('id', store_id)
    .single();

  if (error) {
    console.error(error);
    return null;
  }

  return data;
}


  

}


