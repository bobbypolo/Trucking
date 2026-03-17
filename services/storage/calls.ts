/**
 * Call Sessions domain — localStorage CRUD.
 * Owner: STORY-016 (Phase 2 migration to server).
 */
import { CallSession, RecordLink, EntityType } from "../../types";
import { v4 as uuidv4 } from "uuid";
import { getTenantKey } from "./core";

export const STORAGE_KEY_CALLS = (): string => getTenantKey("calls_v1");

export const getRawCalls = (): CallSession[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_CALLS());
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveCallSession = async (session: CallSession) => {
  const sessions = getRawCalls();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.unshift(session);
  localStorage.setItem(STORAGE_KEY_CALLS(), JSON.stringify(sessions));
};

export const attachToRecord = async (
  callId: string,
  entityType: string,
  entityId: string,
  actorName: string,
) => {
  const sessions = getRawCalls();
  const idx = sessions.findIndex((s) => s.id === callId);
  if (idx >= 0) {
    const session = sessions[idx];
    const newLink: RecordLink = {
      id: uuidv4(),
      entityType: entityType as any,
      entityId,
      isPrimary: session.links.length === 0,
      createdAt: new Date().toISOString(),
      createdBy: actorName,
    };
    session.links.push(newLink);
    localStorage.setItem(STORAGE_KEY_CALLS(), JSON.stringify(sessions));
    return session;
  }
  return null;
};

export const linkSessionToRecord = async (
  sessionId: string,
  recordId: string,
  recordType: EntityType,
) => {
  const data = localStorage.getItem(STORAGE_KEY_CALLS());
  if (!data) return;
  let sessions: CallSession[] = JSON.parse(data);
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx >= 0) {
    const link: RecordLink = {
      id: uuidv4(),
      entityType: recordType,
      entityId: recordId,
      isPrimary: true,
      createdAt: new Date().toISOString(),
      createdBy: "SYSTEM",
    };
    sessions[idx].links = [...(sessions[idx].links || []), link];
    localStorage.setItem(STORAGE_KEY_CALLS(), JSON.stringify(sessions));
  }
};
