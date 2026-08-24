import { supabase } from './supabase';
import type {
  CorporateOpportunity,
  CorporateOpportunityStage,
  CorporateOpportunityStageHistory,
  Profile,
} from '../types';

const OPPORTUNITY_COLUMNS =
  'id,owner_user_id,target_profile_id,meeting_request_id,title,stage,next_action,next_action_at,private_notes,created_at,updated_at';

export type CorporateOpportunityItem = CorporateOpportunity & {
  targetProfile: Profile | null;
};

export type CorporateOpportunityInput = {
  targetProfileId: string;
  meetingRequestId: string | null;
  title: string;
  stage: CorporateOpportunityStage;
  nextAction: string | null;
  nextActionAt: string | null;
  privateNotes: string | null;
};

export class CorporateOpportunityConflictError extends Error {
  constructor() {
    super('A corporate opportunity already exists for this target.');
    this.name = 'CorporateOpportunityConflictError';
  }
}

export async function listCorporateOpportunities(ownerUserId: string): Promise<{
  items: CorporateOpportunityItem[];
  history: CorporateOpportunityStageHistory[];
}> {
  const { data, error } = await supabase
    .from('corporate_opportunities')
    .select(OPPORTUNITY_COLUMNS)
    .eq('owner_user_id', ownerUserId)
    .order('updated_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as CorporateOpportunity[];
  const targetIds = Array.from(new Set(rows.map((row) => row.target_profile_id)));
  let profilesById = new Map<string, Profile>();

  if (targetIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', targetIds);
    if (profilesError) throw profilesError;
    profilesById = new Map(((profiles ?? []) as Profile[]).map((profile) => [profile.id, profile]));
  }

  const { data: history, error: historyError } = await supabase
    .from('corporate_opportunity_stage_history')
    .select('id,opportunity_id,owner_user_id,from_stage,to_stage,changed_by_user_id,changed_at')
    .eq('owner_user_id', ownerUserId)
    .order('changed_at', { ascending: false });
  if (historyError) throw historyError;

  return {
    items: rows.map((row) => ({ ...row, targetProfile: profilesById.get(row.target_profile_id) ?? null })),
    history: (history ?? []) as CorporateOpportunityStageHistory[],
  };
}

export async function createCorporateOpportunity(
  ownerUserId: string,
  input: CorporateOpportunityInput,
): Promise<CorporateOpportunity> {
  const { data, error } = await supabase
    .from('corporate_opportunities')
    .insert({
      owner_user_id: ownerUserId,
      target_profile_id: input.targetProfileId,
      meeting_request_id: input.meetingRequestId,
      title: input.title.trim(),
      stage: input.stage,
      next_action: input.nextAction,
      next_action_at: input.nextActionAt,
      private_notes: input.privateNotes,
    })
    .select(OPPORTUNITY_COLUMNS)
    .single();

  if (error?.code === '23505') throw new CorporateOpportunityConflictError();
  if (error) throw error;
  return data as CorporateOpportunity;
}

export async function updateCorporateOpportunity(
  ownerUserId: string,
  opportunityId: string,
  input: CorporateOpportunityInput,
): Promise<CorporateOpportunity> {
  const { data, error } = await supabase
    .from('corporate_opportunities')
    .update({
      meeting_request_id: input.meetingRequestId,
      title: input.title.trim(),
      stage: input.stage,
      next_action: input.nextAction,
      next_action_at: input.nextActionAt,
      private_notes: input.privateNotes,
    })
    .eq('id', opportunityId)
    .eq('owner_user_id', ownerUserId)
    .select(OPPORTUNITY_COLUMNS)
    .single();
  if (error) throw error;
  return data as CorporateOpportunity;
}
