function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function accessEmail(request) {
  return (
    request.headers.get("Cf-Access-Authenticated-User-Email") ||
    request.headers.get("cf-access-authenticated-user-email") ||
    ""
  );
}

function adminLanding(email) {
  const safeEmail = String(email || "Authenticated user")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Digital Media Indonesia — Admin</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#f5f5f7;color:#111;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}
.card{width:min(520px,100%);background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:30px;padding:36px;box-shadow:0 22px 70px rgba(0,0,0,.08)}
.brand{font-weight:750;letter-spacing:-.03em}
h1{font-size:38px;letter-spacing:-.045em;margin:10px 0 12px}
p{color:#6e6e73;line-height:1.6}
.ok{margin:22px 0;padding:16px;border-radius:16px;background:#f2f8f3;border:1px solid #d7eadb}
.ok b{display:block;margin-bottom:5px;color:#176b31}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}
a{display:inline-flex;text-decoration:none;padding:12px 16px;border-radius:12px;border:1px solid rgba(0,0,0,.12);color:#111}
a.primary{background:#111;color:#fff;border-color:#111}
.small{font-size:12px;color:#86868b;margin-top:20px}
</style>
</head>
<body>
<div class="card">
  <div class="brand">Digital Media Indonesia</div>
  <h1>Admin Access</h1>
  <p>Autentikasi sekarang menggunakan Cloudflare Access. Login email/password lama sudah tidak digunakan.</p>

  <div class="ok">
    <b>✓ Cloudflare Access berhasil</b>
    <span>${safeEmail}</span>
  </div>

  <div class="actions">
    <a class="primary" href="/api/admin/me">Test Admin Session</a>
    <a href="/">Kembali ke Website</a>
  </div>

  <div class="small">Tahap berikutnya: dashboard CMS akan dipasang di area ini.</div>
</div>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      // ---------- PUBLIC API ----------
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

      // ---------- CLOUDFLARE ACCESS ADMIN ----------
      // These routes are protected by Cloudflare Access at the edge:
      // /admin/* and /api/admin/*

      if (
        (url.pathname === "/admin/login" ||
         url.pathname === "/admin/" ||
         url.pathname === "/admin") &&
        request.method === "GET"
      ) {
        return html(adminLanding(accessEmail(request)));
      }

      if (url.pathname === "/admin/setup" && request.method === "GET") {
        return Response.redirect(new URL("/admin/login", url.origin).toString(), 302);
      }

      if (url.pathname === "/api/admin/me" && request.method === "GET") {
        const email = accessEmail(request);

        return json({
          authenticated: true,
          provider: "Cloudflare Access",
          email: email || null,
          message: "Protected admin API is working."
        });
      }

      if (url.pathname === "/api/admin/ping" && request.method === "GET") {
        return json({
          status: "ok",
          protectedBy: "Cloudflare Access",
          email: accessEmail(request) || null
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
