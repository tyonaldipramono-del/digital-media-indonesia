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

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function projectAdminPage(email) {
  const safeEmail = String(email || "Cloudflare Access user")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DMI Admin — Projects</title>
<style>
*{box-sizing:border-box}
:root{--bg:#f5f5f7;--panel:#fff;--text:#111;--muted:#6e6e73;--line:rgba(0,0,0,.10)}
body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
.shell{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
aside{background:#fff;border-right:1px solid var(--line);padding:24px;position:sticky;top:0;height:100vh}
.brand{font-weight:800;letter-spacing:-.035em;font-size:20px;margin-bottom:26px}
.nav{display:grid;gap:7px}
.nav a{padding:11px 12px;border-radius:12px;color:#444;text-decoration:none}
.nav a.active{background:#111;color:#fff}
.user{position:absolute;left:24px;right:24px;bottom:22px;font-size:12px;color:var(--muted);line-height:1.45}
main{padding:34px}
.top{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:22px}
h1{font-size:38px;letter-spacing:-.045em;margin:0}
.btn{border:0;border-radius:12px;padding:11px 15px;background:#111;color:#fff;font:inherit;font-weight:650;cursor:pointer}
.btn.secondary{background:#fff;color:#111;border:1px solid var(--line)}
.btn.danger{background:#fff;color:#b00020;border:1px solid #efc9d1}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:22px;padding:20px}
.table{width:100%;border-collapse:collapse}
.table th,.table td{padding:13px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.table th{font-size:12px;color:var(--muted);font-weight:600}
.badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:#f2f2f4;font-size:11px}
.actions{display:flex;gap:7px;flex-wrap:wrap}
.empty{padding:30px;color:var(--muted);text-align:center}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.35);display:none;place-items:center;padding:22px;z-index:20}
.modal.open{display:grid}
.card{width:min(920px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:26px;padding:24px}
.card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
.card-head h2{margin:0;font-size:26px}
.form-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.field{display:grid;gap:7px}
.field.full{grid-column:1/-1}
label{font-size:12px;color:#555}
input,select,textarea{width:100%;border:1px solid var(--line);border-radius:12px;padding:11px 12px;font:inherit;background:#fff}
textarea{min-height:100px;resize:vertical}
.form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
.meta{font-size:12px;color:var(--muted)}
@media(max-width:760px){
  .shell{grid-template-columns:1fr}
  aside{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line)}
  .user{position:static;margin-top:20px}
  main{padding:20px}
  .form-grid{grid-template-columns:1fr}
  .field.full{grid-column:auto}
}
</style>
</head>
<body>
<div class="shell">
  <aside>
    <div class="brand">Digital Media Indonesia</div>
    <nav class="nav">
      <a class="active" href="/admin/projects">Projects</a>
      <a href="/">← Kembali ke Website</a>
    </nav>
    <div class="user">Authenticated by Cloudflare Access<br>${safeEmail}</div>
  </aside>

  <main>
    <div class="top">
      <div>
        <h1>Projects</h1>
        <div class="meta">Data tersimpan di Cloudflare D1.</div>
      </div>
      <button class="btn" id="addBtn">+ Add Project</button>
    </div>

    <div class="panel">
      <div id="projectTable"><div class="empty">Loading projects...</div></div>
    </div>
  </main>
</div>

<div class="modal" id="projectModal">
  <div class="card">
    <div class="card-head">
      <h2 id="formTitle">Add Project</h2>
      <button class="btn secondary" id="closeBtn">Close</button>
    </div>

    <form id="projectForm">
      <input type="hidden" id="id">

      <div class="form-grid">
        <div class="field">
          <label>Judul — Indonesia</label>
          <input id="title_id" required>
        </div>
        <div class="field">
          <label>Title — English</label>
          <input id="title_en">
        </div>

        <div class="field">
          <label>Slug</label>
          <input id="slug" placeholder="otomatis-jika-kosong">
        </div>
        <div class="field">
          <label>Client</label>
          <input id="client">
        </div>

        <div class="field">
          <label>Tahun</label>
          <input id="year" type="number" min="2000" max="2100" value="2026">
        </div>
        <div class="field">
          <label>Product / Service</label>
          <select id="product_id"></select>
        </div>

        <div class="field">
          <label>Lokasi</label>
          <input id="location">
        </div>
        <div class="field">
          <label>Tools</label>
          <input id="tools" placeholder="Premiere Pro, After Effects, Drone...">
        </div>

        <div class="field">
          <label>Role — Indonesia</label>
          <input id="role_id">
        </div>
        <div class="field">
          <label>Role — English</label>
          <input id="role_en">
        </div>

        <div class="field full">
          <label>Deskripsi — Indonesia</label>
          <textarea id="description_id"></textarea>
        </div>
        <div class="field full">
          <label>Description — English</label>
          <textarea id="description_en"></textarea>
        </div>

        <div class="field">
          <label>Cover URL</label>
          <input id="cover_url" placeholder="https://...">
        </div>
        <div class="field">
          <label>Video URL / Google Drive</label>
          <input id="video_url" placeholder="https://drive.google.com/...">
        </div>

        <div class="field">
          <label>Source / Folder URL</label>
          <input id="source_url" placeholder="https://...">
        </div>
        <div class="field">
          <label>Deliverables</label>
          <input id="deliverables">
        </div>

        <div class="field">
          <label>Status</label>
          <select id="status">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div class="field">
          <label>Featured</label>
          <select id="featured">
            <option value="0">No</option>
            <option value="1">Yes</option>
          </select>
        </div>

        <div class="field">
          <label>Sort Order</label>
          <input id="sort_order" type="number" value="0">
        </div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn secondary" id="cancelBtn">Cancel</button>
        <button type="submit" class="btn">Save Project</button>
      </div>
      <div id="msg" class="meta" style="margin-top:10px"></div>
    </form>
  </div>
</div>

<script>
let projects=[];
let products=[];

const modal=document.getElementById("projectModal");
const form=document.getElementById("projectForm");
const msg=document.getElementById("msg");

function esc(v){
  return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

async function api(url, options={}){
  const res=await fetch(url,{
    ...options,
    headers:{
      "content-type":"application/json",
      ...(options.headers||{})
    }
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||"Request failed");
  return data;
}

async function loadProducts(){
  products=await api("/api/admin/products");
  document.getElementById("product_id").innerHTML=
    '<option value="">— Select —</option>'+
    products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name_id)+'</option>').join("");
}

async function loadProjects(){
  projects=await api("/api/admin/projects");
  renderProjects();
}

function renderProjects(){
  const el=document.getElementById("projectTable");
  if(!projects.length){
    el.innerHTML='<div class="empty">Belum ada project di database.</div>';
    return;
  }

  el.innerHTML='<table class="table">'+
    '<thead><tr>'+
      '<th>Project</th><th>Product</th><th>Year</th><th>Status</th><th>Actions</th>'+
    '</tr></thead>'+
    '<tbody>'+
      projects.map(function(p){
        return '<tr>'+
          '<td><b>'+esc(p.title_id)+'</b><div class="meta">'+esc(p.client||"")+'</div></td>'+
          '<td>'+esc(p.product_name_id||"-")+'</td>'+
          '<td>'+esc(p.year||"")+'</td>'+
          '<td><span class="badge">'+esc(p.status)+'</span>'+(p.featured?'<span class="badge">Featured</span>':'')+'</td>'+
          '<td><div class="actions">'+
            '<button class="btn secondary" data-edit="'+esc(p.id)+'">Edit</button>'+
            '<button class="btn danger" data-delete="'+esc(p.id)+'">Delete</button>'+
          '</div></td>'+
        '</tr>';
      }).join('')+
    '</tbody>'+
  '</table>';

  el.querySelectorAll('[data-edit]').forEach(function(btn){
    btn.addEventListener('click', function(){ editProject(btn.getAttribute('data-edit')); });
  });
  el.querySelectorAll('[data-delete]').forEach(function(btn){
    btn.addEventListener('click', function(){ deleteProject(btn.getAttribute('data-delete')); });
  });
}

function resetForm(){
  form.reset();
  document.getElementById("id").value="";
  document.getElementById("year").value=new Date().getFullYear();
  document.getElementById("sort_order").value="0";
  document.getElementById("status").value="draft";
  document.getElementById("featured").value="0";
  document.getElementById("formTitle").textContent="Add Project";
  msg.textContent="";
}

function openModal(){
  modal.classList.add("open");
}

function closeModal(){
  modal.classList.remove("open");
  resetForm();
}

function editProject(id){
  const p=projects.find(x=>x.id===id); if(!p)return;
  document.getElementById("formTitle").textContent="Edit Project";
  for(const key of [
    "id","title_id","title_en","slug","client","year","product_id","location",
    "tools","role_id","role_en","description_id","description_en","cover_url",
    "video_url","source_url","deliverables","status","sort_order"
  ]){
    const el=document.getElementById(key);
    if(el) el.value=p[key]??"";
  }
  document.getElementById("featured").value=p.featured? "1":"0";
  openModal();
}

async function deleteProject(id){
  const p=projects.find(x=>x.id===id);
  if(!confirm('Hapus project "'+(p?.title_id||id)+'"?')) return;
  try{
    await api("/api/admin/projects/"+encodeURIComponent(id),{method:"DELETE"});
    await loadProjects();
  }catch(e){ alert(e.message); }
}

form.addEventListener("submit",async e=>{
  e.preventDefault();
  msg.textContent="Saving...";

  const id=document.getElementById("id").value;
  const body={};
  for(const key of [
    "title_id","title_en","slug","client","year","product_id","location",
    "tools","role_id","role_en","description_id","description_en","cover_url",
    "video_url","source_url","deliverables","status","featured","sort_order"
  ]){
    body[key]=document.getElementById(key).value;
  }

  try{
    if(id){
      await api("/api/admin/projects/"+encodeURIComponent(id),{
        method:"PUT",body:JSON.stringify(body)
      });
    }else{
      await api("/api/admin/projects",{
        method:"POST",body:JSON.stringify(body)
      });
    }
    closeModal();
    await loadProjects();
  }catch(e){
    msg.textContent=e.message;
  }
});

document.getElementById("addBtn").onclick=()=>{resetForm();openModal();};
document.getElementById("closeBtn").onclick=closeModal;
document.getElementById("cancelBtn").onclick=closeModal;
modal.addEventListener("click",e=>{if(e.target===modal)closeModal();});

(async()=>{
  try{
    await loadProducts();
    await loadProjects();
  }catch(e){
    document.getElementById("projectTable").innerHTML=
      '<div class="empty">Error: '+esc(e.message)+'</div>';
  }
})();
</script>
</body>
</html>`;
}

function normalizeProjectInput(body) {
  const titleId = String(body.title_id || "").trim();
  const slug = slugify(body.slug || titleId);

  return {
    title_id: titleId,
    title_en: String(body.title_en || "").trim(),
    slug,
    client: String(body.client || "").trim(),
    year: body.year ? Number(body.year) : null,
    product_id: body.product_id ? String(body.product_id) : null,
    location: String(body.location || "").trim(),
    role_id: String(body.role_id || "").trim(),
    role_en: String(body.role_en || "").trim(),
    tools: String(body.tools || "").trim(),
    description_id: String(body.description_id || "").trim(),
    description_en: String(body.description_en || "").trim(),
    cover_url: String(body.cover_url || "").trim(),
    video_url: String(body.video_url || "").trim(),
    source_url: String(body.source_url || "").trim(),
    deliverables: String(body.deliverables || "").trim(),
    status: body.status === "published" ? "published" : "draft",
    featured: Number(body.featured) === 1 ? 1 : 0,
    sort_order: Number(body.sort_order || 0)
  };
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

      // ---------- ADMIN UI ----------
      if (
        (url.pathname === "/admin" ||
         url.pathname === "/admin/" ||
         url.pathname === "/admin/login" ||
         url.pathname === "/admin/projects") &&
        request.method === "GET"
      ) {
        return html(projectAdminPage(accessEmail(request)));
      }

      // ---------- ADMIN PRODUCTS ----------
      if (url.pathname === "/api/admin/products" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT id, slug, name_id, name_en, group_key, sort_order, active
          FROM products
          WHERE active = 1
          ORDER BY sort_order ASC, name_id ASC
        `).all();

        return json(result.results || []);
      }

      // ---------- ADMIN PROJECTS LIST ----------
      if (url.pathname === "/api/admin/projects" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT p.*,
                 pr.name_id AS product_name_id,
                 pr.name_en AS product_name_en
          FROM projects p
          LEFT JOIN products pr ON pr.id = p.product_id
          ORDER BY p.sort_order ASC, p.year DESC, p.created_at DESC
        `).all();

        return json(result.results || []);
      }

      // ---------- ADMIN PROJECT CREATE ----------
      if (url.pathname === "/api/admin/projects" && request.method === "POST") {
        const body = normalizeProjectInput(await request.json().catch(() => ({})));

        if (!body.title_id) {
          return json({ error: "Judul Indonesia wajib diisi." }, 400);
        }

        if (!body.slug) {
          return json({ error: "Slug tidak valid." }, 400);
        }

        const id = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO projects (
            id, slug, title_id, title_en, client, year, product_id, location,
            role_id, role_en, tools, description_id, description_en, cover_url,
            video_url, source_url, deliverables, status, featured, sort_order
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id, body.slug, body.title_id, body.title_en, body.client, body.year,
          body.product_id, body.location, body.role_id, body.role_en, body.tools,
          body.description_id, body.description_en, body.cover_url, body.video_url,
          body.source_url, body.deliverables, body.status, body.featured, body.sort_order
        ).run();

        return json({ status: "ok", id }, 201);
      }

      const projectMatch = url.pathname.match(/^\/api\/admin\/projects\/([^/]+)$/);

      // ---------- ADMIN PROJECT UPDATE ----------
      if (projectMatch && request.method === "PUT") {
        const id = decodeURIComponent(projectMatch[1]);
        const body = normalizeProjectInput(await request.json().catch(() => ({})));

        if (!body.title_id) {
          return json({ error: "Judul Indonesia wajib diisi." }, 400);
        }

        const result = await env.DB.prepare(`
          UPDATE projects SET
            slug=?, title_id=?, title_en=?, client=?, year=?, product_id=?, location=?,
            role_id=?, role_en=?, tools=?, description_id=?, description_en=?, cover_url=?,
            video_url=?, source_url=?, deliverables=?, status=?, featured=?, sort_order=?,
            updated_at=CURRENT_TIMESTAMP
          WHERE id=?
        `).bind(
          body.slug, body.title_id, body.title_en, body.client, body.year,
          body.product_id, body.location, body.role_id, body.role_en, body.tools,
          body.description_id, body.description_en, body.cover_url, body.video_url,
          body.source_url, body.deliverables, body.status, body.featured,
          body.sort_order, id
        ).run();

        if (!result.meta?.changes) {
          return json({ error: "Project tidak ditemukan." }, 404);
        }

        return json({ status: "ok", id });
      }

      // ---------- ADMIN PROJECT DELETE ----------
      if (projectMatch && request.method === "DELETE") {
        const id = decodeURIComponent(projectMatch[1]);

        const result = await env.DB.prepare(`
          DELETE FROM projects WHERE id=?
        `).bind(id).run();

        if (!result.meta?.changes) {
          return json({ error: "Project tidak ditemukan." }, 404);
        }

        return json({ status: "ok", id });
      }

      // ---------- ADMIN SESSION CHECK ----------
      if (url.pathname === "/api/admin/me" && request.method === "GET") {
        return json({
          authenticated: true,
          provider: "Cloudflare Access",
          email: accessEmail(request) || null,
          message: "Protected admin API is working."
        });
      }

      return json({ error: "API route not found" }, 404);

    } catch (error) {
      console.error(error);

      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("UNIQUE constraint failed: projects.slug")) {
        return json({ error: "Slug sudah digunakan project lain." }, 409);
      }

      return json({
        error: "Internal server error",
        message
      }, 500);
    }
  }
};
