/* ---------- Data layer ----------
   Shared with teammates through localStorage:
   fest_events        -> array of event objects (organizer writes, students read published ones)
   fest_registrations -> array of registrations (registration form writes, organizer reads)  */
const CATEGORIES=["Dance","Music","Dramatics","Literary","Fine Arts","Gaming"];
const DAYS=["Day 1","Day 2","Day 3"];
const EV_KEY="fest_events", REG_KEY="fest_registrations";

function load(key){try{return JSON.parse(localStorage.getItem(key))||[]}catch(e){return []}}
function save(key,val){try{localStorage.setItem(key,JSON.stringify(val))}catch(e){toast("Could not save – browser storage is blocked.")}}

let events=load(EV_KEY), regs=load(REG_KEY), filter="All";

const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const regsFor=id=>regs.filter(r=>r.eventId===id);
const uid=()=>"ev"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);

function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("show"),2600)}

/* ---------- Dashboard rendering ---------- */
function render(){
  const published=events.filter(e=>e.status==="published").length;
  const totalParticipants=regs.reduce((n,r)=>n+1+(r.members?.length||0),0);
  $("#stats").innerHTML=[
    [events.length,"Events"],[published,"Published"],[events.length-published,"Drafts"],
    [regs.length,"Team registrations"],[totalParticipants,"Participants"]
  ].map(([n,l])=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");

  $("#filters").innerHTML=["All",...CATEGORIES].map(c=>
    `<button data-f="${c}" aria-pressed="${c===filter}">${c}</button>`).join("");

  const list=events.filter(e=>filter==="All"||e.category===filter);
  if(!events.length){
    $("#listWrap").innerHTML=`<div class="empty"><p><b>No events yet.</b></p><p>Select “New event” to create the first one, or load demo data to see how the dashboard works.</p></div>`;return;
  }
  if(!list.length){
    $("#listWrap").innerHTML=`<div class="empty">No ${esc(filter)} events yet. Select “New event” and choose ${esc(filter)} as the category.</div>`;return;
  }
  $("#listWrap").innerHTML=`<table><thead><tr><th>Event</th><th>Category</th><th>Slot</th><th>Teams registered</th><th>Status</th><th>Actions</th></tr></thead><tbody>`+
  list.map(e=>{
    const n=regsFor(e.id).length, pct=Math.min(100,Math.round(n/e.capacity*100));
    return `<tr>
      <td><b>${esc(e.name)}</b><br><span class="hint">${esc(e.venue)}</span></td>
      <td><span class="chip">${esc(e.category)}</span></td>
      <td>${esc(e.day)}, ${esc(e.time)}</td>
      <td>${n} / ${e.capacity}${n>=e.capacity?' <span class="hint">(full)</span>':''}<div class="meter"><i style="width:${pct}%"></i></div></td>
      <td class="${e.status==="published"?"pub":"draft"}">${e.status==="published"?"Published":"Draft"}</td>
      <td><div class="row-actions">
        <button data-a="people" data-id="${e.id}">Participants</button>
        <button data-a="edit" data-id="${e.id}">Edit</button>
        <button data-a="toggle" data-id="${e.id}">${e.status==="published"?"Unpublish":"Publish"}</button>
        <button class="danger" data-a="delete" data-id="${e.id}">Delete</button>
      </div></td></tr>`}).join("")+`</tbody></table>`;
}

/* ---------- Create / edit form ---------- */
function openForm(id){
  const e=events.find(x=>x.id===id)||{category:CATEGORIES[0],day:DAYS[0],teamMin:1,teamMax:1,capacity:10,prize:0,status:"draft"};
  const registered=id?regsFor(id).length:0;
  const f=$("#eventForm"); f.dataset.id=id||"";
  const opts=(arr,v)=>arr.map(o=>`<option ${o===v?"selected":""}>${o}</option>`).join("");
  f.innerHTML=`<h2>${id?"Edit event":"New event"}</h2>
  <div class="grid">
    <label class="full">Event name<input name="name" value="${esc(e.name)}" required><span class="err" data-e="name"></span></label>
    <label>Category<select name="category">${opts(CATEGORIES,e.category)}</select></label>
    <label>Day<select name="day">${opts(DAYS,e.day)}</select></label>
    <label>Start time<input name="time" type="time" value="${esc(e.time)}" required><span class="err" data-e="time"></span></label>
    <label>Venue / stage<input name="venue" value="${esc(e.venue)}" placeholder="e.g. Main Stage" required><span class="err" data-e="venue"></span></label>
    <label>Minimum team size<input name="teamMin" type="number" min="1" value="${e.teamMin}"><span class="err" data-e="teamMin"></span></label>
    <label>Maximum team size<input name="teamMax" type="number" min="1" value="${e.teamMax}"><span class="err" data-e="teamMax"></span></label>
    <label>Prize money (₹)<input name="prize" type="number" min="0" value="${e.prize}"><span class="err" data-e="prize"></span></label>
    <label>Capacity (teams)<input name="capacity" type="number" min="1" value="${e.capacity}">
      <span class="hint">${registered?`${registered} team(s) already registered – capacity cannot go below this.`:"Maximum number of teams that can register."}</span>
      <span class="err" data-e="capacity"></span></label>
    <label class="full">Rulebook<textarea name="rules" rows="4" placeholder="One rule per line">${esc(e.rules)}</textarea><span class="err" data-e="rules"></span></label>
  </div>
  <div class="dlg-actions">
    <button type="button" data-close>Cancel</button>
    <button type="submit" value="draft">Save as draft</button>
    <button type="submit" value="published" class="primary">Save and publish</button>
  </div>`;
  $("#formDlg").showModal();
}

function validate(d,id){
  const er={}, registered=id?regsFor(id).length:0;
  if(!d.name.trim()) er.name="Enter the event name.";
  if(!d.time) er.time="Choose a start time.";
  if(!d.venue.trim()) er.venue="Enter the venue or stage.";
  if(!(d.teamMin>=1)) er.teamMin="Minimum team size must be at least 1.";
  if(!(d.teamMax>=1)) er.teamMax="Maximum team size must be at least 1.";
  else if(d.teamMax<d.teamMin) er.teamMax="Maximum team size cannot be smaller than the minimum.";
  if(!(d.prize>=0)||isNaN(d.prize)) er.prize="Prize money must be 0 or more.";
  if(!(d.capacity>=1)) er.capacity="Capacity must be at least 1.";
  else if(d.capacity<registered) er.capacity=`${registered} team(s) have already registered. Set capacity to ${registered} or more.`;
  if(!d.rules.trim()) er.rules="Add at least one rule so students know what to expect.";
  const clash=events.find(x=>x.id!==id&&x.day===d.day&&x.time===d.time&&x.venue.trim().toLowerCase()===d.venue.trim().toLowerCase());
  if(!er.time&&!er.venue&&clash) er.venue=`“${clash.name}” already uses this stage at ${d.time} on ${d.day}.`;
  return er;
}

$("#eventForm").addEventListener("submit",ev=>{
  ev.preventDefault();
  const f=ev.target, id=f.dataset.id, fd=new FormData(f), status=ev.submitter.value;
  const d={name:fd.get("name"),category:fd.get("category"),day:fd.get("day"),time:fd.get("time"),venue:fd.get("venue"),
    teamMin:+fd.get("teamMin"),teamMax:+fd.get("teamMax"),prize:+fd.get("prize"),capacity:+fd.get("capacity"),rules:fd.get("rules")};
  const er=validate(d,id);
  f.querySelectorAll("[data-e]").forEach(s=>s.textContent=er[s.dataset.e]||"");
  const first=Object.keys(er)[0]; if(first){f.elements[first].focus();return}
  if(id){Object.assign(events.find(x=>x.id===id),d,{status});}
  else events.push({id:uid(),...d,status});
  save(EV_KEY,events); $("#formDlg").close(); render();
  toast(status==="published"?"Published.":"Saved as draft.");
});

/* ---------- Participants ---------- */
function showPeople(id){
  const e=events.find(x=>x.id===id), list=regsFor(id);
  const people=list.reduce((n,r)=>n+1+(r.members?.length||0),0);
  $("#partBody").innerHTML=`<h2>${esc(e.name)}</h2>
  <p class="hint">${list.length} of ${e.capacity} teams registered · ${people} participants</p>`+
  (list.length?`<div class="table"><table style="min-width:520px"><thead><tr><th>Ref</th><th>Team</th><th>Captain</th><th>Member roll numbers</th></tr></thead><tbody>`+
    list.map(r=>`<tr><td>${esc(r.ref)}</td><td>${esc(r.teamName)}</td>
      <td>${esc(r.captain?.name)}<br><span class="hint">${esc(r.captain?.roll)}</span></td>
      <td>${esc((r.members||[]).join(", ")||"—")}</td></tr>`).join("")+`</tbody></table></div>`
   :`<div class="empty">No teams have registered for this event yet.</div>`)+
  `<div class="dlg-actions">${list.length?'<button id="csv">Download CSV</button>':''}<button class="primary" data-close>Close</button></div>`;
  $("#partDlg").showModal();
  const b=$("#csv"); if(b) b.onclick=()=>{
    const rows=[["Ref","Team","Captain","Captain roll","Email","Phone","Members"],...list.map(r=>[r.ref,r.teamName,r.captain?.name,r.captain?.roll,r.captain?.email,r.captain?.phone,(r.members||[]).join(" ")])];
    const csv=rows.map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=e.name.replace(/\W+/g,"_")+"_participants.csv";a.click();
  };
}

/* ---------- Event actions ---------- */
document.addEventListener("click",ev=>{
  if(ev.target.closest("[data-close]")){ev.target.closest("dialog").close();return}
  const f=ev.target.closest("[data-f]"); if(f){filter=f.dataset.f;render();return}
  const b=ev.target.closest("[data-a]"); if(!b)return;
  const id=b.dataset.id, e=events.find(x=>x.id===id);
  if(b.dataset.a==="people") showPeople(id);
  if(b.dataset.a==="edit") openForm(id);
  if(b.dataset.a==="toggle"){
    e.status=e.status==="published"?"draft":"published"; save(EV_KEY,events); render();
    toast(e.status==="published"?"Published.":"Unpublished.");
  }
  if(b.dataset.a==="delete"){
    const n=regsFor(id).length;
    if(!confirm(n?`“${e.name}” has ${n} registered team(s). Deleting it will also remove their registrations. Delete anyway?`:`Delete “${e.name}”?`))return;
    events=events.filter(x=>x.id!==id); regs=regs.filter(r=>r.eventId!==id);
    save(EV_KEY,events); save(REG_KEY,regs); render(); toast("Deleted.");
  }
});
$("#newEvent").onclick=()=>openForm();

/* ---------- Demo data ---------- */
$("#seed").onclick=()=>{
  if(events.length&&!confirm("This replaces all current events and registrations with demo data. Continue?"))return;
  events=[
    {id:"ev1",name:"Nritya – Group Dance",category:"Dance",day:"Day 1",time:"10:00",venue:"Main Stage",teamMin:4,teamMax:8,prize:25000,capacity:3,rules:"Max 6 minutes\nNo fire props\nOwn music on pen drive",status:"published"},
    {id:"ev2",name:"Battle of Bands",category:"Music",day:"Day 2",time:"17:00",venue:"Open Air Theatre",teamMin:3,teamMax:6,prize:30000,capacity:5,rules:"Max 15 minutes\nInstruments provided: drums, amps",status:"published"},
    {id:"ev3",name:"Nukkad Natak",category:"Dramatics",day:"Day 2",time:"11:30",venue:"Central Lawn",teamMin:6,teamMax:12,prize:15000,capacity:4,rules:"Street play, 10–15 minutes\nSocial theme only",status:"draft"},
    {id:"ev4",name:"BGMI Showdown",category:"Gaming",day:"Day 3",time:"14:00",venue:"Lab 2",teamMin:4,teamMax:4,prize:10000,capacity:8,rules:"Squad format\nOwn device allowed",status:"published"}];
  const mk=(i,ev,team,cap,mem)=>({id:"r"+i,ref:"CF-"+String(1000+i),eventId:ev,teamName:team,captain:{name:cap,roll:"1230"+(1000+i),email:cap.split(" ")[0].toLowerCase()+"@example.com",phone:"98765000"+(10+i)},members:mem});
  regs=[mk(1,"ev1","Rhythm Squad","Aarav Singh",["12301101","12301102","12301103"]),
        mk(2,"ev1","Beat Breakers","Simran Kaur",["12301104","12301105","12301106"]),
        mk(3,"ev1","Taal Crew","Meera Nair",["12301107","12301108","12301109"]),
        mk(4,"ev2","Static Noise","Rohan Verma",["12301110","12301111"])];
  save(EV_KEY,events); save(REG_KEY,regs); render(); toast("Demo data loaded.");
};

render();
