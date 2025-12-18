import { getPreferenceValues } from "@raycast/api";
import { useFetch } from "@raycast/utils";
import { URLSearchParams } from "url";
import { ListActivitiesResponse, ListSessionsResponse, ListSourcesResponse, Session } from "./types";

interface ExtensionPreferences {
  julesApiKey: string;
}

const { julesApiKey } = getPreferenceValues<ExtensionPreferences>();

const BASE_URL = "https://jules.googleapis.com/v1alpha";

function getHeaders() {
  return {
    "X-Goog-Api-Key": julesApiKey,
    "Content-Type": "application/json",
  };
}

// --- Sessions ---

export function useSessions(config?: { pageSize?: number }) {
  return useFetch(
    (options) => {
      const params = new URLSearchParams({
        pageSize: config?.pageSize?.toString() ?? "20",
      });

      if (options.cursor) {
        params.set("pageToken", options.cursor);
      }

      return `${BASE_URL}/sessions?${params.toString()}`;
    },
    {
      headers: getHeaders(),
      mapResult(result: ListSessionsResponse) {
        return {
          data: result.sessions || [],
          hasMore: !!result.nextPageToken,
          cursor: result.nextPageToken,
        };
      },
      keepPreviousData: true,
    },
  );
}

export async function createSession(session: Partial<Session>) {
  const response = await fetch(`${BASE_URL}/sessions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(session),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to create session: ${response.statusText} - ${errorBody}`);
  }

  return (await response.json()) as Session;
}

export function useSession(sessionId: string) {
  return useFetch<Session>(`${BASE_URL}/${sessionId}`, {
    headers: getHeaders(),
  });
}

// --- Activities ---

export function useSessionActivities(sessionId: string, config?: { pageSize?: number }) {
  return useFetch(
    (options) => {
      const params = new URLSearchParams({
        pageSize: config?.pageSize?.toString() ?? "50",
      });

      if (options.cursor) {
        params.set("pageToken", options.cursor);
      }

      return `${BASE_URL}/${sessionId}/activities?${params.toString()}`;
    },
    {
      headers: getHeaders(),
      mapResult(result: ListActivitiesResponse) {
        return {
          data: result.activities || [],
          hasMore: !!result.nextPageToken,
          cursor: result.nextPageToken,
        };
      },
      keepPreviousData: true,
    },
  );
}

export async function sendMessage(sessionId: string, prompt: string) {
  const response = await fetch(`${BASE_URL}/${sessionId}:sendMessage`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to send message: ${response.statusText} - ${errorBody}`);
  }

  // Response is empty definition for sendMessage
}

export async function approvePlan(sessionId: string) {
  const response = await fetch(`${BASE_URL}/${sessionId}:approvePlan`, {
    method: "POST",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to approve plan: ${response.statusText} - ${errorBody}`);
  }
}

// --- Sources ---

export function useSources(config?: { pageSize?: number }) {
  return useFetch(
    (options) => {
      const params = new URLSearchParams({
        pageSize: config?.pageSize?.toString() ?? "50",
      });
      if (options.cursor) {
        params.set("pageToken", options.cursor);
      }
      return `${BASE_URL}/sources?${params.toString()}`;
    },
    {
      headers: getHeaders(),
      mapResult(result: ListSourcesResponse) {
        return {
          data: result.sources || [],
          hasMore: !!result.nextPageToken,
          cursor: result.nextPageToken,
        };
      },
      keepPreviousData: true,
    },
  );
}
