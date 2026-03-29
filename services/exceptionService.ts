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
  const queryParams = new URLSearchParams(filters).toString();
  return await api.get(`/exceptions?${queryParams}`);
};

export const createException = async (
  exception: Partial<Exception>,
): Promise<string> => {
  const data = await api.post("/exceptions", exception);
  return data.id;
};

export const updateException = async (
  id: string,
  updates: any,
): Promise<boolean> => {
  await api.patch(`/exceptions/${id}`, updates);
  return true;
};

export const getExceptionEvents = async (
  id: string,
): Promise<ExceptionEvent[]> => {
  return await api.get(`/exceptions/${id}/events`);
};

export const getExceptionTypes = async (): Promise<ExceptionType[]> => {
  return await api.get("/exception-types");
};

export const getDashboardCards = async (): Promise<DashboardCard[]> => {
  return await api.get("/dashboard/cards");
};
