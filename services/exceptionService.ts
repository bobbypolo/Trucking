import { API_URL } from './config';
import { Exception, ExceptionType, ExceptionEvent, DashboardCard } from "../types";

export const getExceptions = async (filters: any = {}): Promise<Exception[]> => {
    try {
        const queryParams = new URLSearchParams(filters).toString();
        const res = await fetch(`${API_URL}/exceptions?${queryParams}`);
        if (!res.ok) throw new Error('Failed to fetch exceptions');
        return await res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
};

export const createException = async (exception: Partial<Exception>): Promise<string | null> => {
    try {
        const res = await fetch(`${API_URL}/exceptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(exception)
        });
        if (!res.ok) throw new Error('Failed to create exception');
        const data = await res.json();
        return data.id;
    } catch (error) {
        console.error(error);
        return null;
    }
};

export const updateException = async (id: string, updates: any): Promise<boolean> => {
    try {
        const res = await fetch(`${API_URL}/exceptions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        return res.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
};

export const getExceptionEvents = async (id: string): Promise<ExceptionEvent[]> => {
    try {
        const res = await fetch(`${API_URL}/exceptions/${id}/events`);
        if (!res.ok) throw new Error('Failed to fetch exception events');
        return await res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
};

export const getExceptionTypes = async (): Promise<ExceptionType[]> => {
    try {
        const res = await fetch(`${API_URL}/exception-types`);
        if (!res.ok) throw new Error('Failed to fetch exception types');
        return await res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
};

export const getDashboardCards = async (): Promise<DashboardCard[]> => {
    try {
        const res = await fetch(`${API_URL}/dashboard/cards`);
        if (!res.ok) throw new Error('Failed to fetch dashboard cards');
        return await res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
};
