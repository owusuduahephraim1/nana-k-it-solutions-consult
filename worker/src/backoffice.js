import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwksCache = null;
let jwksUrlCache = '';

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || 'https://owusuduahephraim1.github.io')
    .split(',').map(v => v.trim()).filter(Boolean);
}
function cors(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = allowedOrigins(env);
  const selected = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': selected || 'https://owusuduahephraim1.github.io',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Admin-Upload-Key',
    'Vary': 'Origin'
  };
}
function json(data,status,request,env){
  return new Response(JSON.stringify(data),{
    status,
    headers:{'Content-Type':'application/json; charset=utf-8',...cors(request,env)}
  });
}
function db(env){
  if(!env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  return neon(env.DATABASE_URL);
}
function required(value,name,max=5000){
  const v=String(value??'').trim();
  if(!v) throw new Error(`${name} is required.`);
  if(v.length>max) throw new Error(`${name} is too long.`);
  return v;
}
function optional(value,max=5000){
  if(value===undefined||value===null) return null;
  const v=String(value).trim();
  if(v.length>max) throw new Error('One of the submitted fields is too long.');
  return v||null;
}
function bool(value,fallback=false){
  if(value===undefined||value===null||value==='') return fallback;
  return value===true||value==='true'||value===1||value==='1';
}
async function bodyJson(request){
  const type=request.headers.get('content-type')||'';
  if(!type.includes('application/json')) throw new Error('Content-Type must be application/json.');
  return request.json();
}
function validUuid(v){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
}
function adminEmails(env){
  return new Set(String(env.ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean));
}
function jwks(env){
  const url=String(env.NEON_AUTH_JWKS_URL||'').trim();
  if(!url) throw new Error('NEON_AUTH_JWKS_URL is not configured.');
  if(!jwksCache||jwksUrlCache!==url){
    jwksCache=createRemoteJWKSet(new URL(url));
    jwksUrlCache=url;
  }
  return jwksCache;
}
async function identify(request,env,{admin=false}={}){
  const header=request.headers.get('Authorization')||'';
  const match=header.match(/^Bearer\s+(.+)$/i);
  if(!match) return {response:json({error:'Authentication required.'},401,request,env)};
  try{
    const base=String(env.NEON_AUTH_BASE_URL||'').trim();
    if(!base) throw new Error('NEON_AUTH_BASE_URL missing.');
    const issuer=new URL(base).origin;
    const {payload}=await jwtVerify(match[1],jwks(env),{issuer,audience:issuer});
    const sub=String(payload.sub||'');
    if(!sub) throw new Error('Missing token subject.');
    const sql=db(env);
    const rows=await sql.query(
      'SELECT id,email,name,role,"emailVerified" AS email_verified FROM neon_auth."user" WHERE id=$1 LIMIT 1',
      [sub]
    );
    const user=rows[0];
    if(!user) return {response:json({error:'Authentication session is not recognized.'},401,request,env)};
    user.email=String(user.email||'').toLowerCase();
    if(!user.email_verified){
      return {response:json({error:'A verified account is required. Use Google sign-in or verify your email first.'},403,request,env)};
    }
    if(admin&&!adminEmails(env).has(user.email)){
      return {response:json({error:'Administrator access is not authorized for this account.'},403,request,env)};
    }
    return {user,payload};
  }catch(error){
    console.warn('JWT authentication failed',error?.message||error);
    return {response:json({error:'Authentication failed or expired.'},401,request,env)};
  }
}
async function audit(sql,user,action,entityType=null,entityId=null,details={}){
  await sql.query(
    `INSERT INTO admin_audit_log(actor_user_id,actor_email,action,entity_type,entity_id,details)
     VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
    [user?.id||null,user?.email||null,action,entityType,entityId?String(entityId):null,JSON.stringify(details||{})]
  );
}
async function notify(sql,type,title,body,entityType=null,entityId=null){
  await sql.query(
    `INSERT INTO admin_notifications(type,title,body,entity_type,entity_id)
     VALUES($1,$2,$3,$4,$5)`,
    [type,title,body,entityType,entityId]
  );
}
function apiError(error,request,env){
  console.error(error);
  const msg=String(error?.message||'');
  const known=/required|too long|invalid|not found|must be|unsupported/i.test(msg);
  return json({error:known?msg:'The request could not be completed.'},known?400:500,request,env);
}

const listQueries={
  contacts:`SELECT * FROM contacts ORDER BY created_at DESC LIMIT 250`,
  quotes:`SELECT * FROM quotes ORDER BY created_at DESC LIMIT 250`,
  tickets:`SELECT * FROM tickets ORDER BY created_at DESC LIMIT 250`,
  subscribers:`SELECT * FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 500`,
  projects:`SELECT * FROM projects ORDER BY created_at DESC LIMIT 250`,
  testimonials:`SELECT * FROM testimonials ORDER BY created_at DESC LIMIT 250`,
  blog:`SELECT * FROM blog_posts ORDER BY published_at DESC NULLS LAST,id DESC LIMIT 250`,
  files:`SELECT * FROM managed_files ORDER BY created_at DESC LIMIT 250`,
  notifications:`SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 250`,
  audit:`SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 250`
};

async function overview(request,env,user){
  const sql=db(env);
  const stats=await sql.query(`SELECT
    (SELECT count(*)::int FROM contacts WHERE status='new') AS new_contacts,
    (SELECT count(*)::int FROM quotes WHERE status='new') AS new_quotes,
    (SELECT count(*)::int FROM tickets WHERE status IN ('open','in_progress','waiting_client')) AS active_tickets,
    (SELECT count(*)::int FROM newsletter_subscribers WHERE active=true) AS subscribers,
    (SELECT count(*)::int FROM projects WHERE is_published=true) AS published_projects,
    (SELECT count(*)::int FROM testimonials WHERE is_published=true) AS published_testimonials,
    (SELECT count(*)::int FROM blog_posts WHERE is_published=true) AS published_posts,
    (SELECT count(*)::int FROM managed_files) AS files,
    (SELECT count(*)::int FROM admin_notifications WHERE is_read=false) AS unread_notifications`);
  const notifications=await sql.query(`SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 10`);
  return json({user,stats:stats[0],notifications},200,request,env);
}
async function listResource(request,env,resource){
  if(!listQueries[resource]) return json({error:'Admin resource not found.'},404,request,env);
  const rows=await db(env).query(listQueries[resource]);
  return json({data:rows},200,request,env);
}
async function patchOperational(request,env,user,resource,id){
  if(!validUuid(id)) return json({error:'Invalid record id.'},400,request,env);
  try{
    const body=await bodyJson(request),sql=db(env);
    let rows=[];
    if(resource==='contacts'){
      const status=required(body.status,'Status',20);
      if(!['new','read','archived'].includes(status)) throw new Error('Invalid status.');
      rows=await sql.query(`UPDATE contacts SET status=$1,updated_at=now() WHERE id=$2 RETURNING *`,[status,id]);
    }else if(resource==='quotes'){
      const status=required(body.status,'Status',20);
      if(!['new','reviewing','quoted','scheduled','completed','closed'].includes(status)) throw new Error('Invalid status.');
      rows=await sql.query(`UPDATE quotes SET status=$1,admin_notes=$2,updated_at=now() WHERE id=$3 RETURNING *`,[status,optional(body.admin_notes,5000),id]);
    }else if(resource==='tickets'){
      const status=required(body.status,'Status',30);
      if(!['open','in_progress','waiting_client','resolved','closed'].includes(status)) throw new Error('Invalid status.');
      rows=await sql.query(`UPDATE tickets SET status=$1,admin_notes=$2,updated_at=now() WHERE id=$3 RETURNING *`,[status,optional(body.admin_notes,5000),id]);
    }else if(resource==='subscribers'){
      rows=await sql.query(`UPDATE newsletter_subscribers SET active=$1,unsubscribed_at=CASE WHEN $1 THEN NULL ELSE now() END WHERE id=$2 RETURNING *`,[bool(body.active,true),id]);
    }else if(resource==='notifications'){
      rows=await sql.query(`UPDATE admin_notifications SET is_read=$1 WHERE id=$2 RETURNING *`,[bool(body.is_read,true),id]);
    }else return json({error:'Unsupported update.'},404,request,env);
    if(!rows[0]) return json({error:'Record not found.'},404,request,env);
    await audit(sql,user,`${resource}.update`,resource,id,body);
    return json({data:rows[0],message:'Updated successfully.'},200,request,env);
  }catch(e){return apiError(e,request,env);}
}
async function saveProject(request,env,user,id=null){
  try{
    const b=await bodyJson(request),sql=db(env);
    let rows;
    if(id){
      if(!validUuid(id)) return json({error:'Invalid record id.'},400,request,env);
      rows=await sql.query(`UPDATE projects SET
        title=COALESCE($1,title),slug=COALESCE($2,slug),category=COALESCE($3,category),
        description=COALESCE($4,description),challenge=COALESCE($5,challenge),
        solution=COALESCE($6,solution),technologies=COALESCE($7,technologies),
        result=COALESCE($8,result),image_url=$9,is_published=COALESCE($10,is_published),updated_at=now()
        WHERE id=$11 RETURNING *`,
        [optional(b.title,180),optional(b.slug,200),optional(b.category,80),optional(b.description,5000),optional(b.challenge,5000),optional(b.solution,5000),optional(b.technologies,2000),optional(b.result,5000),optional(b.image_url,2000),b.is_published===undefined?null:bool(b.is_published),id]);
    }else{
      rows=await sql.query(`INSERT INTO projects(title,slug,category,description,challenge,solution,technologies,result,image_url,is_published)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [required(b.title,'Title',180),required(b.slug,'Slug',200),required(b.category,'Category',80),required(b.description,'Description',5000),required(b.challenge,'Challenge',5000),required(b.solution,'Solution',5000),required(b.technologies,'Technologies',2000),required(b.result,'Result',5000),optional(b.image_url,2000),bool(b.is_published,true)]);
    }
    if(!rows[0]) return json({error:'Project not found.'},404,request,env);
    await audit(sql,user,id?'project.update':'project.create','project',rows[0].id,{title:rows[0].title});
    return json({data:rows[0],message:id?'Project updated.':'Project created.'},id?200:201,request,env);
  }catch(e){return apiError(e,request,env);}
}
async function saveTestimonial(request,env,user,id=null){
  try{
    const b=await bodyJson(request),sql=db(env);
    const rating=Number(b.rating??5);
    if(!Number.isFinite(rating)||rating<1||rating>5) throw new Error('Rating must be from 1 to 5.');
    let rows;
    if(id){
      if(!validUuid(id)) return json({error:'Invalid record id.'},400,request,env);
      rows=await sql.query(`UPDATE testimonials SET client_name=COALESCE($1,client_name),company=$2,quote=COALESCE($3,quote),rating=$4,is_published=COALESCE($5,is_published),updated_at=now() WHERE id=$6 RETURNING *`,
        [optional(b.client_name,160),optional(b.company,180),optional(b.quote,5000),rating,b.is_published===undefined?null:bool(b.is_published),id]);
    }else{
      rows=await sql.query(`INSERT INTO testimonials(client_name,company,quote,rating,is_published) VALUES($1,$2,$3,$4,$5) RETURNING *`,
        [required(b.client_name,'Client name',160),optional(b.company,180),required(b.quote,'Quote',5000),rating,bool(b.is_published,false)]);
    }
    if(!rows[0]) return json({error:'Testimonial not found.'},404,request,env);
    await audit(sql,user,id?'testimonial.update':'testimonial.create','testimonial',rows[0].id,{client_name:rows[0].client_name});
    return json({data:rows[0],message:id?'Testimonial updated.':'Testimonial created.'},id?200:201,request,env);
  }catch(e){return apiError(e,request,env);}
}
async function saveBlog(request,env,user,id=null){
  try{
    const b=await bodyJson(request),sql=db(env);
    let published=null;
    if(b.published_at){
      const d=new Date(b.published_at);
      if(Number.isNaN(d.getTime())) throw new Error('Invalid published date.');
      published=d.toISOString();
    }
    let rows;
    if(id){
      if(!validUuid(id)) return json({error:'Invalid record id.'},400,request,env);
      rows=await sql.query(`UPDATE blog_posts SET title=COALESCE($1,title),slug=COALESCE($2,slug),content=COALESCE($3,content),excerpt=$4,category=$5,image_url=$6,published_at=$7,is_published=COALESCE($8,is_published),updated_at=now() WHERE id=$9 RETURNING *`,
        [optional(b.title,220),optional(b.slug,240),optional(b.content,30000),optional(b.excerpt,5000),optional(b.category,80),optional(b.image_url,2000),published,b.is_published===undefined?null:bool(b.is_published),id]);
    }else{
      rows=await sql.query(`INSERT INTO blog_posts(title,slug,content,excerpt,category,image_url,published_at,is_published) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [required(b.title,'Title',220),required(b.slug,'Slug',240),required(b.content,'Content',30000),optional(b.excerpt,5000),optional(b.category,80),optional(b.image_url,2000),published,bool(b.is_published,true)]);
    }
    if(!rows[0]) return json({error:'Article not found.'},404,request,env);
    await audit(sql,user,id?'blog.update':'blog.create','blog',rows[0].id,{title:rows[0].title});
    return json({data:rows[0],message:id?'Article updated.':'Article created.'},id?200:201,request,env);
  }catch(e){return apiError(e,request,env);}
}
async function deleteContent(request,env,user,resource,id){
  const table={projects:'projects',testimonials:'testimonials',blog:'blog_posts'}[resource];
  if(!table) return json({error:'Unsupported delete.'},404,request,env);
  if(!validUuid(id)) return json({error:'Invalid record id.'},400,request,env);
  const sql=db(env);
  const rows=await sql.query(`DELETE FROM ${table} WHERE id=$1 RETURNING id`,[id]);
  if(!rows[0]) return json({error:'Record not found.'},404,request,env);
  await audit(sql,user,`${resource}.delete`,resource,id,{});
  return json({message:'Deleted successfully.'},200,request,env);
}
async function ticketUpdate(request,env,user,id){
  if(!validUuid(id)) return json({error:'Invalid record id.'},400,request,env);
  try{
    const b=await bodyJson(request),sql=db(env);
    const ticket=await sql.query(`SELECT id FROM tickets WHERE id=$1`,[id]);
    if(!ticket[0]) return json({error:'Ticket not found.'},404,request,env);
    const rows=await sql.query(`INSERT INTO ticket_updates(ticket_id,body,visible_to_client,created_by_email) VALUES($1,$2,$3,$4) RETURNING *`,
      [id,required(b.body,'Update',5000),bool(b.visible_to_client,true),user.email]);
    await audit(sql,user,'ticket.update.add','ticket',id,{visible_to_client:rows[0].visible_to_client});
    return json({data:rows[0],message:'Ticket update added.'},201,request,env);
  }catch(e){return apiError(e,request,env);}
}
async function uploadAdminFile(request,env,user){
  try{
    const form=await request.formData();
    const file=form.get('file');
    if(!(file instanceof File)) throw new Error('A file field is required.');
    const max=Number(env.MAX_UPLOAD_BYTES||20*1024*1024);
    if(file.size>max) return json({error:`File exceeds the ${Math.round(max/1024/1024)} MB limit.`},413,request,env);
    const rawPurpose=String(form.get('purpose')||'general').trim().toLowerCase();
    const purpose=rawPurpose.replace(/[^a-z0-9_-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')||'general';
    const folder=purpose==='remote_support'?'remote-support':purpose;
    const base=file.name.replace(/[^a-zA-Z0-9._-]/g,'-').replace(/-+/g,'-');
    const key=`${folder}/${Date.now()}-${crypto.randomUUID()}-${base}`;
    await env.STORAGE.put(key,file.stream(),{
      httpMetadata:{contentType:file.type||'application/octet-stream',cacheControl:'no-store, max-age=0'},
      customMetadata:{originalName:file.name,purpose}
    });
    const publicBase=String(env.R2_PUBLIC_BASE_URL||new URL(request.url).origin).replace(/\/$/,'');
    const publicUrl=`${publicBase}/files/${encodeURI(key)}`;
    const sql=db(env);
    const rows=await sql.query(`INSERT INTO managed_files(storage_key,original_name,content_type,size_bytes,purpose,public_url,is_public,uploaded_by)
      VALUES($1,$2,$3,$4,$5,$6,true,$7) RETURNING *`,
      [key,file.name,file.type||'application/octet-stream',file.size,purpose,publicUrl,user.email]);
    if(purpose==='remote_support'){
      await sql.query(`INSERT INTO site_settings(key,value,is_public,updated_at)
        VALUES('remote_support_file_url',$1,true,now()),('remote_support_file_name',$2,true,now())
        ON CONFLICT(key) DO UPDATE SET value=excluded.value,is_public=true,updated_at=now()`,
        [publicUrl,file.name]);
    }
    await audit(sql,user,'file.upload','file',rows[0].id,{key,purpose,name:file.name,size:file.size});
    return json({message:'File uploaded.',data:rows[0]},201,request,env);
  }catch(e){return apiError(e,request,env);}
}
async function deleteAdminFile(request,env,user,id){
  if(!validUuid(id)) return json({error:'Invalid file id.'},400,request,env);
  try{
    const sql=db(env);
    const rows=await sql.query(`SELECT * FROM managed_files WHERE id=$1`,[id]);
    const file=rows[0];
    if(!file) return json({error:'File not found.'},404,request,env);
    await env.STORAGE.delete(file.storage_key);
    await sql.query(`DELETE FROM managed_files WHERE id=$1`,[id]);
    const s=await sql.query(`SELECT value FROM site_settings WHERE key='remote_support_file_url'`);
    if(s[0]?.value===file.public_url){
      await sql.query(`UPDATE site_settings SET value='',updated_at=now() WHERE key IN ('remote_support_file_url','remote_support_file_name')`);
    }
    await audit(sql,user,'file.delete','file',id,{key:file.storage_key,name:file.original_name});
    return json({message:'File deleted and is immediately inaccessible.'},200,request,env);
  }catch(e){return apiError(e,request,env);}
}

async function clientTickets(request,env,user){
  const rows=await db(env).query(`SELECT id,ticket_number,issue_type,description,priority,status,created_at,updated_at FROM tickets WHERE lower(email)=lower($1) ORDER BY created_at DESC`,[user.email]);
  return json({data:rows},200,request,env);
}
async function clientQuotes(request,env,user){
  const rows=await db(env).query(`SELECT id,service_type,description,preferred_date,status,created_at,updated_at FROM quotes WHERE lower(email)=lower($1) ORDER BY created_at DESC`,[user.email]);
  return json({data:rows},200,request,env);
}
async function clientUpdates(request,env,user,id){
  if(!validUuid(id)) return json({error:'Invalid ticket id.'},400,request,env);
  const sql=db(env);
  const own=await sql.query(`SELECT id FROM tickets WHERE id=$1 AND lower(email)=lower($2)`,[id,user.email]);
  if(!own[0]) return json({error:'Ticket not found.'},404,request,env);
  const rows=await sql.query(`SELECT id,body,created_by_email,created_at FROM ticket_updates WHERE ticket_id=$1 AND visible_to_client=true ORDER BY created_at ASC`,[id]);
  return json({data:rows},200,request,env);
}
async function clientReply(request,env,user,id){
  if(!validUuid(id)) return json({error:'Invalid ticket id.'},400,request,env);
  try{
    const b=await bodyJson(request),sql=db(env);
    const own=await sql.query(`SELECT id,ticket_number FROM tickets WHERE id=$1 AND lower(email)=lower($2)`,[id,user.email]);
    if(!own[0]) return json({error:'Ticket not found.'},404,request,env);
    const rows=await sql.query(`INSERT INTO ticket_updates(ticket_id,body,visible_to_client,created_by_email) VALUES($1,$2,true,$3) RETURNING id,body,created_by_email,created_at`,
      [id,required(b.body,'Reply',5000),user.email]);
    await notify(sql,'ticket_reply','Client replied to support ticket',`${own[0].ticket_number} received a client reply.`,'ticket',id);
    return json({data:rows[0],message:'Reply sent.'},201,request,env);
  }catch(e){return apiError(e,request,env);}
}

export async function handleBackoffice(request,env){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/admin/')){
    const auth=await identify(request,env,{admin:true});
    if(auth.response) return auth.response;
    const user=auth.user;
    if(request.method==='GET'&&url.pathname==='/api/admin/overview') return overview(request,env,user);
    if(request.method==='GET'){
      const resource=url.pathname.slice('/api/admin/'.length);
      if(listQueries[resource]) return listResource(request,env,resource);
    }
    if(request.method==='POST'&&url.pathname==='/api/admin/files/upload') return uploadAdminFile(request,env,user);
    if(request.method==='DELETE'&&url.pathname.startsWith('/api/admin/files/')) return deleteAdminFile(request,env,user,url.pathname.split('/')[4]);
    if(request.method==='POST'&&url.pathname==='/api/admin/projects') return saveProject(request,env,user);
    if(request.method==='POST'&&url.pathname==='/api/admin/testimonials') return saveTestimonial(request,env,user);
    if(request.method==='POST'&&url.pathname==='/api/admin/blog') return saveBlog(request,env,user);
    if(request.method==='PATCH'&&url.pathname.startsWith('/api/admin/projects/')) return saveProject(request,env,user,url.pathname.split('/')[4]);
    if(request.method==='PATCH'&&url.pathname.startsWith('/api/admin/testimonials/')) return saveTestimonial(request,env,user,url.pathname.split('/')[4]);
    if(request.method==='PATCH'&&url.pathname.startsWith('/api/admin/blog/')) return saveBlog(request,env,user,url.pathname.split('/')[4]);
    if(request.method==='DELETE'&&url.pathname.startsWith('/api/admin/projects/')) return deleteContent(request,env,user,'projects',url.pathname.split('/')[4]);
    if(request.method==='DELETE'&&url.pathname.startsWith('/api/admin/testimonials/')) return deleteContent(request,env,user,'testimonials',url.pathname.split('/')[4]);
    if(request.method==='DELETE'&&url.pathname.startsWith('/api/admin/blog/')) return deleteContent(request,env,user,'blog',url.pathname.split('/')[4]);
    if(request.method==='POST'&&/^\/api\/admin\/tickets\/[0-9a-f-]+\/updates$/i.test(url.pathname)) return ticketUpdate(request,env,user,url.pathname.split('/')[4]);
    if(request.method==='PATCH'){
      for(const resource of ['contacts','quotes','tickets','subscribers','notifications']){
        const prefix=`/api/admin/${resource}/`;
        if(url.pathname.startsWith(prefix)) return patchOperational(request,env,user,resource,url.pathname.split('/')[4]);
      }
    }
    return json({error:'Admin endpoint not found.'},404,request,env);
  }

  if(url.pathname.startsWith('/api/client/')){
    const auth=await identify(request,env);
    if(auth.response) return auth.response;
    const user=auth.user;
    if(request.method==='GET'&&url.pathname==='/api/client/me') return json({user:{id:user.id,email:user.email,name:user.name}},200,request,env);
    if(request.method==='GET'&&url.pathname==='/api/client/tickets') return clientTickets(request,env,user);
    if(request.method==='GET'&&url.pathname==='/api/client/quotes') return clientQuotes(request,env,user);
    if(request.method==='GET'&&/^\/api\/client\/tickets\/[0-9a-f-]+\/updates$/i.test(url.pathname)) return clientUpdates(request,env,user,url.pathname.split('/')[4]);
    if(request.method==='POST'&&/^\/api\/client\/tickets\/[0-9a-f-]+\/reply$/i.test(url.pathname)) return clientReply(request,env,user,url.pathname.split('/')[4]);
    return json({error:'Client endpoint not found.'},404,request,env);
  }
  return null;
}
