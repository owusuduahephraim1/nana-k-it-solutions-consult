import { authClient, getSession, api, escapeHtml, formatDate } from './auth-common.js';

const authPanel=document.querySelector('#client-auth');
const workspace=document.querySelector('#client-workspace');
const signout=document.querySelector('#client-signout');
const ticketsRoot=document.querySelector('#client-tickets');
const quotesRoot=document.querySelector('#client-quotes');
const status=document.querySelector('#client-auth-status');
const toast=document.querySelector('#client-toast');

function showStatus(message,type='error'){
  status.textContent=message;
  status.className=`form-status show ${type}`;
}
function showToast(message,type='success'){
  toast.textContent=message;
  toast.className=`workspace-toast ${type}`;
  toast.hidden=false;
  clearTimeout(showToast._t);
  showToast._t=setTimeout(()=>toast.hidden=true,2500);
}
async function loadPortal(){
  const session=await getSession().catch(()=>null);
  if(!session?.user){
    authPanel.hidden=false;workspace.hidden=true;signout.hidden=true;return;
  }
  authPanel.hidden=true;workspace.hidden=false;signout.hidden=false;
  try{
    const me=await api('/api/client/me');
    document.querySelector('#client-identity').textContent=`Signed in as ${me.user.email}`;
    await Promise.all([loadTickets(),loadQuotes()]);
  }catch(error){
    authPanel.hidden=false;workspace.hidden=true;signout.hidden=true;
    showStatus(error.message);
  }
}
async function loadTickets(){
  try{
    const payload=await api('/api/client/tickets');
    const rows=payload.data||[];
    ticketsRoot.innerHTML=rows.map(t=>`<article class="client-record">
      <div class="client-record-head"><div><strong>${escapeHtml(t.ticket_number)}</strong><span>${escapeHtml(t.issue_type)}</span></div><span class="status-pill">${escapeHtml(t.status.replaceAll('_',' '))}</span></div>
      <p>${escapeHtml(t.description)}</p>
      <div class="client-record-meta"><span>Priority: ${escapeHtml(t.priority)}</span><span>${formatDate(t.created_at)}</span></div>
      <div class="workspace-row-actions"><button class="btn btn-secondary" data-view-updates="${t.id}">View updates</button><button class="btn btn-primary" data-reply-ticket="${t.id}">Reply</button></div>
      <div class="client-updates" data-updates-root="${t.id}" hidden></div>
    </article>`).join('')||'<div class="empty-state">No support tickets are linked to this verified email.</div>';
  }catch(error){ticketsRoot.innerHTML=`<div class="notice">${escapeHtml(error.message)}</div>`;}
}
async function loadQuotes(){
  try{
    const payload=await api('/api/client/quotes');
    const rows=payload.data||[];
    quotesRoot.innerHTML=rows.map(q=>`<article class="client-record">
      <div class="client-record-head"><div><strong>${escapeHtml(q.service_type)}</strong><span>${formatDate(q.created_at)}</span></div><span class="status-pill">${escapeHtml(q.status.replaceAll('_',' '))}</span></div>
      <p>${escapeHtml(q.description)}</p>
      <div class="client-record-meta"><span>Preferred: ${formatDate(q.preferred_date)}</span></div>
    </article>`).join('')||'<div class="empty-state">No consultation requests are linked to this verified email.</div>';
  }catch(error){quotesRoot.innerHTML=`<div class="notice">${escapeHtml(error.message)}</div>`;}
}
async function loadUpdates(id){
  const root=document.querySelector(`[data-updates-root="${id}"]`);
  root.hidden=false;
  root.innerHTML='<div class="empty-state">Loading updates…</div>';
  try{
    const payload=await api(`/api/client/tickets/${id}/updates`);
    const rows=payload.data||[];
    root.innerHTML=rows.map(u=>`<div class="client-update"><strong>${escapeHtml(u.created_by_email||'Support team')}</strong><small>${formatDate(u.created_at)}</small><p>${escapeHtml(u.body)}</p></div>`).join('')||'<div class="empty-state">No updates yet.</div>';
  }catch(error){root.innerHTML=`<div class="notice">${escapeHtml(error.message)}</div>`;}
}

document.querySelector('#client-login-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const result=await authClient.signIn.email({email:String(fd.get('email')),password:String(fd.get('password'))});
  if(result?.error)return showStatus(result.error.message||'Sign in failed.');
  await loadPortal();
});
document.querySelector('#client-signup-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const result=await authClient.signUp.email({name:String(fd.get('name')),email:String(fd.get('email')),password:String(fd.get('password'))});
  if(result?.error)return showStatus(result.error.message||'Account creation failed.');
  showStatus('Account created. For client record access, use a verified email account. Google sign-in is the quickest verified option.','success');
  await loadPortal();
});
document.querySelector('#client-google').addEventListener('click',async()=>{
  const result=await authClient.signIn.social({provider:'google',callbackURL:location.href});
  if(result?.error)showStatus(result.error.message||'Google sign in failed.');
});
signout.addEventListener('click',async()=>{await authClient.signOut();location.reload();});
document.querySelector('#refresh-client-tickets').addEventListener('click',loadTickets);

ticketsRoot.addEventListener('click',async e=>{
  const view=e.target.closest('[data-view-updates]');
  if(view){await loadUpdates(view.dataset.viewUpdates);return;}
  const reply=e.target.closest('[data-reply-ticket]');
  if(reply){
    const message=prompt('Write your reply to the support team:');
    if(!message)return;
    try{
      await api(`/api/client/tickets/${reply.dataset.replyTicket}/reply`,{method:'POST',body:JSON.stringify({body:message})});
      showToast('Reply sent.');
      await loadUpdates(reply.dataset.replyTicket);
    }catch(error){showToast(error.message,'error');}
  }
});
loadPortal();
