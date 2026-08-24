import { supabase } from './supabase';

export type InvestorShortlistRow = {
  id: string;
  owner_user_id: string;
  profile_id: string;
  created_at: string;
};

export async function listInvestorShortlist(ownerUserId: string): Promise<InvestorShortlistRow[]> {
  const { data, error } = await supabase
    .from('investor_shortlists')
    .select('id,owner_user_id,profile_id,created_at')
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InvestorShortlistRow[];
}

export async function addInvestorShortlist(ownerUserId: string, profileId: string): Promise<void> {
  const { error } = await supabase.from('investor_shortlists').insert({
    owner_user_id: ownerUserId,
    profile_id: profileId,
  });
  if (error && error.code !== '23505') throw error;
}

export async function removeInvestorShortlist(ownerUserId: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from('investor_shortlists')
    .delete()
    .eq('owner_user_id', ownerUserId)
    .eq('profile_id', profileId);
  if (error) throw error;
}
