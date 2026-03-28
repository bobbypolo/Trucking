import { api } from "./api";
import {
  Exception,
  ExceptionType,
  ExceptionEvent,
  DashboardCard,
} from "../types";

export const getExceptions = async (
  filters: any = {},
): Promise<Exception[]> => {
  try {
    const queryParams = new URLSearchParams(filters).toString();
    return await api.get(`/exceptions?${queryParams}`);
  } catch (error) {
    return [];
  }
};

export const createException = async (
  exception: Partial<Exception>,
): Promise<string | null> => {
  try {
    const data = await api.post("/exceptions", exception);
    return data.id;
  } catch (error) {
    return null;
  }
};

export const updateException = async (
  id: string,
  updates: any,
): Promise<boolean> => {
  try {
    await api.patch(`/exceptions/${id}`, updates);
    return true;
  } catch (error) {
    return false;
  }
};

export const getExceptionEvents = async (
  id: string,
): Promise<ExceptionEvent[]> => {
  try {
    return await api.get(`/exceptions/${id}/events`);
  } catch (error) {
    return [];
  }
};

export const getExceptionTypes = async (): Promise<ExceptionType[]> => {
  try {
    return await api.get("/exception-types");
  } catch (error) {
    return [];
  }
};

export const getDashboardCards = async (): Promise<DashboardCard[]> => {
  try {
    return await api.get("/dashboard/cards");
  } catch (error) {
    return [];
  }
};
