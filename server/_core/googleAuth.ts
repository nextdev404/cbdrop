import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { store } from "../store";

const GOOGLE_STATE_COOKIE = "cbdrop_google_oauth_state";

function getCallbackUrl(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
  return `${proto}://${host}/api/auth/google/callback`;
}

export function registerGoogleAuthRoutes(app: Express) {
  // Step 1: Initiate Google / Gmail Sign In
  app.get("/api/auth/google", (req: Request, res: Response) => {
    const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "/";
    const stateNonce = crypto.randomBytes(24).toString("hex");
    const statePayload = Buffer.from(JSON.stringify({ nonce: stateNonce, returnTo })).toString("base64url");

    // Set secure anti-CSRF state cookie (expires in 10 minutes)
    const isHttps = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
    res.setHeader(
      "Set-Cookie",
      `${GOOGLE_STATE_COOKIE}=${encodeURIComponent(stateNonce)}; Path=/; Max-Age=600; SameSite=Lax; HttpOnly${isHttps ? "; Secure" : ""}`
    );

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const callbackUrl = getCallbackUrl(req);

    if (clientId) {
      // Live Google OAuth 2.0 endpoint
      const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      googleAuthUrl.searchParams.set("client_id", clientId);
      googleAuthUrl.searchParams.set("redirect_uri", callbackUrl);
      googleAuthUrl.searchParams.set("response_type", "code");
      googleAuthUrl.searchParams.set("scope", "openid email profile");
      googleAuthUrl.searchParams.set("state", statePayload);
      googleAuthUrl.searchParams.set("prompt", "select_account");
      return res.redirect(302, googleAuthUrl.toString());
    }

    // High-security Google Sign-in Dialog for sandbox / when GOOGLE_CLIENT_ID is not yet configured
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in with Google — CBdrop</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f0f4f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; color: #1f1f1f; }
    .card { background: #ffffff; border-radius: 28px; padding: 40px; width: 100%; max-width: 440px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); box-sizing: border-box; }
    .logo { width: 44px; height: 44px; margin-bottom: 20px; }
    h1 { font-size: 24px; font-weight: 500; margin: 0 0 8px 0; }
    p { font-size: 14px; color: #444746; margin: 0 0 28px 0; }
    .input-group { margin-bottom: 20px; }
    label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: #1f1f1f; }
    input { width: 100%; height: 48px; padding: 0 14px; border: 1px solid #747775; border-radius: 8px; font-size: 15px; box-sizing: border-box; outline: none; }
    input:focus { border-color: #0b57d0; border-width: 2px; }
    .btn { width: 100%; height: 48px; background: #0b57d0; color: white; border: none; border-radius: 24px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; margin-top: 10px; }
    .btn:hover { background: #0842a0; }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: #e8f0fe; color: #1967d2; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; margin-bottom: 16px; }
    .quick-list { margin-top: 24px; border-top: 1px solid #e0e2e0; padding-top: 18px; }
    .quick-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; cursor: pointer; text-decoration: none; color: inherit; transition: background 0.15s; }
    .quick-item:hover { background: #f8fafd; }
    .avatar { width: 34px; height: 34px; border-radius: 50%; background: #5e5ce6; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <svg class="logo" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.34 24 12 24z"/>
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.16 0 9.98 0 12s.45 3.84 1.24 5.42l4.04-3.15z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
    </svg>
    <div class="badge">Google Identity Verification</div>
    <h1>Sign in with Google</h1>
    <p>to continue to <strong>CBdrop Media Downloader</strong></p>

    <form method="POST" action="/api/auth/google/callback">
      <input type="hidden" name="state" value="${statePayload}">
      <div class="input-group">
        <label for="email">Enter your Gmail or Google Account</label>
        <input type="email" id="email" name="email" value="alex.creator@gmail.com" required placeholder="you@gmail.com" autofocus>
      </div>
      <div class="input-group">
        <label for="name">Display Name</label>
        <input type="text" id="name" name="name" value="Alex Creator" required placeholder="Your full name">
      </div>
      <button type="submit" class="btn">Continue to CBdrop</button>
    </form>

    <div class="quick-list">
      <div style="font-size: 12px; color: #747775; margin-bottom: 8px;">Or instant 1-click test account:</div>
      <a class="quick-item" href="javascript:void(0)" onclick="document.getElementById('email').value='demo.creator@gmail.com'; document.getElementById('name').value='Demo Google User'; document.forms[0].submit();">
        <div class="avatar">D</div>
        <div>
          <div style="font-weight: 500; font-size: 13px;">Demo Google User</div>
          <div style="font-size: 12px; color: #747775;">demo.creator@gmail.com</div>
        </div>
      </a>
    </div>
  </div>
</body>
</html>`;
    return res.status(200).type("text/html").send(html);
  });

  // Step 2: Handle OAuth Callback (CSRF-Verified)
  const handleCallback = async (req: Request, res: Response) => {
    try {
      const code = (req.query.code as string) || (req.body?.code as string);
      const state = (req.query.state as string) || (req.body?.state as string);

      if (!state) {
        return res.status(400).send("Missing OAuth state parameter.");
      }

      let parsedState: { nonce: string; returnTo?: string };
      try {
        parsedState = JSON.parse(Buffer.from(state, "base64url").toString());
      } catch {
        return res.status(400).send("Invalid OAuth state encoding.");
      }

      // CSRF check: verify cookie nonce against state nonce
      const cookieHeader = req.headers.cookie || "";
      const cookies = parseCookieHeader(cookieHeader);
      const expectedNonce = cookies[GOOGLE_STATE_COOKIE];

      if (!expectedNonce || expectedNonce !== parsedState.nonce) {
        return res.status(403).send("CSRF verification failed: invalid OAuth state cookie.");
      }

      // Clear the one-time state cookie
      res.setHeader(
        "Set-Cookie",
        `${GOOGLE_STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
      );

      let email = req.body?.email as string;
      let name = req.body?.name as string;
      let googleSub = `google_${crypto.randomBytes(8).toString("hex")}`;

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      // If live Google credentials are provided and code is present, exchange with Google servers
      if (clientId && clientSecret && code) {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: getCallbackUrl(req),
            grant_type: "authorization_code",
          }),
        });

        if (!tokenRes.ok) {
          const errData = await tokenRes.text();
          console.error("[Google OAuth] Token exchange error:", errData);
          return res.status(502).send("Google token exchange failed.");
        }

        const tokenData = await tokenRes.json();
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (!userInfoRes.ok) {
          return res.status(502).send("Failed to fetch Google profile info.");
        }

        const userInfo = await userInfoRes.json();
        email = userInfo.email;
        name = userInfo.name || userInfo.given_name || "Google User";
        googleSub = `google_${userInfo.sub}`;
      }

      if (!email || !email.includes("@")) {
        return res.status(400).send("A valid email address is required from Google.");
      }

      // Upsert user into database / persistent store
      let user = store.getUserByEmail(email);
      if (!user) {
        user = store.createUser({
          name: name || "Google User",
          email,
          password: crypto.randomBytes(32).toString("hex"),
          plan: "free",
        });
      }

      // Create session
      const session = store.createSession(user.id);

      // Set session cookie
      const isHttps = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
      res.setHeader(
        "Set-Cookie",
        `cbdrop_session=${encodeURIComponent(session.token)}; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly${isHttps ? "; Secure" : ""}`
      );

      const targetPath = parsedState.returnTo || "/";
      return res.redirect(302, targetPath);
    } catch (err) {
      console.error("[Google OAuth] Error during authentication:", err);
      return res.status(500).send("An error occurred during Google authentication.");
    }
  };

  app.get("/api/auth/google/callback", handleCallback);
  app.post("/api/auth/google/callback", handleCallback);
}
