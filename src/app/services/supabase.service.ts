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


async getContestsHistory(userId: string, instaUserId?: string) {
  let query = this.supabase
    .from('customer_contest_participation_view')
    .select(`
      *,
      stores (
        name,
        logo
      )
    `)
    .order('start_date', { ascending: false });

  // 🔹 Apply OR condition
  if (userId && instaUserId) {
    query = query.or(
      `customer_id.eq.${userId},insta_user_id.eq.${instaUserId}`
    );
  } else if (userId) {
    query = query.eq('customer_id', userId);
  } else if (instaUserId) {
    query = query.eq('insta_user_id', instaUserId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching data:', error);
    return [];
  }

  // 🔁 Remove duplicate contests (same contest_id)
  const uniqueContests = data.filter(
    (value, index, self) =>
      index === self.findIndex(
        (item) => item.contest_id === value.contest_id
      )
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
  async updateContestResults(result: {
  contest_id: string;
  customer_id?: string | null;
  insta_user_id?: string | null;
  is_winner: boolean;
  score: string | number | null;
  voucher_assigned?: string;
  expiry_date?: string | null;
}) {
  const { contest_id, customer_id, insta_user_id } = result;

  if (!contest_id) {
    throw new Error('Missing contest_id');
  }

  if (!customer_id && !insta_user_id) {
    throw new Error('Missing user identifier');
  }

  /* -------------------------------------------------
     1️⃣ CHECK IF RESULT EXISTS FOR CONTEST
     (ANY USER)
  ------------------------------------------------- */
  const { data: existing } = await this.supabase
    .from('contest_results')
    .select('id')
    .eq('contest_id', contest_id)
    .maybeSingle();

  if (existing) {
    // ❌ Result already exists → SKIP
    return {
      skipped: true,
      reason: 'Result already exists for contest'
    };
  }

  /* -------------------------------------------------
     2️⃣ INSERT RESULT (FIRST & ONLY ENTRY)
  ------------------------------------------------- */
  const insertPayload = {
    contest_id,
    customer_id: customer_id ?? null,
    insta_user_id: insta_user_id ?? null,
    is_winner: result.is_winner,
    score: result.score,
    voucher_assigned: result.voucher_assigned ?? '',
    expiry_date: result.expiry_date ?? null
  };

  const { error } = await this.supabase
    .from('contest_results')
    .insert(insertPayload);

  if (error) {
    // console.error('Insert error:', error);
    return { skipped: false, error };
  }

  return {
    inserted: true
  };
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

  async getUserResult(params: {
    contestId: string;
    customerId?: string | null;
    instaUserId?: string | null;
  }) {
    const { contestId, customerId, instaUserId } = params;

    if (!contestId || (!customerId && !instaUserId)) {
      return null;
    }

    let query = this.supabase
      .from('contest_results')
      .select('*')
      .eq('contest_id', contestId)
      .limit(1);

    // ✅ OR logic when both are present
    if (customerId && instaUserId) {
      query = query.or(
        `customer_id.eq.${customerId},insta_user_id.eq.${instaUserId}`
      );
    }
    else if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    else {
      query = query.eq('insta_user_id', instaUserId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      // console.error('Error fetching user result:', error);
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
      // console.error('Supabase error:', error);
      return null;
    }

    if (!data) {
      // console.warn('No customer profile found for user:', userId);
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
async playContest(params: {
  contestId: string;
  storeId: string;
  customerId?: string | null;
  instaUserId?: string | null;
}): Promise<boolean> {

  const { contestId,storeId, customerId, instaUserId } = params;

  if (!contestId || (!customerId && !instaUserId)) {
    console.error('Missing identifiers');
    return false;
  }

  // 🔍 Check existing participation
  let query = this.supabase
    .from('customers_on_contest')
    .select('id')
    .eq('contest_id', contestId);

  if (customerId && instaUserId) {
    // ✅ Logged-in user with IG → check BOTH
    query = query.or(
      `customer_id.eq.${customerId},insta_user_id.eq.${instaUserId}`
    );
  } else if (customerId) {
    // ✅ Logged-in user (no IG)
    query = query.eq('customer_id', customerId);
  } else {
    // ✅ Non-logged-in IG user
    query = query.eq('insta_user_id', instaUserId!);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    // 🚫 Already participated
    return false;
  }

  // ➕ Insert new participation
  const { error } = await this.supabase
    .from('customers_on_contest')
   .insert({
      contest_id: contestId,
      store_id: storeId,
      customer_id: customerId ?? null,
      insta_user_id: instaUserId ?? null
    });

  if (error) {
    console.error('Insert failed:', error);
    return false;
  }

  return true;
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
  
  
  async checkIfContestPlayed(params: {
  customerId?: string | null;
  instaUserId?: string | null;
  contestId: string;
}): Promise<boolean> {

  const { customerId, instaUserId, contestId } = params;

  if (!contestId || (!customerId && !instaUserId)) {
    return false;
  }

  let query = this.supabase
    .from('customer_contest_participation_view')
    .select('has_played')
    .eq('contest_id', contestId)
    .limit(1);

  // ✅ CHECK BOTH IDENTIFIERS
  if (customerId && instaUserId) {
    query = query.or(
      `customer_id.eq.${customerId},insta_user_id.eq.${instaUserId}`
    );
  } else if (customerId) {
    query = query.eq('customer_id', customerId);
  } else {
    query = query.eq('insta_user_id', instaUserId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    // console.error('Error checking has_played status:', error);
    return false;
  }

  return data?.has_played === true;
}



  async getContestProbability(params: {
  contestId: string;
  customerId?: string | null;
  instaUserId?: string | null;
}) {
  const { contestId, customerId, instaUserId } = params;

  if (!contestId || (!customerId && !instaUserId)) {
    return null;
  }

  let query = this.supabase
    .from('customer_contest_participation_view')
    .select('probability_of_winning, contest_id, customer_id, insta_user_id')
    .eq('contest_id', contestId)
    .limit(1);

  // ✅ OR logic when both identifiers exist
  if (customerId && instaUserId) {
    query = query.or(
      `customer_id.eq.${customerId},insta_user_id.eq.${instaUserId}`
    );
  } 
  else if (customerId) {
    query = query.eq('customer_id', customerId);
  } 
  else {
    query = query.eq('insta_user_id', instaUserId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    // console.error('Error fetching probability:', error);
    return null;
  }

  return data;
}


   async getBrandUser(userId: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)

       if (error) {
      // console.error('Supabase error:', error);
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

  async getContestInstaId(insta_user_ig: string) {
    const { data, error } = await this.supabase.from('insta_user_on_contest')
      .select(`id, insta_user, username, contest_id`)
      .eq('id', insta_user_ig)
      .single();
    if (error) {
      console.error('Error fetching contest by ID:', error);
      return null;
    }
    return data;
  }



  async validateAndUpdateInstaUser(insta_user_ig: string, profile?: any) {
  try {
    const contestUser = await this.getContestInstaId(insta_user_ig);

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
async updateInstaUsersTable(insta_userID: string, customerId: string) {
  // Fetch existing insta_users row
  const { data, error: fetchError } = await this.supabase
    .from('insta_users')
    .select('customer_id, identified')
    .eq('uuid', insta_userID)
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
    .eq('uuid', insta_userID);

  if (error) {
    console.error('Error updating insta_users table:', error);
  }

  return error;
}

// Check & Insert customer/instgram users into customers_on_store table only once
async addUserToStore(params: {
  customerId?: string | null;
  instaUserId?: string | null;
  storeId: string;
}) {
  const { customerId, instaUserId, storeId } = params;

  if (!storeId || (!customerId && !instaUserId)) {
    throw new Error('Missing storeId or user identifier');
  }

  /* -------------------------------------------------
     🔐 LOGGED-IN USER FLOW
  ------------------------------------------------- */
  if (customerId) {

    // 1️⃣ insta_user_id + store_id → UPDATE customer_id
    if (instaUserId) {
      const { data: instaRow } = await this.supabase
        .from('customers_on_store')
        .select('*')
        .eq('insta_user_id', instaUserId)
        .eq('store_id', storeId)
        .maybeSingle();

      if (instaRow) {
        const { data, error } = await this.supabase
          .from('customers_on_store')
          .update({ customer_id: customerId })
          .eq('id', instaRow.id)
          .select()
          .single();

        if (error) throw error;

        return {
          action: 'updated_customer_id',
          data
        };
      }
    }

    // 2️⃣ customer_id + store_id → UPDATE insta_user_id
    const { data: customerRow } = await this.supabase
      .from('customers_on_store')
      .select('*')
      .eq('customer_id', customerId)
      .eq('store_id', storeId)
      .maybeSingle();

    if (customerRow) {
      if (instaUserId) {
        const { data, error } = await this.supabase
          .from('customers_on_store')
          .update({ insta_user_id: instaUserId })
          .eq('id', customerRow.id)
          .select()
          .single();

        if (error) throw error;

        return {
          action: 'updated_insta_user_id',
          data
        };
      }

      return {
        action: 'already_linked',
        data: customerRow
      };
    }

    // 3️⃣ INSERT
    const { data, error } = await this.supabase
      .from('customers_on_store')
      .insert({
        store_id: storeId,
        customer_id: customerId,
        insta_user_id: instaUserId ?? null
      })
      .select()
      .single();

    if (error) throw error;

    return {
      action: 'inserted_logged_in',
      data
    };
  }

  /* -------------------------------------------------
     👤 NOT LOGGED-IN USER FLOW
  ------------------------------------------------- */
  if (instaUserId) {
    // 4️⃣ insta_user_id + store_id → DO NOTHING
    const { data: instaRow } = await this.supabase
      .from('customers_on_store')
      .select('*')
      .eq('insta_user_id', instaUserId)
      .eq('store_id', storeId)
      .maybeSingle();

    if (instaRow) {
      return {
        action: 'already_exists_non_logged_in',
        data: instaRow
      };
    }

    // 5️⃣ INSERT
    const { data, error } = await this.supabase
      .from('customers_on_store')
      .insert({
        store_id: storeId,
        insta_user_id: instaUserId,
        customer_id: null
      })
      .select()
      .single();

    if (error) throw error;

    return {
      action: 'inserted_non_logged_in',
      data
    };
  }

  throw new Error('Unhandled state');
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
async getInstaUserByUsername(username: string) {
    if (!username) return null;

    const { data, error } = await this.supabase
      .from('insta_users')
      .select('*')
      .eq('username', username.trim())
      .maybeSingle();

    if (error) {
      console.error('Error fetching insta user:', error);
      return null;
    }

    return data;
  }

  

}


