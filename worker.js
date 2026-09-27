function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
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
