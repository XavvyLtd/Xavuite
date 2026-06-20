export async function handleRepoRequest(request, env, projectId) {
  const method = request.method;
  
  // CORS Response setup
  const origin = request.headers.get('Origin') || 'https://projects.xavvy.uk';
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: responseHeaders });

  try {
    if (method === 'GET') {
      const res = await env.DB.prepare("SELECT * FROM repo_files WHERE project_id = ? AND is_active = 1 ORDER BY timestamp DESC")
        .bind(projectId).run();
      return new Response(JSON.stringify(res.results || []), { status: 200, headers: responseHeaders });
    }

    if (method === 'POST') {
      const formData = await request.formData();
      const file = formData.get('file');
      
      // Error: No file found
      if (!file) throw new Error("No file parameter found in the request payload.");
      
      // 1. Safe binary conversion
      const arrayBuffer = await file.arrayBuffer();
      
      // 2. Validate Binding (This is often why workers crash)
      if (!env.XAVVYREPO) throw new Error("R2 Bucket 'XAVVYREPO' is not bound to this worker!");

      const uniqueFileKey = `projects/${projectId}/${Date.now()}-${file.name}`;

      // 3. Perform the Upload
      await env.XAVVYREPO.put(uniqueFileKey, arrayBuffer, {
        httpMetadata: { contentType: file.type || 'application/octet-stream' }
      });

      // 4. Update Database
      await env.DB.prepare("UPDATE repo_files SET is_active = 0 WHERE filename = ? AND project_id = ?")
        .bind(file.name, projectId).run();
        
      await env.DB.prepare("INSERT INTO repo_files (project_id, filename, file_key, version, is_active) VALUES (?, ?, ?, 1, 1)")
        .bind(projectId, file.name, uniqueFileKey).run();

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: responseHeaders });
    }
  } catch (err) {
    // 🌟 THIS IS THE SMOKING GUN: If it crashes, it tells you WHY here
    console.error("DEBUG ERROR:", err);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { 
      status: 500, 
      headers: responseHeaders 
    });
  }
}