#!/usr/bin/env python3
"""Build a single self-contained interactive HTML artifact for the Faizan K.
baseline vs 100 collected profiles. No external network calls; data embedded inline,
rendered with vanilla JS. Six signals per collected profile + gap roll-up.
"""
import os, json, html

HERE = os.path.dirname(__file__)
DATA = os.path.join(HERE, "faizan_analysis_data.json")
OUT = os.path.join(HERE, "..", "artifacts", "faizan_profile_analysis.html")

with open(DATA) as f:
    data = json.load(f)

payload = json.dumps(data).replace("</", "<\\/")

HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Upwork Profile Analysis — Faizan K. vs 100 Collected Profiles</title>
<style>
  :root{
    --bg:#0e1117; --panel:#161b22; --panel2:#1c2330; --line:#2a3340; --txt:#e6edf3;
    --muted:#9aa7b4; --green:#3fb950; --blue:#58a6ff; --amber:#d29922; --red:#f0883e;
    --base:#58a6ff; --coll:#d29922; --shared:#3fb950;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  a{color:var(--blue)}
  .wrap{max-width:1180px;margin:0 auto;padding:22px}
  h1{font-size:22px;margin:0 0 4px}
  h2{font-size:17px;margin:26px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
  .sub{color:var(--muted);font-size:13px}
  .tabs{display:flex;gap:6px;margin:16px 0 6px;border-bottom:1px solid var(--line)}
  .tab{padding:9px 16px;background:var(--panel);border:1px solid var(--line);border-bottom:none;border-radius:8px 8px 0 0;cursor:pointer;color:var(--muted);font-weight:600}
  .tab.active{background:var(--panel2);color:var(--txt)}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;margin:12px 0}
  .baseline-card{background:linear-gradient(180deg,#15233a,#161b22)}
  .pill{display:inline-block;background:var(--panel2);border:1px solid var(--line);border-radius:999px;padding:3px 9px;margin:2px;font-size:12px}
  .pill.tool{border-color:#27406b}
  .pill.skill{border-color:#3a5230}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
  .stat{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:10px}
  .stat .n{font-size:24px;font-weight:700}
  .stat .lbl{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.4px}
  .controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:12px 0}
  input,select{background:var(--panel2);color:var(--txt);border:1px solid var(--line);border-radius:7px;padding:8px 10px;font-size:13px}
  .cmp{border:1px solid var(--line);border-radius:10px;margin:10px 0;background:var(--panel)}
  .cmp summary{cursor:pointer;padding:12px 14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;list-style:none}
  .cmp summary::-webkit-details-marker{display:none}
  .cmp summary:hover{background:var(--panel2)}
  .ctitle{font-weight:600;flex:1;min-width:220px}
  .kw{font-size:11px;color:var(--muted);background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:2px 7px}
  .rate{color:var(--green);font-weight:600}
  .body{padding:0 14px 14px}
  .six{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0}
  @media(max-width:760px){.six{grid-template-columns:1fr}}
  .metric{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:10px}
  .metric .mlbl{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px}
  .metric .mn{font-size:22px;font-weight:700;margin:2px 0 6px}
  .bar{height:8px;border-radius:5px;background:#0d1117;overflow:hidden;border:1px solid var(--line)}
  .bar > i{display:block;height:100%}
  .b-base{background:var(--base)} .b-coll{background:var(--coll)} .b-shared{background:var(--shared)}
  .legend{font-size:12px;color:var(--muted);margin:6px 0}
  .dot{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;vertical-align:middle}
  .stack{display:flex;height:22px;border-radius:6px;overflow:hidden;border:1px solid var(--line);margin:4px 0}
  .stack > span{display:flex;align-items:center;justify-content:center;font-size:11px;color:#0d1117;font-weight:700}
  .lists{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px}
  @media(max-width:760px){.lists{grid-template-columns:1fr}}
  .lbox{background:#10151c;border:1px solid var(--line);border-radius:8px;padding:9px}
  .lbox h4{margin:0 0 6px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px}
  .interp{margin-top:10px;padding:9px 11px;background:#10151c;border-left:3px solid var(--blue);border-radius:6px;color:#cdd9e5;font-size:13px}
  .muted{color:var(--muted)}
  .rollup-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @media(max-width:760px){.rollup-grid{grid-template-columns:1fr}}
  .gaprow{display:flex;align-items:center;gap:8px;margin:3px 0}
  .gaprow .gl{flex:1;font-size:13px}
  .gaprow .gb{height:14px;background:var(--red);border-radius:4px;min-width:2px}
  .gaprow .gc{width:30px;text-align:right;color:var(--muted);font-size:12px}
  .foot{color:var(--muted);font-size:12px;margin-top:24px;border-top:1px solid var(--line);padding-top:12px}
  .tagrow{margin-top:6px}
</style>
</head>
<body>
<div class="wrap">
  <h1>Upwork Profile Comparison — Analysis</h1>
  <div class="sub">Baseline (tentative profile) compared against each collected reference profile. Six signals per comparison: Tools &amp; Skills, each split into baseline-only / collected-only / shared.</div>

  <div class="tabs"><div class="tab active">Faizan K.</div></div>

  <div id="app"></div>

  <div class="foot">
    Extraction source: each profile's structured skills list (symmetric baseline ↔ collected). Tools = named technologies/products/languages; Skills = capabilities/methods. Normalized (lowercase, variant-collapsed) before set comparison. Shared = intersection; overlap ratio = shared / total distinct. Self-contained — no external calls.
  </div>
</div>

<script>
const DATA = __PAYLOAD__;
const esc = s => (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const id16 = u => { const m=(u||'').match(/~01[a-z0-9]{16}/); return m?m[0]:''; };

function metricCard(lbl, n, maxN, cls){
  const w = maxN>0 ? Math.round(100*n/maxN) : 0;
  return `<div class="metric"><div class="mlbl">${lbl}</div><div class="mn">${n}</div>
    <div class="bar"><i class="${cls}" style="width:${w}%"></i></div></div>`;
}
function stack(sig){
  const tot = sig.n_base_only+sig.n_coll_only+sig.n_shared || 1;
  const seg=(n,cls,t)=> n? `<span class="${cls}" style="width:${100*n/tot}%" title="${t}: ${n}">${n}</span>`:'';
  return `<div class="stack">${seg(sig.n_shared,'b-shared','shared')}${seg(sig.n_base_only,'b-base','baseline only')}${seg(sig.n_coll_only,'b-coll','collected only')}</div>`;
}
function lbox(title, items){
  const body = items.length ? items.map(x=>`<span class="pill">${esc(x)}</span>`).join(' ') : '<span class="muted">— none —</span>';
  return `<div class="lbox"><h4>${title} (${items.length})</h4>${body}</div>`;
}
function interp(t,s){
  const to=t.overlap_ratio, so=s.overlap_ratio;
  const lvl = r => r>=0.5?'high':r>=0.25?'moderate':'low';
  let msg = `${lvl(so)} skill overlap, ${lvl(to)} tool overlap. `;
  if(so>=0.4 && to<0.25) msg+='Same service space, different toolset — they compete on what they do, not the stack.';
  else if(to>=0.4 && so<0.25) msg+='Shared tooling but different positioning of services.';
  else if(to<0.15 && so<0.15) msg+='Largely different focus — limited direct competition.';
  else if(to>=0.4 && so>=0.4) msg+='Close competitor — overlaps on both stack and services.';
  else msg+='Partial overlap on both stack and services.';
  if(t.n_coll_only) msg += ` Tools they list that you don't: ${t.coll_only.slice(0,5).join(', ')}${t.coll_only.length>5?'…':''}.`;
  return msg;
}

function sixCards(t,s){
  const tmax = Math.max(t.n_base_only,t.n_coll_only,t.n_shared,1);
  const smax = Math.max(s.n_base_only,s.n_coll_only,s.n_shared,1);
  return `
  <div class="legend"><b>TOOLS</b> &nbsp; <span class="dot b-shared"></span>shared <span class="dot b-base"></span>baseline-only <span class="dot b-coll"></span>collected-only &nbsp;·&nbsp; overlap ${ (t.overlap_ratio*100).toFixed(0) }%</div>
  <div class="six">
    ${metricCard('Tools — baseline only', t.n_base_only, tmax, 'b-base')}
    ${metricCard('Tools — collected only', t.n_coll_only, tmax, 'b-coll')}
    ${metricCard('Tools — shared', t.n_shared, tmax, 'b-shared')}
  </div>
  ${stack(t)}
  <div class="lists">${lbox('Tools — shared', t.shared)}${lbox('Tools — collected only (they have, you don\\'t)', t.coll_only)}</div>
  <div class="lists" style="margin-top:8px">${lbox('Tools — baseline only (you have, they don\\'t)', t.base_only)}<div></div></div>

  <div class="legend" style="margin-top:14px"><b>SKILLS</b> &nbsp; <span class="dot b-shared"></span>shared <span class="dot b-base"></span>baseline-only <span class="dot b-coll"></span>collected-only &nbsp;·&nbsp; overlap ${ (s.overlap_ratio*100).toFixed(0) }%</div>
  <div class="six">
    ${metricCard('Skills — baseline only', s.n_base_only, smax, 'b-base')}
    ${metricCard('Skills — collected only', s.n_coll_only, smax, 'b-coll')}
    ${metricCard('Skills — shared', s.n_shared, smax, 'b-shared')}
  </div>
  ${stack(s)}
  <div class="lists">${lbox('Skills — shared', s.shared)}${lbox('Skills — collected only (they have, you don\\'t)', s.coll_only)}</div>
  <div class="lists" style="margin-top:8px">${lbox('Skills — baseline only (you have, they don\\'t)', s.base_only)}<div></div></div>
  `;
}

function gapPanel(title, rows, max){
  return `<div><h4 class="muted" style="margin:4px 0 8px">${title}</h4>` +
    rows.map(([lbl,n])=>`<div class="gaprow"><div class="gl">${esc(lbl)}</div><div class="gb" style="width:${Math.round(160*n/max)}px"></div><div class="gc">${n}</div></div>`).join('') +
    `</div>`;
}

function render(){
  const b = DATA.baseline, app = document.getElementById('app');
  // baseline card
  let h = `<div class="card baseline-card">
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div><div style="font-size:16px;font-weight:700">${esc(b.name)} — baseline (your tentative profile)</div>
      <div class="muted">${esc(b.title)}</div>
      <div class="muted">${esc(b.location)} · <span class="rate">${esc(b.hourly_rate)}</span> · <a href="${esc(b.url)}" target="_blank">${esc(b.url)}</a></div></div>
    </div>
    <div class="grid" style="margin-top:12px">
      <div class="stat"><div class="n">${DATA.n_collected}</div><div class="lbl">collected profiles</div></div>
      <div class="stat"><div class="n">${b.n_tools}</div><div class="lbl">baseline tools</div></div>
      <div class="stat"><div class="n">${b.n_skills}</div><div class="lbl">baseline skills</div></div>
      <div class="stat"><div class="n">${(DATA.avg_tool_overlap*100).toFixed(0)}%</div><div class="lbl">avg tool overlap</div></div>
      <div class="stat"><div class="n">${(DATA.avg_skill_overlap*100).toFixed(0)}%</div><div class="lbl">avg skill overlap</div></div>
    </div>
    <div class="tagrow"><b class="muted" style="font-size:12px">Your tools:</b><br>${b.tools.map(x=>`<span class="pill tool">${esc(x)}</span>`).join(' ')}</div>
    <div class="tagrow"><b class="muted" style="font-size:12px">Your skills:</b><br>${b.skills.map(x=>`<span class="pill skill">${esc(x)}</span>`).join(' ')}</div>
  </div>`;

  // rollup / gaps
  const ru = DATA.rollup;
  const maxT = Math.max(...ru.tools_coll_only.map(x=>x[1]),1);
  const maxS = Math.max(...ru.skills_coll_only.map(x=>x[1]),1);
  h += `<h2>Gap roll-up — most common across the 100 collected profiles but missing from your profile</h2>
   <div class="card"><div class="sub" style="margin-bottom:10px">These are candidate additions: tools &amp; skills competitors list frequently that aren't on your profile. (Count = how many of the 100 list it.)</div>
   <div class="rollup-grid">
     ${gapPanel('Missing TOOLS (collected-only, by frequency)', ru.tools_coll_only.slice(0,15), maxT)}
     ${gapPanel('Missing SKILLS (collected-only, by frequency)', ru.skills_coll_only.slice(0,15), maxS)}
   </div></div>`;

  // also most-shared (validation that the right peers were collected)
  const shT = Math.max(...ru.tools_shared.map(x=>x[1]),1), shS = Math.max(...ru.skills_shared.map(x=>x[1]),1);
  h += `<h2>Most-shared with the collected set (your strengths that peers also have)</h2>
   <div class="card"><div class="rollup-grid">
     ${gapPanel('Shared TOOLS (by frequency)', ru.tools_shared.slice(0,12), shT)}
     ${gapPanel('Shared SKILLS (by frequency)', ru.skills_shared.slice(0,12), shS)}
   </div></div>`;

  // controls + comparisons
  const kws = [...new Set(DATA.comparisons.map(c=>c.matched_keyword))].sort();
  h += `<h2>Per-profile comparisons (${DATA.n_collected})</h2>
   <div class="controls">
     <input id="q" placeholder="Search name / title…" style="min-width:220px">
     <select id="kw"><option value="">All keywords</option>${kws.map(k=>`<option>${esc(k)}</option>`).join('')}</select>
     <select id="sort">
       <option value="tool_desc">Sort: tool overlap ↓</option>
       <option value="skill_desc">Sort: skill overlap ↓</option>
       <option value="combo_desc">Sort: combined overlap ↓</option>
       <option value="name">Sort: name A–Z</option>
     </select>
     <span class="muted" id="count"></span>
   </div>
   <div id="cmps"></div>`;
  app.innerHTML = h;

  const cmpsEl = document.getElementById('cmps');
  function draw(){
    const q=(document.getElementById('q').value||'').toLowerCase();
    const kw=document.getElementById('kw').value;
    const sort=document.getElementById('sort').value;
    let rows = DATA.comparisons.filter(c=>{
      const hay=(c.name+' '+c.title).toLowerCase();
      return (!q||hay.includes(q)) && (!kw||c.matched_keyword===kw);
    });
    rows.sort((a,bb)=>{
      if(sort==='name') return (a.name||'').localeCompare(bb.name||'');
      if(sort==='skill_desc') return bb.skills.overlap_ratio-a.skills.overlap_ratio;
      if(sort==='combo_desc') return (bb.tools.overlap_ratio+bb.skills.overlap_ratio)-(a.tools.overlap_ratio+a.skills.overlap_ratio);
      return bb.tools.overlap_ratio-a.tools.overlap_ratio;
    });
    document.getElementById('count').textContent = rows.length+' shown';
    cmpsEl.innerHTML = rows.map(c=>`
      <details class="cmp">
        <summary>
          <span class="ctitle">${esc(c.name)} — <span class="muted">${esc(c.title)}</span></span>
          <span class="kw">${esc(c.matched_keyword)}</span>
          <span class="rate">${esc(c.hourly_rate)}</span>
          <span class="muted" style="font-size:11px">T ${(c.tools.overlap_ratio*100).toFixed(0)}% · S ${(c.skills.overlap_ratio*100).toFixed(0)}%</span>
        </summary>
        <div class="body">
          <div class="muted" style="font-size:12px;margin-bottom:6px"><a href="${esc(c.url)}" target="_blank">${esc(id16(c.url))}</a></div>
          ${sixCards(c.tools,c.skills)}
          <div class="interp">${esc(interp(c.tools,c.skills))}</div>
        </div>
      </details>`).join('');
  }
  document.getElementById('q').addEventListener('input',draw);
  document.getElementById('kw').addEventListener('change',draw);
  document.getElementById('sort').addEventListener('change',draw);
  draw();
}
render();
</script>
</body>
</html>
"""

html_out = HTML.replace("__PAYLOAD__", payload)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(html_out)
print("wrote", os.path.abspath(OUT), len(html_out), "bytes")
