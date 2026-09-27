function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function derivePasswordHash(password, saltBytes) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations: 210000
    },
    key,
    256
  );

  return bytesToBase64(new Uint8Array(bits));
}

async function createPasswordRecord(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt);
  return {
    passwordHash: hash,
    passwordSalt: bytesToBase64(salt)
  };
}

async function verifyPassword(password, expectedHash, saltBase64) {
  const actual = await derivePasswordHash(password, base64ToBytes(saltBase64));
  const a = new TextEncoder().encode(actual);
  const b = new TextEncoder().encode(expectedHash);

  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function parseCookies(request) {
  const raw = request.headers.get("cookie") || "";
  const result = {};
  for (const pair of raw.split(";")) {
    const index = pair.indexOf("=");
    if (index < 0) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

function sessionCookie(token, maxAge = 60 * 60 * 24 * 7) {
  return [
    `dmi_session=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict"
  ].join("; ");
}

function clearSessionCookie() {
  return [
    "dmi_session=",
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "Secure",
    "SameSite=Strict"
  ].join("; ");
}

async function getCurrentAdmin(request, env) {
  const token = parseCookies(request).dmi_session;
  if (!token) return null;

  const tokenHash = await sha256Hex(token);

  return await env.DB.prepare(`
    SELECT
      u.id,
      u.email,
      u.display_name,
      u.role,
      s.id AS session_id,
      s.expires_at
    FROM admin_sessions s
    JOIN admin_users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND u.active = 1
      AND datetime(s.expires_at) > datetime('now')
    LIMIT 1
  `).bind(tokenHash).first();
}

function setupPage() {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Digital Media Indonesia — Admin Setup</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#f5f5f7;color:#111;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}
  .card{width:min(460px,100%);background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:28px;padding:34px;box-shadow:0 20px 60px rgba(0,0,0,.08)}
  h1{margin:8px 0 8px;font-size:34px;letter-spacing:-.04em}
  p{color:#6e6e73;line-height:1.55}
  label{display:block;font-size:13px;color:#555;margin:14px 0 7px}
  input{width:100%;padding:13px;border:1px solid rgba(0,0,0,.12);border-radius:12px;font:inherit}
  button{width:100%;margin-top:18px;border:0;border-radius:12px;padding:13px;background:#111;color:#fff;font:inherit;font-weight:600;cursor:pointer}
  #msg{margin-top:14px;font-size:13px;white-space:pre-wrap}
  .brand{font-weight:750;letter-spacing:-.03em}
</style>
</head>
<body>
<div class="card">
  <div class="brand">Digital Media Indonesia</div>
  <h1>Admin Setup</h1>
  <p>Buat akun Super Admin pertama. Halaman setup akan terkunci setelah akun pertama berhasil dibuat.</p>

  <form id="setupForm">
    <label>Setup Token</label>
    <input id="token" type="password" autocomplete="off" required>

    <label>Nama Admin</label>
    <input id="name" autocomplete="name" required>

    <label>Email</label>
    <input id="email" type="email" autocomplete="email" required>

    <label>Password</label>
    <input id="password" type="password" autocomplete="new-password" minlength="12" required>

    <label>Konfirmasi Password</label>
    <input id="confirmPassword" type="password" autocomplete="new-password" minlength="12" required>

    <button type="submit">Create Super Admin</button>
  </form>
  <div id="msg"></div>
</div>

<script>
const form=document.getElementById("setupForm");
const msg=document.getElementById("msg");

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  msg.textContent="Creating admin account...";

  const password=document.getElementById("password").value;
  const confirmPassword=document.getElementById("confirmPassword").value;

  if(password!==confirmPassword){
    msg.textContent="Password confirmation does not match.";
    return;
  }

  const res=await fetch("/api/admin/setup",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      setupToken:document.getElementById("token").value,
      displayName:document.getElementById("name").value,
      email:document.getElementById("email").value,
      password
    })
  });

  const data=await res.json().catch(()=>({}));
  if(!res.ok){
    msg.textContent=data.error || "Setup failed.";
    return;
  }

  msg.textContent="Super Admin created successfully. You can now open /admin/login";
  form.reset();
});
</script>
</body>
</html>`;
}

function loginPage() {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Digital Media Indonesia — Admin Login</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#f5f5f7;color:#111;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}
  .card{width:min(430px,100%);background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:28px;padding:34px;box-shadow:0 20px 60px rgba(0,0,0,.08)}
  h1{margin:8px 0 8px;font-size:34px;letter-spacing:-.04em}
  p{color:#6e6e73;line-height:1.55}
  label{display:block;font-size:13px;color:#555;margin:14px 0 7px}
  input{width:100%;padding:13px;border:1px solid rgba(0,0,0,.12);border-radius:12px;font:inherit}
  button{width:100%;margin-top:18px;border:0;border-radius:12px;padding:13px;background:#111;color:#fff;font:inherit;font-weight:600;cursor:pointer}
  #msg{margin-top:14px;font-size:13px}
  .brand{font-weight:750;letter-spacing:-.03em}
</style>
</head>
<body>
<div class="card">
  <div class="brand">Digital Media Indonesia</div>
  <h1>Admin Login</h1>
  <p>Masuk menggunakan akun Admin Digital Media Indonesia.</p>
  <form id="loginForm">
    <label>Email</label>
    <input id="email" type="email" autocomplete="email" required>
    <label>Password</label>
    <input id="password" type="password" autocomplete="current-password" required>
    <button type="submit">Sign In</button>
  </form>
  <div id="msg"></div>
</div>

<script>
const form=document.getElementById("loginForm");
const msg=document.getElementById("msg");

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  msg.textContent="Signing in...";

  const res=await fetch("/api/admin/login",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      email:document.getElementById("email").value,
      password:document.getElementById("password").value
    })
  });

  const data=await res.json().catch(()=>({}));
  if(!res.ok){
    msg.textContent=data.error || "Login failed.";
    return;
  }

  msg.textContent="Login successful.";
  location.href="/api/admin/me";
});
</script>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      // ---------- PUBLIC READ API ----------
      if (url.pathname === "/api/health") {
        const row = await env.DB.prepare("SELECT 1 AS ok").first();
        return json({
          status: "ok",
          database: row?.ok === 1 ? "connected" : "unknown",
          service: "Digital Media Indonesia API"
        });
      }

      if (url.pathname === "/api/products" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT id, slug, name_id, name_en, group_key, sort_order, active
          FROM products
          WHERE active = 1
          ORDER BY sort_order ASC, name_id ASC
        `).all();
        return json(result.results || []);
      }

      if (url.pathname === "/api/services" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT id, slug, tag_id, tag_en, title_id, title_en,
                 description_id, description_en, footer_id, footer_en,
                 background_url, sort_order, active
          FROM services
          WHERE active = 1
          ORDER BY sort_order ASC, title_id ASC
        `).all();
        return json(result.results || []);
      }

      if (url.pathname === "/api/projects" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT p.*,
                 pr.name_id AS product_name_id,
                 pr.name_en AS product_name_en,
                 pr.group_key AS product_group
          FROM projects p
          LEFT JOIN products pr ON pr.id = p.product_id
          WHERE p.status = 'published'
          ORDER BY p.featured DESC, p.sort_order ASC, p.year DESC, p.created_at DESC
        `).all();
        return json(result.results || []);
      }

      if (url.pathname === "/api/partners" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT id, name, logo_url, website_url, sort_order, active
          FROM partners
          WHERE active = 1
          ORDER BY sort_order ASC, name ASC
        `).all();
        return json(result.results || []);
      }

      if (url.pathname === "/api/settings" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT setting_key, value_id, value_en, value_json
          FROM site_settings
          ORDER BY setting_key ASC
        `).all();
        return json(result.results || []);
      }

      // ---------- ADMIN SETUP ----------
      if (url.pathname === "/admin/setup" && request.method === "GET") {
        const existing = await env.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM admin_users
          WHERE active = 1
        `).first();

        if (Number(existing?.count || 0) > 0) {
          return html(`<!doctype html><meta charset="utf-8"><title>Setup Locked</title>
          <body style="font-family:system-ui;padding:40px">
          <h2>Admin setup is locked.</h2>
          <p>An active admin account already exists.</p>
          <p><a href="/admin/login">Go to Admin Login</a></p>
          </body>`, 403);
        }

        return html(setupPage());
      }

      if (url.pathname === "/api/admin/setup" && request.method === "POST") {
        if (!env.ADMIN_SETUP_TOKEN) {
          return json({ error: "ADMIN_SETUP_TOKEN is not configured." }, 500);
        }

        const existing = await env.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM admin_users
          WHERE active = 1
        `).first();

        if (Number(existing?.count || 0) > 0) {
          return json({ error: "Admin setup is already locked." }, 409);
        }

        const body = await request.json().catch(() => ({}));
        const setupToken = String(body.setupToken || "");
        const displayName = String(body.displayName || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (setupToken !== env.ADMIN_SETUP_TOKEN) {
          return json({ error: "Invalid setup token." }, 403);
        }

        if (!displayName || !email || !password) {
          return json({ error: "Name, email, and password are required." }, 400);
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return json({ error: "Invalid email address." }, 400);
        }

        if (password.length < 12) {
          return json({ error: "Password must be at least 12 characters." }, 400);
        }

        const { passwordHash, passwordSalt } = await createPasswordRecord(password);
        const id = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO admin_users
          (id, email, display_name, password_hash, password_salt, role, active)
          VALUES (?, ?, ?, ?, ?, 'super_admin', 1)
        `).bind(
          id,
          email,
          displayName,
          passwordHash,
          passwordSalt
        ).run();

        return json({
          status: "ok",
          message: "Super Admin created.",
          user: {
            id,
            email,
            displayName,
            role: "super_admin"
          }
        }, 201);
      }

      // ---------- ADMIN LOGIN ----------
      if (url.pathname === "/admin/login" && request.method === "GET") {
        return html(loginPage());
      }

      if (url.pathname === "/api/admin/login" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!email || !password) {
          return json({ error: "Email and password are required." }, 400);
        }

        const user = await env.DB.prepare(`
          SELECT id, email, display_name, password_hash, password_salt, role
          FROM admin_users
          WHERE email = ?
            AND active = 1
          LIMIT 1
        `).bind(email).first();

        if (!user) {
          return json({ error: "Invalid email or password." }, 401);
        }

        const valid = await verifyPassword(
          password,
          user.password_hash,
          user.password_salt
        );

        if (!valid) {
          return json({ error: "Invalid email or password." }, 401);
        }

        const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
        const token = bytesToBase64(tokenBytes);
        const tokenHash = await sha256Hex(token);
        const sessionId = crypto.randomUUID();

        await env.DB.prepare(`
          DELETE FROM admin_sessions
          WHERE datetime(expires_at) <= datetime('now')
        `).run();

        await env.DB.prepare(`
          INSERT INTO admin_sessions
          (id, user_id, token_hash, expires_at)
          VALUES (?, ?, ?, datetime('now', '+7 days'))
        `).bind(
          sessionId,
          user.id,
          tokenHash
        ).run();

        return json({
          status: "ok",
          user: {
            id: user.id,
            email: user.email,
            displayName: user.display_name,
            role: user.role
          }
        }, 200, {
          "set-cookie": sessionCookie(token)
        });
      }

      // ---------- ADMIN SESSION ----------
      if (url.pathname === "/api/admin/me" && request.method === "GET") {
        const admin = await getCurrentAdmin(request, env);

        if (!admin) {
          return json({ authenticated: false }, 401);
        }

        return json({
          authenticated: true,
          user: {
            id: admin.id,
            email: admin.email,
            displayName: admin.display_name,
            role: admin.role
          },
          expiresAt: admin.expires_at
        });
      }

      if (url.pathname === "/api/admin/logout" && request.method === "POST") {
        const token = parseCookies(request).dmi_session;

        if (token) {
          const tokenHash = await sha256Hex(token);
          await env.DB.prepare(`
            DELETE FROM admin_sessions
            WHERE token_hash = ?
          `).bind(tokenHash).run();
        }

        return json({
          status: "ok",
          message: "Logged out."
        }, 200, {
          "set-cookie": clearSessionCookie()
        });
      }

      if (url.pathname === "/api/admin/ping" && request.method === "GET") {
        const admin = await getCurrentAdmin(request, env);

        if (!admin) {
          return json({ error: "Unauthorized." }, 401);
        }

        return json({
          status: "ok",
          message: "Protected admin route is working.",
          admin: {
            email: admin.email,
            role: admin.role
          }
        });
      }

      return json({ error: "API route not found" }, 404);

    } catch (error) {
      console.error(error);

      return json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  }
};
