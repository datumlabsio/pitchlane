#!/usr/bin/env python3
"""Build a self-contained interactive HTML artifact from analysis_data.json."""
import json, os

HERE = os.path.dirname(__file__)
data = json.load(open(os.path.join(HERE, "analysis_data.json")))

HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Upwork Profile Comparison</title>
<style>
  :root{
    --bg:#0f1420; --panel:#161d2e; --panel2:#1d263b; --line:#2a3550;
    --ink:#e8edf7; --mut:#93a0bd; --base:#4f8cff; --shared:#28c896; --coll:#ff7a59;
    --chip:#222d44;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
       background:var(--bg);color:var(--ink);font-size:14px;line-height:1.45}
  header.top{padding:22px 26px 10px;border-bottom:1px solid var(--line)}
  header.top h1{margin:0 0 4px;font-size:20px}
  header.top p{margin:0;color:var(--mut);font-size:13px}
  .tabs{display:flex;gap:6px;padding:14px 26px 0;flex-wrap:wrap}
  .tab{padding:9px 16px;border:1px solid var(--line);border-bottom:none;border-radius:8px 8px 0 0;
       background:var(--panel);color:var(--mut);cursor:pointer;font-weight:600}
  .tab.active{background:var(--panel2);color:var(--ink);border-color:var(--base)}
  .wrap{padding:18px 26px 60px}
  .person{display:none}
  .person.active{display:block}
  .baseline-card{background:linear-gradient(135deg,#1a2440,#161d2e);border:1px solid var(--line);
       border-radius:12px;padding:16px 18px;margin-bottom:16px}
  .baseline-card h2{margin:0 0 2px;font-size:17px}
  .baseline-card .title{color:var(--base);font-weight:600;margin-bottom:8px}
  .meta{display:flex;gap:18px;flex-wrap:wrap;color:var(--mut);font-size:13px;margin-bottom:10px}
  .meta b{color:var(--ink)}
  .chiprow{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
  .chip{background:var(--chip);border:1px solid var(--line);border-radius:20px;padding:2px 10px;font-size:12px}
  .chip.tool{border-color:#34508c}
  .chip.skill{border-color:#3c5e4f}
  .section-label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin:10px 0 4px}
  .rollup-h{font-size:13px;color:var(--mut);margin:4px 0 8px;letter-spacing:.04em;text-transform:uppercase}
  .rollup{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:18px}
  @media(max-width:980px){.rollup{grid-template-columns:1fr 1fr}}
  @media(max-width:620px){.rollup{grid-template-columns:1fr}}
  .rollup .box{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px}
  .rollup .box.base{border-top:3px solid var(--base)}
  .rollup .box.shared{border-top:3px solid var(--shared)}
  .rollup .box.coll{border-top:3px solid var(--coll)}
  .rollup h3{margin:0 0 2px;font-size:13.5px}
  .rollup .sub{color:var(--mut);font-size:11.5px;margin-bottom:10px}
  .gapbar{display:flex;align-items:center;gap:8px;margin:4px 0;font-size:12.5px}
  .gapbar .lbl{width:46%;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .gapbar .track{flex:1;background:#0e1626;border-radius:5px;height:13px;overflow:hidden}
  .gapbar .fill{height:100%;background:var(--coll)}
  .gapbar.base .fill{background:var(--base)}
  .gapbar.shared .fill{background:var(--shared)}
  .gapbar.coll .fill{background:var(--coll)}
  .gapbar .n{width:30px;text-align:right;color:var(--mut)}
  .controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:6px 0 14px}
  .controls input,.controls select{background:var(--panel);border:1px solid var(--line);color:var(--ink);
       padding:8px 10px;border-radius:8px;font-size:13px}
  .controls input{min-width:240px}
  .count-note{color:var(--mut);font-size:12.5px}
  .cmp{background:var(--panel);border:1px solid var(--line);border-radius:11px;margin-bottom:12px;overflow:hidden}
  .cmp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:13px 16px;cursor:pointer}
  .cmp-head:hover{background:var(--panel2)}
  .cmp-head .nm{font-weight:700}
  .cmp-head .tt{color:var(--mut);font-size:12.5px;margin-top:2px;max-width:640px}
  .cmp-head .rateblock{text-align:right;white-space:nowrap}
  .cmp-head .rate{color:var(--shared);font-weight:700}
  .cmp-head .rate-base{color:var(--mut);font-size:11px;margin-top:2px}
  .vsline{color:var(--mut);font-size:11.5px;margin-top:3px}
  .vsline b{color:#c8d3ec}
  .pid{font-size:11px;color:var(--base);text-decoration:none;font-weight:600;border:1px solid #34508c;
       border-radius:5px;padding:1px 6px;margin-left:6px}
  .pid:hover{background:#16233f}
  .badges{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
  .b{font-size:11px;padding:2px 8px;border-radius:6px;border:1px solid var(--line);color:var(--mut)}
  .b.t{border-color:#34508c}
  .b.s{border-color:#3c5e4f}
  .cmp-body{display:none;padding:4px 16px 18px;border-top:1px solid var(--line)}
  .cmp.open .cmp-body{display:block}
  .interp{background:#10182a;border-left:3px solid var(--base);padding:9px 12px;border-radius:6px;
       margin:12px 0;color:#cdd8f0;font-size:13px}
  .metrics{margin:12px 0 4px}
  .metrics .grp-label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin:8px 0 6px}
  .mcards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:6px}
  @media(max-width:620px){.mcards{grid-template-columns:1fr}}
  .mcard{background:#10182a;border:1px solid var(--line);border-radius:9px;padding:10px 12px}
  .mcard .mh{display:flex;justify-content:space-between;align-items:baseline}
  .mcard .mlbl{font-size:12px;color:var(--mut)}
  .mcard .mnum{font-size:22px;font-weight:800;line-height:1}
  .mcard .mtrack{background:#0a1120;border-radius:5px;height:9px;margin-top:9px;overflow:hidden}
  .mcard .mfill{height:100%}
  .mcard.base{border-color:#34508c}.mcard.base .mnum{color:var(--base)}.mcard.base .mfill{background:var(--base)}
  .mcard.coll{border-color:#7a4332}.mcard.coll .mnum{color:var(--coll)}.mcard.coll .mfill{background:var(--coll)}
  .mcard.shared{border-color:#2f6b54}.mcard.shared .mnum{color:var(--shared)}.mcard.shared .mfill{background:var(--shared)}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  @media(max-width:760px){.grid2{grid-template-columns:1fr}}
  .panelg h4{margin:8px 0 6px;font-size:13px}
  .stack{display:flex;height:26px;border-radius:6px;overflow:hidden;border:1px solid var(--line);margin-bottom:6px}
  .stack span{display:flex;align-items:center;justify-content:center;font-size:11px;color:#0c1220;font-weight:700}
  .seg-base{background:var(--base)} .seg-shared{background:var(--shared)} .seg-coll{background:var(--coll)}
  .legend{display:flex;gap:14px;font-size:11.5px;color:var(--mut);margin:2px 0 8px}
  .legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:middle}
  .lst{margin:4px 0 10px}
  .lst .h{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:6px 0 3px}
  .ratio{font-size:12px;color:var(--mut);margin-top:2px}
  .pill{font-weight:700}
  .pill.lo{color:var(--coll)} .pill.mid{color:#e0c04a} .pill.hi{color:var(--shared)}
  .skipnote{background:#241a10;border:1px solid #5a3d18;color:#e8c89a;padding:10px 14px;border-radius:8px;
       margin-bottom:14px;font-size:13px}
</style>
</head>
<body>
<header class="top">
  <h1>Upwork Profile Comparison &mdash; Tools &amp; Skills Overlap</h1>
  <p>Each person's tentative profile (baseline, refreshed live from Upwork) compared against every collected reference profile. Six signals per comparison: baseline-only / collected-only / shared, for tools and for skills. Generated __GEN__.</p>
</header>
<div class="tabs" id="tabs"></div>
<div class="wrap" id="wrap"></div>
<script>
const DATA = __DATA__;

function esc(s){return (s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function ratioPill(r){const cls=r<0.15?'lo':(r<0.35?'mid':'hi');return `<span class="pill ${cls}">${(r*100).toFixed(0)}%</span>`;}

function stackBar(s){
  const tot=s.n_base_only+s.n_shared+s.n_coll_only||1;
  const seg=(n,c,t)=>n? `<span class="${c}" style="width:${n/tot*100}%" title="${t}: ${n}">${n}</span>`:'';
  return `<div class="stack">${seg(s.n_base_only,'seg-base','Baseline only')}${seg(s.n_shared,'seg-shared','Shared')}${seg(s.n_coll_only,'seg-coll','Collected only')}</div>`;
}
function legend(){return `<div class="legend"><span><i style="background:var(--base)"></i>Baseline only</span><span><i style="background:var(--shared)"></i>Shared</span><span><i style="background:var(--coll)"></i>Collected only</span></div>`;}
function chips(arr,cls){return arr.length? arr.map(x=>`<span class="chip ${cls}">${esc(x)}</span>`).join(''):'<span class="ratio">none</span>';}

function mcard(cls,label,n,denom){
  const w = denom? Math.round(n/denom*100):0;
  return `<div class="mcard ${cls}"><div class="mh"><span class="mlbl">${label}</span><span class="mnum">${n}</span></div>
    <div class="mtrack"><div class="mfill" style="width:${w}%"></div></div></div>`;
}
function metricGroup(title,s){
  const denom=Math.max(s.n_base_only,s.n_coll_only,s.n_shared,1);
  return `<div class="grp-label">${title} &mdash; six signals (bar = share of the largest of the three)</div>
    <div class="mcards">
      ${mcard('base','Baseline only (yours)',s.n_base_only,denom)}
      ${mcard('coll','Collected only (theirs)',s.n_coll_only,denom)}
      ${mcard('shared','Shared (in both)',s.n_shared,denom)}
    </div>`;
}
function metricCards(c){
  return `<div class="metrics">${metricGroup('Tools',c.tools)}${metricGroup('Skills',c.skills)}</div>`;
}

function sigPanel(label,s){
  return `<div class="panelg"><h4>${label} &mdash; overlap ${ratioPill(s.overlap_ratio)}</h4>
    ${stackBar(s)}
    <div class="ratio">baseline-only <b>${s.n_base_only}</b> &middot; shared <b>${s.n_shared}</b> &middot; collected-only <b>${s.n_coll_only}</b> &middot; ${s.total_distinct} distinct</div>
    <div class="lst"><div class="h">Shared (in both)</div>${chips(s.shared,'')}</div>
    <div class="lst"><div class="h">Baseline only (yours)</div>${chips(s.base_only,'')}</div>
    <div class="lst"><div class="h">Collected only (theirs)</div>${chips(s.coll_only,'')}</div>
  </div>`;
}

function interp(c){
  const t=c.tools.overlap_ratio, s=c.skills.overlap_ratio;
  const lvl=v=>v<0.15?'low':(v<0.35?'moderate':'high');
  let msg=`${lvl(s)[0].toUpperCase()+lvl(s).slice(1)} skill overlap, ${lvl(t)} tool overlap. `;
  if(s>=0.35&&t<0.15) msg+="Same services, different toolset — this competitor solves similar problems but with different technologies.";
  else if(t>=0.35&&s<0.15) msg+="Shared tools but different positioning — similar tech stack, different service framing.";
  else if(t<0.15&&s<0.15) msg+="Largely distinct — little tool or skill overlap; a different niche or specialization.";
  else if(t>=0.35&&s>=0.35) msg+="Strong overlap on both — a close competitor; differentiation will come from positioning, rate, and proof.";
  else msg+="Partial overlap — some shared ground, room to differentiate.";
  const gainT=c.tools.coll_only.length, gainS=c.skills.coll_only.length;
  if(gainT+gainS) msg+=` They list ${gainT} tool(s) and ${gainS} skill(s) you don't.`;
  return msg;
}

function profId(url){const m=(url||'').match(/~[0-9a-z]+/i);return m?m[0]:'';}

function cmpCard(c,b){
  const pid=profId(c.url);
  const pidHTML=pid? `<a class="pid" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(pid)}</a>`:'';
  return `<div class="cmp" data-search="${esc((c.name+' '+c.title).toLowerCase())}"
      data-tov="${c.tools.overlap_ratio}" data-sov="${c.skills.overlap_ratio}"
      data-comb="${(c.tools.overlap_ratio+c.skills.overlap_ratio).toFixed(4)}">
    <div class="cmp-head" onclick="this.parentNode.classList.toggle('open')">
      <div>
        <div class="nm">${esc(c.name)||esc(c.file)} ${pidHTML}</div>
        <div class="tt">${esc(c.title)}</div>
        <div class="vsline">compared against baseline <b>${esc(b.name)}</b> &middot; ${esc(b.title)}</div>
        <div class="badges">
          <span class="b t">tools: ${ratioPill(c.tools.overlap_ratio)}</span>
          <span class="b s">skills: ${ratioPill(c.skills.overlap_ratio)}</span>
          <span class="b t">shared T ${c.tools.n_shared}</span>
          <span class="b s">shared S ${c.skills.n_shared}</span>
        </div>
      </div>
      <div class="rateblock">
        <div class="rate">${esc(c.hourly_rate)}</div>
        <div class="rate-base">baseline ${esc(b.hourly_rate)}</div>
      </div>
    </div>
    <div class="cmp-body">
      <div class="interp">${interp(c)}</div>
      ${metricCards(c)}
      ${legend()}
      <div class="grid2">${sigPanel('Tools',c.tools)}${sigPanel('Skills',c.skills)}</div>
    </div>
  </div>`;
}

function gapBox(title,sub,arr,cls,denom){
  const max=(arr[0]&&arr[0][1])||1;
  const rows=arr.length? arr.map(([lbl,n])=>`<div class="gapbar ${cls}"><div class="lbl" title="${esc(lbl)}">${esc(lbl)}</div><div class="track"><div class="fill" style="width:${n/max*100}%"></div></div><div class="n">${n}</div></div>`).join('') : '<div class="sub">none</div>';
  return `<div class="box ${cls}"><h3>${title}</h3><div class="sub">${sub}</div>${rows}</div>`;
}

function personView(p){
  const b=p.baseline;
  const baseCard=`<div class="baseline-card">
    <h2>${esc(b.name)} <span class="ratio">(baseline)</span></h2>
    <div class="title">${esc(b.title)}</div>
    <div class="meta"><span>Rate <b>${esc(b.hourly_rate)}</b></span>
      <span>Collected profiles compared <b>${p.n_collected}</b></span>
      <span>Avg tool overlap <b>${(p.avg_tool_overlap*100).toFixed(0)}%</b></span>
      <span>Avg skill overlap <b>${(p.avg_skill_overlap*100).toFixed(0)}%</b></span></div>
    <div class="section-label">Baseline tools (${b.n_tools})</div><div class="chiprow">${chips(b.tools,'tool')}</div>
    <div class="section-label">Baseline skills (${b.n_skills})</div><div class="chiprow">${chips(b.skills,'skill')}</div>
  </div>`;
  const N=p.n_collected, r=p.rollup;
  const cut=a=>(a||[]).slice(0,12);
  const roll=`
  <div class="rollup-h">Tools roll-up &mdash; across all ${N} collected profiles (six signals)</div>
  <div class="rollup">
    ${gapBox('Shared tools (most common)','Tools you and competitors both list — your common ground',cut(r.tools_shared),'shared')}
    ${gapBox('Your distinctive tools','In your profile but most often absent from competitors',cut(r.tools_base_only),'base')}
    ${gapBox('Missing tools (gaps)','Tools competitors list that you don\\'t — consider adding',cut(r.tools_coll_only),'coll')}
  </div>
  <div class="rollup-h">Skills roll-up &mdash; across all ${N} collected profiles (six signals)</div>
  <div class="rollup">
    ${gapBox('Shared skills (most common)','Skills you and competitors both list — your common ground',cut(r.skills_shared),'shared')}
    ${gapBox('Your distinctive skills','In your profile but most often absent from competitors',cut(r.skills_base_only),'base')}
    ${gapBox('Missing skills (gaps)','Skills competitors list that you don\\'t — consider adding',cut(r.skills_coll_only),'coll')}
  </div>`;
  const controls=`<div class="controls">
    <input type="text" placeholder="Filter by name or title…" oninput="filterCmp('${p.person}',this.value)">
    <select onchange="sortCmp('${p.person}',this.value)">
      <option value="comb-desc">Sort: highest combined overlap</option>
      <option value="comb-asc">Sort: lowest combined overlap</option>
      <option value="tov-desc">Sort: highest tool overlap</option>
      <option value="sov-desc">Sort: highest skill overlap</option>
    </select>
    <span class="count-note" id="cnt-${p.person}"></span>
  </div>`;
  const cards=`<div id="list-${p.person}">${p.comparisons.map(c=>cmpCard(c,b)).join('')}</div>`;
  return baseCard+roll+controls+cards;
}

const tabs=document.getElementById('tabs'), wrap=document.getElementById('wrap');
DATA.skipped.forEach(()=>{});
let skipHTML = DATA.skipped.length? `<div class="skipnote"><b>Skipped:</b> `+DATA.skipped.map(s=>`${esc(s.person)} (${esc(s.reason)})`).join(', ')+`. Per the prompt rules, people without a baseline.md are reported and skipped.</div>`:'';

DATA.people.forEach((p,i)=>{
  const t=document.createElement('div'); t.className='tab'+(i===0?' active':'');
  t.textContent=`${p.person} (${p.n_collected})`; t.onclick=()=>activate(p.person); t.id='tab-'+p.person;
  tabs.appendChild(t);
  const d=document.createElement('div'); d.className='person'+(i===0?' active':''); d.id='person-'+p.person;
  d.innerHTML=(i===0?skipHTML:'')+personView(p); wrap.appendChild(d);
});

function activate(name){
  document.querySelectorAll('.person').forEach(e=>e.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));
  document.getElementById('person-'+name).classList.add('active');
  document.getElementById('tab-'+name).classList.add('active');
}
function updCount(name){
  const list=document.getElementById('list-'+name);
  const tot=list.children.length, vis=[...list.children].filter(c=>c.style.display!=='none').length;
  document.getElementById('cnt-'+name).textContent=`${vis} of ${tot} shown`;
}
function filterCmp(name,q){
  q=q.toLowerCase();
  const list=document.getElementById('list-'+name);
  [...list.children].forEach(c=>{c.style.display=c.dataset.search.includes(q)?'':'none';});
  updCount(name);
}
function sortCmp(name,mode){
  const list=document.getElementById('list-'+name);
  const arr=[...list.children];
  const key={'comb-desc':['comb',-1],'comb-asc':['comb',1],'tov-desc':['tov',-1],'sov-desc':['sov',-1]}[mode];
  arr.sort((a,b)=>(parseFloat(a.dataset[key[0]])-parseFloat(b.dataset[key[0]]))*key[1]);
  arr.forEach(c=>list.appendChild(c));
}
DATA.people.forEach(p=>updCount(p.person));
</script>
</body>
</html>"""

html = HTML.replace("__DATA__", json.dumps(data)).replace("__GEN__", data.get("generated",""))
out = os.path.join(HERE, "upwork_profile_comparison.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(html)
print("Wrote", out, len(html), "bytes")
