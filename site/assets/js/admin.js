import { authClient, getSession, api, escapeHtml, formatDate, slugify } from './auth-common.js';

const authPanel = document.querySelector('#admin-auth');
const workspace = document.querySelector('#admin-workspace');
const content = document.querySelector('#admin-content');
const title = document.querySelector('#admin-view-title');
const signout = document.querySelector('#admin-signout');
const toast = document.querySelector('#admin-toast');
let currentView = 'overview';
let cache = {};

function showToast(message, type='success') {
  toast.textContent = message;
  toast.className = `workspace-toast ${type}`;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 2600);
}
function setBusy(message='Loading…') {
  content.innerHTML = `<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> ${escapeHtml(message)}</div>`;
}
function showAuthError(message) {
  const box = document.querySelector('#admin-auth-status');
  box.textContent = message;
  box.className = 'form-status show error';
}
async function ensureWorkspace() {
  const session = await getSession().catch(() => null);
  if (!session?.user) {
    authPanel.hidden = false;
    workspace.hidden = true;
    signout.hidden = true;
    return;
  }
  authPanel.hidden = true;
  workspace.hidden = false;
  signout.hidden = false;
  document.querySelector('#admin-user-name').textContent = session.user.name || 'Administrator';
  document.querySelector('#admin-user-email').textContent = session.user.email || '';
  await loadView(currentView);
}
async function call(path, options={}) {
  return api(path, options);
}
async function loadView(view) {
  currentView = view;
  document.querySelectorAll('[data-admin-view]').forEach(b => b.classList.toggle('active', b.dataset.adminView === view));
  const labels = {
    overview:'Overview',contacts:'Contact Messages',quotes:'Consultation Requests',tickets:'Support Tickets',
    subscribers:'Newsletter Subscribers',projects:'Portfolio Management',testimonials:'Testimonials',
    blog:'Blog & Insights',files:'Files & Remote Support',notifications:'Notifications',audit:'Audit Log'
  };
  title.textContent = labels[view] || 'Admin Workspace';
  setBusy();
  try {
    if (view === 'overview') return renderOverview(await call('/api/admin/overview'));
    const payload = await call(`/api/admin/${view}`);
    cache[view] = payload.data || [];
    if (view === 'contacts') renderContacts(cache[view]);
    else if (view === 'quotes') renderQuotes(cache[view]);
    else if (view === 'tickets') renderTickets(cache[view]);
    else if (view === 'subscribers') renderSubscribers(cache[view]);
    else if (view === 'projects') renderProjects(cache[view]);
    else if (view === 'testimonials') renderTestimonials(cache[view]);
    else if (view === 'blog') renderBlog(cache[view]);
    else if (view === 'files') renderFiles(cache[view]);
    else if (view === 'notifications') renderNotifications(cache[view]);
    else if (view === 'audit') renderAudit(cache[view]);
  } catch (error) {
    content.innerHTML = `<div class="notice"><strong>Unable to load this section.</strong><br>${escapeHtml(error.message)}</div>`;
  }
}
function renderOverview(data) {
  const s = data.stats || {};
  content.innerHTML = `
    <div class="workspace-kpis">
      ${[
        ['New contacts',s.new_contacts,'envelope'],
        ['New quotes',s.new_quotes,'file-invoice'],
        ['Active tickets',s.active_tickets,'ticket'],
        ['Subscribers',s.subscribers,'users'],
        ['Published projects',s.published_projects,'diagram-project'],
        ['Published posts',s.published_posts,'newspaper'],
        ['Published testimonials',s.published_testimonials,'star'],
        ['Managed files',s.files,'cloud'],
        ['Unread alerts',s.unread_notifications,'bell']
      ].map(([label,value,icon]) => `<article class="workspace-kpi"><i class="fa-solid fa-${icon}"></i><strong>${Number(value||0)}</strong><span>${label}</span></article>`).join('')}
    </div>
    <div class="workspace-panel" style="margin-top:1.2rem">
      <div class="workspace-panel-head"><h2>Recent notifications</h2><button class="btn btn-secondary" data-admin-view-link="notifications">Open notifications</button></div>
      <div class="workspace-list">
        ${(data.notifications||[]).map(n => `<article class="workspace-list-item ${n.is_read?'':'is-unread'}">
          <div><strong>${escapeHtml(n.title)}</strong><p>${escapeHtml(n.body)}</p><small>${formatDate(n.created_at)}</small></div>
          ${n.is_read?'':`<button class="btn btn-secondary" data-read-notification="${n.id}">Mark read</button>`}
        </article>`).join('') || '<div class="empty-state">No notifications yet.</div>'}
      </div>
    </div>`;
}
function tableWrap(headers, rows) {
  return `<div class="workspace-table-wrap"><table class="workspace-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function statusSelect(id, current, values, resource) {
  return `<select data-status-resource="${resource}" data-id="${id}">${values.map(v=>`<option value="${v}" ${v===current?'selected':''}>${v.replaceAll('_',' ')}</option>`).join('')}</select>`;
}
function renderContacts(rows) {
  content.innerHTML = tableWrap(['Date','Name','Email / Phone','Subject','Message','Status'],
    rows.map(r=>`<tr><td>${formatDate(r.created_at)}</td><td><strong>${escapeHtml(r.name)}</strong></td><td>${escapeHtml(r.email)}<br><small>${escapeHtml(r.phone||'')}</small></td><td>${escapeHtml(r.subject)}</td><td class="workspace-cell-wide">${escapeHtml(r.message)}</td><td>${statusSelect(r.id,r.status,['new','read','archived'],'contacts')}</td></tr>`).join('') || '<tr><td colspan="6">No contact messages.</td></tr>');
}
function renderQuotes(rows) {
  content.innerHTML = tableWrap(['Date','Client','Service','Preferred','Description','Status / Notes'],
    rows.map(r=>`<tr><td>${formatDate(r.created_at)}</td><td><strong>${escapeHtml(r.name)}</strong><br>${escapeHtml(r.email)}<br>${escapeHtml(r.phone||'')}</td><td>${escapeHtml(r.service_type)}</td><td>${formatDate(r.preferred_date)}</td><td class="workspace-cell-wide">${escapeHtml(r.description)}</td><td>${statusSelect(r.id,r.status,['new','reviewing','quoted','scheduled','completed','closed'],'quotes')}<textarea class="workspace-inline-note" data-notes="${r.id}" placeholder="Admin notes">${escapeHtml(r.admin_notes||'')}</textarea><button class="btn btn-secondary" data-save-quote="${r.id}">Save</button></td></tr>`).join('') || '<tr><td colspan="6">No consultation requests.</td></tr>');
}
function renderTickets(rows) {
  content.innerHTML = tableWrap(['Ticket','Client','Issue','Priority','Description','Status / Actions'],
    rows.map(r=>`<tr><td><strong>${escapeHtml(r.ticket_number)}</strong><br><small>${formatDate(r.created_at)}</small></td><td>${escapeHtml(r.name)}<br>${escapeHtml(r.email)}</td><td>${escapeHtml(r.issue_type)}</td><td><span class="status-pill">${escapeHtml(r.priority)}</span></td><td class="workspace-cell-wide">${escapeHtml(r.description)}</td><td>${statusSelect(r.id,r.status,['open','in_progress','waiting_client','resolved','closed'],'tickets')}<textarea class="workspace-inline-note" data-ticket-notes="${r.id}" placeholder="Internal notes">${escapeHtml(r.admin_notes||'')}</textarea><div class="workspace-row-actions"><button class="btn btn-secondary" data-save-ticket="${r.id}">Save</button><button class="btn btn-primary" data-ticket-update="${r.id}">Client update</button></div></td></tr>`).join('') || '<tr><td colspan="6">No support tickets.</td></tr>');
}
function renderSubscribers(rows) {
  content.innerHTML = tableWrap(['Date','Email','Status','Action'],
    rows.map(r=>`<tr><td>${formatDate(r.created_at)}</td><td>${escapeHtml(r.email)}</td><td>${r.active?'<span class="status-pill">active</span>':'inactive'}</td><td><button class="btn btn-secondary" data-toggle-subscriber="${r.id}" data-active="${r.active?'true':'false'}">${r.active?'Deactivate':'Reactivate'}</button></td></tr>`).join('') || '<tr><td colspan="4">No subscribers.</td></tr>');
}
function projectForm(item={}) {
  return `<form class="workspace-editor" id="project-editor" data-edit-id="${item.id||''}">
    <div class="form-grid two"><div class="field"><label>Title</label><input name="title" value="${escapeHtml(item.title||'')}" required></div><div class="field"><label>Slug</label><input name="slug" value="${escapeHtml(item.slug||'')}" required></div><div class="field"><label>Category</label><input name="category" value="${escapeHtml(item.category||'')}" required></div><div class="field"><label>Image URL</label><input name="image_url" value="${escapeHtml(item.image_url||'')}"></div></div>
    ${['description','challenge','solution','technologies','result'].map(k=>`<div class="field" style="margin-top:.8rem"><label>${k[0].toUpperCase()+k.slice(1)}</label><textarea name="${k}" required>${escapeHtml(item[k]||'')}</textarea></div>`).join('')}
    <label class="workspace-check"><input type="checkbox" name="is_published" ${item.id?(item.is_published?'checked':''):'checked'}> Published</label>
    <div class="workspace-row-actions"><button class="btn btn-primary" type="submit">${item.id?'Update project':'Add project'}</button><button class="btn btn-secondary" type="button" data-clear-editor="projects">Clear</button></div>
  </form>`;
}
function renderProjects(rows, edit=null) {
  content.innerHTML = `<div class="workspace-panel"><h2>${edit?'Edit project':'Add portfolio project'}</h2>${projectForm(edit||{})}</div><div class="workspace-panel" style="margin-top:1rem">${tableWrap(['Title','Category','Published','Actions'],rows.map(r=>`<tr><td><strong>${escapeHtml(r.title)}</strong><br><small>${escapeHtml(r.slug)}</small></td><td>${escapeHtml(r.category)}</td><td>${r.is_published?'Yes':'No'}</td><td><div class="workspace-row-actions"><button class="btn btn-secondary" data-edit-content="projects" data-id="${r.id}">Edit</button><button class="btn btn-danger" data-delete-content="projects" data-id="${r.id}">Delete</button></div></td></tr>`).join('')||'<tr><td colspan="4">No projects.</td></tr>')}</div>`;
}
function testimonialForm(item={}) {
  return `<form class="workspace-editor" id="testimonial-editor" data-edit-id="${item.id||''}">
    <div class="form-grid two"><div class="field"><label>Client name</label><input name="client_name" value="${escapeHtml(item.client_name||'')}" required></div><div class="field"><label>Company</label><input name="company" value="${escapeHtml(item.company||'')}"></div><div class="field"><label>Rating</label><input name="rating" type="number" min="1" max="5" value="${escapeHtml(item.rating||5)}" required></div></div>
    <div class="field" style="margin-top:.8rem"><label>Testimonial</label><textarea name="quote" required>${escapeHtml(item.quote||'')}</textarea></div>
    <label class="workspace-check"><input type="checkbox" name="is_published" ${item.is_published?'checked':''}> Client-approved and published</label>
    <div class="workspace-row-actions"><button class="btn btn-primary" type="submit">${item.id?'Update testimonial':'Add testimonial'}</button><button class="btn btn-secondary" type="button" data-clear-editor="testimonials">Clear</button></div>
  </form>`;
}
function renderTestimonials(rows, edit=null) {
  content.innerHTML = `<div class="workspace-panel"><h2>${edit?'Edit testimonial':'Add verified testimonial'}</h2><p class="muted">Keep testimonials unpublished until the client has approved the wording.</p>${testimonialForm(edit||{})}</div><div class="workspace-panel" style="margin-top:1rem">${tableWrap(['Client','Quote','Rating','Published','Actions'],rows.map(r=>`<tr><td>${escapeHtml(r.client_name)}<br><small>${escapeHtml(r.company||'')}</small></td><td class="workspace-cell-wide">${escapeHtml(r.quote)}</td><td>${r.rating}/5</td><td>${r.is_published?'Yes':'No'}</td><td><div class="workspace-row-actions"><button class="btn btn-secondary" data-edit-content="testimonials" data-id="${r.id}">Edit</button><button class="btn btn-danger" data-delete-content="testimonials" data-id="${r.id}">Delete</button></div></td></tr>`).join('')||'<tr><td colspan="5">No testimonials.</td></tr>')}</div>`;
}
function blogForm(item={}) {
  const localDate=item.published_at?new Date(item.published_at).toISOString().slice(0,16):'';
  return `<form class="workspace-editor" id="blog-editor" data-edit-id="${item.id||''}">
    <div class="form-grid two"><div class="field"><label>Title</label><input name="title" value="${escapeHtml(item.title||'')}" required></div><div class="field"><label>Slug</label><input name="slug" value="${escapeHtml(item.slug||'')}" required></div><div class="field"><label>Category</label><input name="category" value="${escapeHtml(item.category||'')}"></div><div class="field"><label>Publish date</label><input name="published_at" type="datetime-local" value="${localDate}"></div><div class="field"><label>Image URL</label><input name="image_url" value="${escapeHtml(item.image_url||'')}"></div></div>
    <div class="field" style="margin-top:.8rem"><label>Excerpt</label><textarea name="excerpt">${escapeHtml(item.excerpt||'')}</textarea></div>
    <div class="field" style="margin-top:.8rem"><label>Article HTML</label><textarea name="content" style="min-height:260px" required>${escapeHtml(item.content||'')}</textarea></div>
    <label class="workspace-check"><input type="checkbox" name="is_published" ${item.id?(item.is_published?'checked':''):'checked'}> Published</label>
    <div class="workspace-row-actions"><button class="btn btn-primary" type="submit">${item.id?'Update article':'Add article'}</button><button class="btn btn-secondary" type="button" data-clear-editor="blog">Clear</button></div>
  </form>`;
}
function renderBlog(rows, edit=null) {
  content.innerHTML = `<div class="workspace-panel"><h2>${edit?'Edit article':'Create article'}</h2>${blogForm(edit||{})}</div><div class="workspace-panel" style="margin-top:1rem">${tableWrap(['Title','Category','Published','Date','Actions'],rows.map(r=>`<tr><td><strong>${escapeHtml(r.title)}</strong><br><small>${escapeHtml(r.slug)}</small></td><td>${escapeHtml(r.category||'')}</td><td>${r.is_published?'Yes':'No'}</td><td>${formatDate(r.published_at)}</td><td><div class="workspace-row-actions"><button class="btn btn-secondary" data-edit-content="blog" data-id="${r.id}">Edit</button><button class="btn btn-danger" data-delete-content="blog" data-id="${r.id}">Delete</button></div></td></tr>`).join('')||'<tr><td colspan="5">No articles.</td></tr>')}</div>`;
}
function renderFiles(rows) {
  content.innerHTML = `<div class="workspace-panel"><h2>Upload a managed file</h2><p class="muted">Choose <strong>Remote support</strong> to automatically make the newest installer the public download on the Remote Support page.</p><form id="file-upload-form"><div class="form-grid two"><div class="field"><label>Purpose</label><select name="purpose"><option value="remote_support">Remote support</option><option value="portfolio">Portfolio asset</option><option value="documents">Document</option><option value="general">General</option></select></div><div class="field"><label>File (max 20 MB)</label><input name="file" type="file" required></div></div><button class="btn btn-primary" type="submit" style="margin-top:1rem"><i class="fa-solid fa-cloud-arrow-up"></i> Upload</button></form></div>
  <div class="workspace-panel" style="margin-top:1rem">${tableWrap(['Uploaded','Name','Purpose','Size','Link','Action'],rows.map(r=>`<tr><td>${formatDate(r.created_at)}</td><td>${escapeHtml(r.original_name)}</td><td>${escapeHtml(r.purpose)}</td><td>${Math.round(Number(r.size_bytes||0)/1024)} KB</td><td><a href="${escapeHtml(r.public_url||'#')}" target="_blank" rel="noopener">Open</a></td><td><button class="btn btn-danger" data-delete-file="${r.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="6">No managed files.</td></tr>')}</div>`;
}
function renderNotifications(rows) {
  content.innerHTML = `<div class="workspace-panel"><div class="workspace-panel-head"><h2>Notifications</h2><span class="muted">${rows.filter(r=>!r.is_read).length} unread</span></div><div class="workspace-list">${rows.map(n=>`<article class="workspace-list-item ${n.is_read?'':'is-unread'}"><div><strong>${escapeHtml(n.title)}</strong><p>${escapeHtml(n.body)}</p><small>${formatDate(n.created_at)}</small></div><div class="workspace-row-actions">${n.is_read?'':`<button class="btn btn-secondary" data-read-notification="${n.id}">Mark read</button>`}</div></article>`).join('') || '<div class="empty-state">No notifications yet.</div>'}</div></div>`;
}
function renderAudit(rows) {
  content.innerHTML = tableWrap(['Date','Actor','Action','Entity','Details'],
    rows.map(r=>`<tr><td>${formatDate(r.created_at)}</td><td>${escapeHtml(r.actor_email||'system')}</td><td>${escapeHtml(r.action)}</td><td>${escapeHtml(r.entity_type||'')} ${escapeHtml(r.entity_id||'')}</td><td><code>${escapeHtml(JSON.stringify(r.details||{}))}</code></td></tr>`).join('') || '<tr><td colspan="5">No audit entries.</td></tr>');
}
function formObject(form) {
  const obj=Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('input[type="checkbox"]').forEach(i=>obj[i.name]=i.checked);
  return obj;
}

document.querySelectorAll('[data-admin-view]').forEach(btn=>btn.addEventListener('click',()=>loadView(btn.dataset.adminView)));
document.querySelector('#admin-refresh').addEventListener('click',()=>loadView(currentView));
document.querySelector('#admin-login-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const result=await authClient.signIn.email({email:String(fd.get('email')),password:String(fd.get('password'))});
  if(result?.error) return showAuthError(result.error.message||'Sign in failed.');
  await ensureWorkspace();
});
document.querySelector('#admin-google').addEventListener('click',async()=>{
  const result=await authClient.signIn.social({provider:'google',callbackURL:location.href});
  if(result?.error) showAuthError(result.error.message||'Google sign in failed.');
});
signout.addEventListener('click',async()=>{await authClient.signOut();location.reload();});

content.addEventListener('change',async e=>{
  const el=e.target.closest('[data-status-resource]');
  if(!el) return;
  if(el.dataset.statusResource==='quotes'||el.dataset.statusResource==='tickets') return;
  try{
    await call(`/api/admin/${el.dataset.statusResource}/${el.dataset.id}`,{method:'PATCH',body:JSON.stringify({status:el.value})});
    showToast('Status updated.');
  }catch(err){showToast(err.message,'error');}
});
content.addEventListener('submit',async e=>{
  const form=e.target;
  if(form.id==='project-editor'||form.id==='testimonial-editor'||form.id==='blog-editor'){
    e.preventDefault();
    const resource=form.id.split('-')[0]==='testimonial'?'testimonials':form.id.split('-')[0];
    const id=form.dataset.editId;
    const data=formObject(form);
    if(resource==='projects'&&!data.slug) data.slug=slugify(data.title);
    if(resource==='blog'&&!data.slug) data.slug=slugify(data.title);
    try{
      await call(`/api/admin/${resource}${id?`/${id}`:''}`,{method:id?'PATCH':'POST',body:JSON.stringify(data)});
      showToast(id?'Updated successfully.':'Created successfully.');
      await loadView(resource);
    }catch(err){showToast(err.message,'error');}
  }else if(form.id==='file-upload-form'){
    e.preventDefault();
    const button=form.querySelector('button[type="submit"]');
    button.disabled=true;
    try{
      await call('/api/admin/files/upload',{method:'POST',body:new FormData(form)});
      showToast('File uploaded.');
      await loadView('files');
    }catch(err){showToast(err.message,'error');}
    finally{button.disabled=false;}
  }
});
content.addEventListener('click',async e=>{
  const viewLink=e.target.closest('[data-admin-view-link]');
  if(viewLink){return loadView(viewLink.dataset.adminViewLink);}
  const read=e.target.closest('[data-read-notification]');
  if(read){
    try{await call(`/api/admin/notifications/${read.dataset.readNotification}`,{method:'PATCH',body:JSON.stringify({is_read:true})});await loadView('overview');}catch(err){showToast(err.message,'error');}
    return;
  }
  const clear=e.target.closest('[data-clear-editor]');
  if(clear) return loadView(clear.dataset.clearEditor);
  const edit=e.target.closest('[data-edit-content]');
  if(edit){
    const resource=edit.dataset.editContent;
    const item=(cache[resource]||[]).find(x=>x.id===edit.dataset.id);
    if(resource==='projects') renderProjects(cache[resource],item);
    else if(resource==='testimonials') renderTestimonials(cache[resource],item);
    else if(resource==='blog') renderBlog(cache[resource],item);
    window.scrollTo({top:0,behavior:'smooth'});
    return;
  }
  const del=e.target.closest('[data-delete-content]');
  if(del){
    if(!confirm('Delete this item permanently?')) return;
    try{await call(`/api/admin/${del.dataset.deleteContent}/${del.dataset.id}`,{method:'DELETE'});showToast('Deleted.');await loadView(del.dataset.deleteContent);}catch(err){showToast(err.message,'error');}
    return;
  }
  const sf=e.target.closest('[data-save-quote]');
  if(sf){
    const id=sf.dataset.saveQuote;
    const status=content.querySelector(`[data-status-resource="quotes"][data-id="${id}"]`).value;
    const notes=content.querySelector(`[data-notes="${id}"]`).value;
    try{await call(`/api/admin/quotes/${id}`,{method:'PATCH',body:JSON.stringify({status,admin_notes:notes})});showToast('Quote updated.');}catch(err){showToast(err.message,'error');}
    return;
  }
  const st=e.target.closest('[data-save-ticket]');
  if(st){
    const id=st.dataset.saveTicket;
    const status=content.querySelector(`[data-status-resource="tickets"][data-id="${id}"]`).value;
    const notes=content.querySelector(`[data-ticket-notes="${id}"]`).value;
    try{await call(`/api/admin/tickets/${id}`,{method:'PATCH',body:JSON.stringify({status,admin_notes:notes})});showToast('Ticket updated.');}catch(err){showToast(err.message,'error');}
    return;
  }
  const tu=e.target.closest('[data-ticket-update]');
  if(tu){
    const message=prompt('Enter the update that the client should see:');
    if(!message) return;
    try{await call(`/api/admin/tickets/${tu.dataset.ticketUpdate}/updates`,{method:'POST',body:JSON.stringify({body:message,visible_to_client:true})});showToast('Client-visible update added.');}catch(err){showToast(err.message,'error');}
    return;
  }
  const sub=e.target.closest('[data-toggle-subscriber]');
  if(sub){
    try{await call(`/api/admin/subscribers/${sub.dataset.toggleSubscriber}`,{method:'PATCH',body:JSON.stringify({active:sub.dataset.active!=='true'})});showToast('Subscriber updated.');await loadView('subscribers');}catch(err){showToast(err.message,'error');}
    return;
  }
  const df=e.target.closest('[data-delete-file]');
  if(df){
    if(!confirm('Delete this file from R2? It will become inaccessible immediately.')) return;
    try{await call(`/api/admin/files/${df.dataset.deleteFile}`,{method:'DELETE'});showToast('File deleted.');await loadView('files');}catch(err){showToast(err.message,'error');}
  }
});

ensureWorkspace();
