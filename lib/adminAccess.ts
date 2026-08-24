import { supabase } from './supabase';

export async function isAdminUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.is_admin === true;
}
