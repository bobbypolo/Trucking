/**
 * Call Sessions domain -- API-backed CRUD.
 * Owner: STORY-016 (Phase 2 migration to server complete).
 */
import { CallSession, RecordLink, EntityType } from "../../types";
import { v4 as uuidv4 } from "uuid";
import { api, apiFetch } from "../api";

export const getRawCalls = async (): Promise<CallSession[]> => {
  try {
    const data = await api.get("/call-sessions");
    return ((data?.sessions as any[]) || []).map((s: any) => ({
      id: s.id,
      startTime: s.start_time,
      endTime: s.end_time,
      durationSeconds: s.duration_seconds,
      status: s.status,
      assignedTo: s.assigned_to,
      team: s.team,
      notes: s.notes,
      participants: s.participants || [],
      links: s.links || [],
      lastActivityAt: s.last_activity_at || s.start_time,
    }));
  } catch (e) {
    console.warn("[calls] getRawCalls API error:", e);
    return [];
  }
};

export const saveCallSession = async (session: CallSession): Promise<void> => {
  const body = {
    start_time: session.startTime,
    end_time: session.endTime,
    duration_seconds: session.durationSeconds,
    status: session.status,
    assigned_to: session.assignedTo,
    team: session.team,
    notes: session.notes,
    participants: session.participants,
    links: session.links,
  };

  // Try PUT first; fall back to POST for new sessions
  try {
    await apiFetch(`/call-sessions/${session.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  } catch {
    await api.post("/call-sessions", { ...body, id: session.id });
  }
};

export const attachToRecord = async (
  callId: string,
  entityType: string,
  entityId: string,
  actorName: string,
): Promise<CallSession | null> => {
  const sessions = await getRawCalls();
  const session = sessions.find((s) => s.id === callId);
  if (!session) return null;

  const newLink: RecordLink = {
    id: uuidv4(),
    entityType: entityType as any,
    entityId,
    isPrimary: session.links.length === 0,
    createdAt: new Date().toISOString(),
    createdBy: actorName,
  };
  const updated: CallSession = {
    ...session,
    links: [...session.links, newLink],
  };
  await saveCallSession(updated);
  return updated;
};

export const linkSessionToRecord = async (
  sessionId: string,
  recordId: string,
  recordType: EntityType,
): Promise<void> => {
  const sessions = await getRawCalls();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;

  const link: RecordLink = {
    id: uuidv4(),
    entityType: recordType,
    entityId: recordId,
    isPrimary: true,
    createdAt: new Date().toISOString(),
    createdBy: "SYSTEM",
  };
  const updated: CallSession = {
    ...session,
    links: [...(session.links || []), link],
  };
  await saveCallSession(updated);
};
