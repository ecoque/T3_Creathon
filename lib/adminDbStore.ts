import { create } from 'zustand';

import { initialEventSettings } from '../constants/adminMockData';
import type {
  AdminAnnouncement,
  AdminAttendee,
  AdminBooth,
  AdminLogItem,
  AdminMeetingRecord,
  AdminSession,
  AdminStage,
  EventSettings,
  SessionStatus,
  ZoneDensityInfo,
} from '../types/admin';
import { adminRepository, type AdminWorkspaceData } from './adminRepository';

type AdminWorkspaceState = AdminWorkspaceData & {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  isMutating: boolean;
  hydrate: () => Promise<void>;
  clearError: () => void;
  saveSession: (data: Partial<AdminSession>, publish: boolean, editingId?: string) => Promise<boolean>;
  deleteSession: (id: string) => Promise<boolean>;
  delaySession: (id: string, minutes: number) => Promise<boolean>;
  changeSessionStage: (id: string, stageId: string) => Promise<boolean>;
  updateSessionStatus: (id: string, status: SessionStatus) => Promise<boolean>;
  saveStage: (data: Partial<AdminStage>, editingId?: string) => Promise<boolean>;
  deleteStage: (id: string) => Promise<boolean>;
  updateStagePosition: (id: string, mapX: number, mapY: number) => Promise<boolean>;
  unplaceStage: (stageId: string) => Promise<boolean>;
  saveZone: (data: Partial<ZoneDensityInfo>, editingId?: string) => Promise<boolean>;
  deleteZone: (id: string) => Promise<boolean>;
  saveBooth: (data: Partial<AdminBooth>, editingId?: string) => Promise<boolean>;
  deleteBooth: (id: string) => Promise<boolean>;
  toggleBoothStatus: (id: string) => Promise<boolean>;
  updateBoothCoordinates: (id: string, x: number, y: number) => Promise<boolean>;
  placeBooth: (boothId: string, mapX: number, mapY: number) => Promise<boolean>;
  unplaceBooth: (boothId: string) => Promise<boolean>;
  saveAttendee: (data: Partial<AdminAttendee>, editingId?: string) => Promise<boolean>;
  deleteAttendee: (id: string) => Promise<boolean>;
  toggleAttendeeStatus: (id: string) => Promise<boolean>;
  publishAnnouncement: (data: Partial<AdminAnnouncement>, scheduled: boolean) => Promise<boolean>;
  deleteAnnouncement: (id: string) => Promise<boolean>;
  saveSettings: (data: Partial<EventSettings>) => Promise<boolean>;
  uploadFloorPlan: (base64: string, mimeType?: string) => Promise<boolean>;
  resetDemoData: () => Promise<void>;
};

const emptyData: AdminWorkspaceData = {
  sessions: [],
  stages: [],
  booths: [],
  zones: [],
  attendees: [],
  announcements: [],
  meetings: [] as AdminMeetingRecord[],
  logs: [] as AdminLogItem[],
  settings: initialEventSettings as EventSettings,
};

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Admin veritabanı işlemi başarısız oldu.';
}

export const useAdminStore = create<AdminWorkspaceState>((set, get) => {
  async function load(showLoading: boolean) {
    if (showLoading) set({ status: 'loading', error: null });
    try {
      const data = await adminRepository.fetch();
      set({ ...data, status: 'ready', error: null });
    } catch (error) {
      set({ status: 'error', error: messageOf(error) });
      throw error;
    }
  }

  async function mutate(operation: () => Promise<void>) {
    set({ isMutating: true, error: null });
    try {
      await operation();
      await load(false);
      return true;
    } catch (error) {
      const operationError = messageOf(error);
      try {
        await load(false);
      } catch {
        // Keep the original mutation/audit failure as the actionable message.
      }
      set({ error: operationError });
      return false;
    } finally {
      set({ isMutating: false });
    }
  }

  return {
    ...emptyData,
    status: 'idle',
    error: null,
    isMutating: false,

    hydrate: async () => {
      try {
        await load(true);
      } catch {
        // AdminWorkspace renders the database error and retry action.
      }
    },
    clearError: () => set({ error: null }),

    saveSession: (data, publish, editingId) =>
      mutate(async () => {
        const stage = get().stages.find((item) => item.id === data.stageId);
        const current = editingId ? get().sessions.find((item) => item.id === editingId) : undefined;
        await adminRepository.saveSession(
          { ...current, ...data, stageName: stage?.name || data.stageName || current?.stageName },
          publish,
          editingId,
          get().settings.startDate,
        );
      }),
    deleteSession: (id) => mutate(() => adminRepository.deleteSession(id)),
    delaySession: (id, minutes) =>
      mutate(async () => {
        const session = get().sessions.find((item) => item.id === id);
        await adminRepository.updateSession(id, {
          delay_minutes: (session?.delayMinutes || 0) + minutes,
          status: 'delayed',
        });
      }),
    changeSessionStage: (id, stageId) =>
      mutate(async () => {
        const stage = get().stages.find((item) => item.id === stageId);
        await adminRepository.updateSession(id, { stage_id: stageId, location: stage?.name || null });
      }),
    updateSessionStatus: (id, status) => mutate(() => adminRepository.updateSession(id, { status })),

    saveStage: (data, editingId) =>
      mutate(() => {
        const current = editingId ? get().stages.find((item) => item.id === editingId) : undefined;
        return adminRepository.saveStage({ ...current, ...data }, get().zones, editingId);
      }),
    deleteStage: (id) => mutate(() => adminRepository.deleteStage(id)),
    updateStagePosition: (id, mapX, mapY) =>
      mutate(() => adminRepository.updateStagePosition(id, mapX, mapY, get().zones)),
    unplaceStage: (stageId) => mutate(() => adminRepository.unplaceStage(stageId, get().stages)),

    saveZone: (data, editingId) =>
      mutate(() => {
        const current = editingId ? get().zones.find((item) => item.id === editingId) : undefined;
        return adminRepository.saveZone({ ...current, ...data }, editingId);
      }),
    deleteZone: (id) => mutate(() => adminRepository.deleteZone(id)),

    saveBooth: (data, editingId) =>
      mutate(async () => {
        const current = editingId ? get().booths.find((item) => item.id === editingId) : undefined;
        await adminRepository.saveBooth({ ...current, ...data }, get().zones, editingId);
      }),
    deleteBooth: (id) => mutate(() => adminRepository.deleteBooth(id)),
    toggleBoothStatus: (id) =>
      mutate(async () => {
        const booth = get().booths.find((item) => item.id === id);
        if (!booth) throw new Error('Stand bulunamadı.');
        await adminRepository.updateBooth(id, { status: booth.status === 'active' ? 'passive' : 'active' });
      }),
    updateBoothCoordinates: (id, x, y) =>
      mutate(() => adminRepository.updateBooth(id, { map_x: x, map_y: y })),
    placeBooth: (boothId, mapX, mapY) =>
      mutate(() => adminRepository.placeBooth(boothId, mapX, mapY, get().booths, get().zones)),
    unplaceBooth: (boothId) => mutate(() => adminRepository.unplaceBooth(boothId, get().booths)),

    saveAttendee: (data, editingId) =>
      mutate(async () => {
        const current = editingId ? get().attendees.find((item) => item.id === editingId) : undefined;
        await adminRepository.saveAttendee({ ...current, ...data }, editingId, current);
      }),
    deleteAttendee: (id) => mutate(() => adminRepository.deleteAttendee(id)),
    toggleAttendeeStatus: (id) =>
      mutate(async () => {
        const attendee = get().attendees.find((item) => item.id === id);
        if (!attendee) throw new Error('Katılımcı bulunamadı.');
        await adminRepository.saveAttendee(
          { ...attendee, status: attendee.status === 'active' ? 'passive' : 'active' },
          id,
          attendee,
        );
      }),

    publishAnnouncement: (data, scheduled) => mutate(() => adminRepository.publishAnnouncement(data, scheduled)),
    deleteAnnouncement: (id) => mutate(() => adminRepository.deleteAnnouncement(id)),
    saveSettings: (data) => mutate(() => adminRepository.saveSettings({ ...get().settings, ...data })),
    uploadFloorPlan: (base64, mimeType) =>
      mutate(async () => {
        const url = await adminRepository.uploadFloorPlanImage(base64, mimeType);
        await adminRepository.saveSettings({ ...get().settings, floorPlanUrl: url });
      }),

    resetDemoData: async () => {
      try {
        await load(true);
      } catch {
        // AdminWorkspace renders the retry state.
      }
    },
  };
});
