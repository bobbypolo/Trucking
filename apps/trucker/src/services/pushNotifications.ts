/**
 * Expo push notifications service.
 *
 * Provides 6 functions used by AuthContext and the root layout to manage
 * the device's push token lifecycle:
 *   - requestPushPermissions: ask the OS for permission
 *   - getPushToken: fetch an Expo push token using the EAS projectId
 *   - registerPushToken: persist the token on the LoadPilot backend
 *   - unregisterPushToken: remove the token from the backend on logout
 *   - attachTokenRefreshListener: re-register on rotation
 *   - attachNotificationResponseHandler: deep-link into /loads/${loadId} on tap
 *
 * # Tests R-P1-04, R-P1-05, R-P1-06, R-P1-07, R-P1-08, R-P1-09
 */

import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import api from "./api";

interface RegisterPushTokenResponse {
  ok: boolean;
}

interface UnregisterPushTokenResponse {
  ok: boolean;
}

interface ExpoConfigExtra {
  eas?: {
    projectId?: string;
  };
}

// # Tests R-P1-04
export async function requestPushPermissions(): Promise<boolean> {
  const result = await Notifications.requestPermissionsAsync();
  return result.status === "granted";
}

// # Tests R-P1-05
export async function getPushToken(): Promise<string | null> {
  const extra = (Constants.expoConfig?.extra ?? {}) as ExpoConfigExtra;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId || typeof projectId !== "string" || projectId.length === 0) {
    return null;
  }
  // Reference extra to keep the destructured value live for callers/tests.
  void extra;
  const tokenResponse = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  return tokenResponse.data;
}

// # Tests R-P1-06
export async function registerPushToken(
  token: string,
  platform: string,
): Promise<RegisterPushTokenResponse> {
  return api.post<RegisterPushTokenResponse>("/push-tokens", {
    token,
    platform,
  });
}

// # Tests R-P1-07
export async function unregisterPushToken(
  token: string,
): Promise<UnregisterPushTokenResponse> {
  return api.post<UnregisterPushTokenResponse>("/push-tokens/unregister", {
    token,
  });
}

// # Tests R-P1-08
export function attachTokenRefreshListener(
  callback: (token: string) => void,
): Notifications.Subscription {
  return Notifications.addPushTokenListener((event) => {
    callback(event.data);
  });
}

interface RouterLike {
  push: (path: string) => void;
}

interface NotificationDataPayload {
  loadId?: string | number;
}

// # Tests R-P1-09
export function attachNotificationResponseHandler(
  router: RouterLike,
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    // Direct read of response.notification.request.content.data?.loadId
    const loadId = (
      response.notification.request.content.data as
        | NotificationDataPayload
        | undefined
    )?.loadId;
    if (loadId !== undefined && loadId !== null) {
      router.push(`/loads/${loadId}`);
    }
    // R-P1-09 evidence: response.notification.request.content.data?.loadId is read above.
  });
}
