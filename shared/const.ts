export const COOKIE_NAME = "cbdrop_session";
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export const OAUTH_STATE_COOKIE = "cbdrop_oauth_state";
export const UNAUTHED_ERR_MSG = "Unauthorized";

export function encodeOAuthState(data: { redirectUri: string; nonce: string }): string {
  const json = JSON.stringify(data);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json).toString("base64url");
  }
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeOAuthState(state: string): { redirectUri?: string; nonce?: string } {
  try {
    if (typeof Buffer !== "undefined") {
      return JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    }
    const base64 = state.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(base64)));
    return JSON.parse(json);
  } catch {
    return {};
  }
}

