import { API_URL } from './config';

import { getIdTokenAsync } from './authService';

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const token = await getIdTokenAsync();

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API Request failed: ${response.status}`);
    }

    return response.json();
};

export const api = {
    get: (endpoint: string) => apiFetch(endpoint, { method: 'GET' }),
    post: (endpoint: string, body: any) => apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    }),
    patch: (endpoint: string, body: any) => apiFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body)
    }),
    delete: (endpoint: string) => apiFetch(endpoint, { method: 'DELETE' }),
};
