import { json, requireUser, isAdmin } from "../_util.js";

function toCSV(rows){
  const header = "email,created_at\n";
  const body = (rows||[]).map(r=>{
    const email = String(r.email||"").replace(/"/g,'""');
    const created = String(r.created_at||"").replace(/"/g,'""');
    return `"${email}","${created}"`;
  }).join("\n");
  return header + body + (body ? "\n" : "");
}

export async function onRequestGet({ request, env }){
  const user = await requireUser({request, env});
  if(!isAdmin(user, env)) return json({ok:false, error:"Not authorized."}, 403);

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") || "csv").toLowerCase();

  const rs = await env.DB.prepare("SELECT email, created_at FROM users ORDER BY created_at DESC").all();
  const rows = rs.results || [];

  if(format === "json"){
    return json({ok:true, users: rows});
  }

  const csv = toCSV(rows);
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
