window.currentMapText = ""; // raw map text only

function setMapText(mapText) {
  window.currentMapText = String(mapText || "").replace(/\r\n?/g, "\n");
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findBlocksByExactId(text, id) {
  if (id == null) return [];
  const s = String(text || "");
  const target = String(id).trim();
  const results = [];
  const headerPattern = /(^|\n)[ \t]*\[[^\]\n]+\]/g; // any header at start of a line
  let searchFrom = 0;

  while (true) {
    // Find the exact header
    const exactNeedle = `\n[${target}]`;
    let hStart = s.indexOf(exactNeedle, searchFrom);
    let headerPrefixLen = 1; // default = "\n"

    // Also handle if the very file starts with the header (no leading \n)
    if (results.length === 0 && searchFrom === 0 && hStart !== 0 && s.startsWith(`[${target}]`)) {
      hStart = 0;
      headerPrefixLen = 0;
    }

    // If not found, try forgiving header: spaces inside the brackets
    if (hStart === -1) {
      const forgiving = new RegExp(`(^|\\n)[ \\t]*\\[\\s*${escapeRegExp(target)}\\s*\\]`, "g");
      forgiving.lastIndex = searchFrom;
      const m = forgiving.exec(s);
      if (!m) break;
      hStart = m.index + m[1].length;        // position at '['
      headerPrefixLen = 1;                    // we consumed \n in group 1
    }

    // Find end of this header line (start of body)
    const afterHeader = s.indexOf("\n", hStart);
    const bodyStart = afterHeader === -1 ? s.length : afterHeader + 1;

    // Find the next header at the start of a line to delimit the body
    headerPattern.lastIndex = bodyStart;
    const next = headerPattern.exec(s);
    const bodyEnd = next ? next.index + (next[0].startsWith("\n") ? 1 : 0) : s.length;

    const body = s.slice(bodyStart, bodyEnd).replace(/\s+$/,"");
    results.push({ id: target, body });

    // Move search forward; avoid infinite loops on the same header
    searchFrom = bodyEnd;
  }
  return results;
}

// Parse body to ordered key=val list + a last-wins object view
function parseKeyValBodyOrdered(body) {
  const lines = String(body || "").split(/\r?\n/);
  const entries = [];
  const obj = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*([^=]+?)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1].trim();
    const value = m[2].trim();
    entries.push({ key, value, line: i + 1 });
    obj[key] = value; // last one wins
  }
  return { entries, obj };
}

// Merge ALL occurrences of [ID] in order: earlier first, later overrides
function getMergedEntriesForId(mapText, id) {
  const blocks = findBlocksByExactId(mapText, id);
  const mergedEntries = [];
  const mergedObj = {};
  blocks.forEach((blk, blkIndex) => {
    const { entries } = parseKeyValBodyOrdered(blk.body);
    entries.forEach(en => {
      mergedEntries.push({ ...en, sourceBlockIndex: blkIndex });
      mergedObj[en.key] = en.value;
    });
  });
  return { entries: mergedEntries, obj: mergedObj, occurrences: blocks.length };
}

// Extract a plausible ID token from a value like "ABC123, something"
function extractIdToken(maybeId) {
  if (maybeId == null) return null;
  const m = String(maybeId).match(/[^\s,;()]+/);
  return m ? m[0] : null;
}

function parseTaskForceUnitsFromObj(tfObj) {
  return Object.keys(tfObj)
    .filter(k => /^\d+$/.test(k))
    .map(k => {
      const [count, type] = String(tfObj[k]).split(",").map(s => s.trim());
      const n = Number(count);
      return (!type || Number.isNaN(n)) ? null : `${n} × ${type}`;
    })
    .filter(Boolean);
}

function taskForcePretty(tfObj, tfId) {
  const units = parseTaskForceUnitsFromObj(tfObj);
  if (units.length) return units.join(", ");
  const name = tfObj.Name || tfObj.name || "";
  return `${name ? name + " " : ""}(ID ${tfId})`;
}

function resolveTeamBundle(teamId) {
  const mapText = window.currentMapText;
  const team = getMergedEntriesForId(mapText, teamId);
  if (!team.entries.length) {
    return { team, script: null, taskforce: null };
  }

  const t = team.obj;
  const scriptId = extractIdToken(t.Script || t.ScriptTypeId || t.ScriptId);
  const tfId     = extractIdToken(t.TaskForce || t.TaskForceId || t.Taskforce);

  const script   = scriptId ? getMergedEntriesForId(mapText, scriptId) : null;
  const taskforce= tfId     ? getMergedEntriesForId(mapText, tfId)     : null;

  return { team, script, taskforce };
}

function colorizeVal(v) {
  const s = String(v).trim();
  if (/^(no|false|0)$/i.test(s)) {
    return `<span style="color:#f44336;">${s}</span>`;
  }
  if (/^(yes|true|1)$/i.test(s)) {
    return `<span style="color:#17cb49;">${s}</span>`;
  }
  return `<span>${s}</span>`;
}

function renderKvLines(id, entries) {
  const head = id ? `[${id}]` : '';
  const rows = entries.map(e => `${e.key}=${colorizeVal(e.value)}`);
  return [head, ...rows].filter(Boolean).join('\n');
}

function renderPanel(title, id, entries) {
  // Fallback to empty array if no entries
  const safeEntries = Array.isArray(entries) ? entries : [];

  return `
    <div class="peek-col" style="
      flex: 1 1 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
      border-left: 1px solid var(--input-border-dark);
    ">
      <div style="
        padding: 4px 8px;
        border-bottom: 1px solid var(--input-border-dark);
        letter-spacing: .5px;
        font-weight: 700;
        background: var(--canvas-bg);
      ">
        ${title}
      </div>

      <div style="
        padding: 6px 8px;
        border-bottom: 1px solid var(--input-border-dark);
        font-family: var(--mono, "Inter", sans-serif);
        font-size: 10px;
        background: var(--canvas-bg);
      ">
        ${id ? `[${id}]` : `(not set)`}
      </div>

      <div style="
        flex: 1;
        overflow: auto;
        font-family: var(--mono, "Inter", sans-serif);
        font-size: 10px;
        line-height: 1.35;
        padding: 8px;
      ">
        ${safeEntries.map(e => `
          <div style="display:flex;justify-content:space-between;gap:8px;">
            <span>${e.key}</span>
            <span>${colorizeVal(e.value)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function ensureteamInfoEl() {
  let el = document.getElementById("teamInfo");
  if (!el) {
    el = document.createElement("div");
    el.id = "teamInfo";
    el.style.position = "absolute";
    el.style.display = "none";
    el.style.zIndex = 9999;
    el.style.background = "transparent";
    el.style.color = "inherit";
    el.style.userSelect = "text";
    el.style.padding = "0";
    el.style.border = "none";
    el.style.boxShadow = "none";
	
    el.style.width = "auto";
    el.style.height = "auto";
    document.body.appendChild(el);
  }
  return el;
}

function hideteamInfo() {
  const el = document.getElementById('teamInfo');
  if (!el) return;
  el.style.display = 'none';
  el.innerHTML = '';
}

function showteamInfoRaw(teamId, anchorEvent) {
  hideteamInfo(); // remove old panel if open

  const el = document.createElement("div");
  el.id = "teamInfo";
  el.style.position = "absolute";
  el.style.zIndex = 9999;

  const cleanId = String(teamId).trim();
  const bundle = resolveTeamBundle(cleanId);

  const scriptId = bundle.team.obj
    ? extractIdToken(bundle.team.obj.Script || bundle.team.obj.ScriptTypeId || bundle.team.obj.ScriptId) || ""
    : "";
  const tfId = bundle.team.obj
    ? extractIdToken(bundle.team.obj.TaskForce || bundle.team.obj.TaskForceId || bundle.team.obj.Taskforce) || ""
    : "";

  const scriptEntries = (bundle.script && bundle.script.entries.length)
    ? bundle.script.entries
    : [{ key: "(not set)", value: "" }];

  const tfEntries = (bundle.taskforce && bundle.taskforce.entries.length)
    ? bundle.taskforce.entries
    : [{ key: "(not set)", value: "" }];

// Unified panel
  function renderPeekColumn(title, id, entries) {
    const safe = Array.isArray(entries) ? entries : [{ key: "(not set)", value: "" }];
    const idLabel = id ? `[${id}]` : `(not set)`;
  
    return `
      <div style="
        flex:1 1 320px; min-width:280px; display:flex; flex-direction:column;
        border-right:1px solid var(--input-border-dark);
      ">
        <div style="padding:6px 10px; font-weight:600; letter-spacing:.4px;
                    border-bottom:1px solid var(--input-border-dark);">
          ${title}
        </div>
        <div style="padding:6px 10px; font-family:var(--mono, "Inter", sans-serif);; font-size:10px;
                    font-weight:600; border-bottom:1px solid var(--input-border-dark);">
          ${idLabel}
        </div>
        <div style="flex:1; overflow:auto; padding:8px;
                    font-family:var(--mono, "Inter", sans-serif);; font-size:10px; line-height:1.35;">
          ${safe.map(e => `
            <div style="display:flex; justify-content:space-between; gap:8px;">
              <span>${e.key}</span><span>${colorizeVal(e.value)}</span>
            </div>`).join("")}
        </div>
      </div>
    `;
  }
  
  el.innerHTML = `
    <div class="peek-header" style="
      display:flex; align-items:center; justify-content:space-between;
      font-weight:600; padding:6px 10px;
      border-bottom:1px solid var(--input-border-dark);
      cursor:move; user-select:none;">
      <div>TeamID: <span class="peek-val">${cleanId}</span></div>
      <button class="peek-close" aria-label="Close" title="Close" style="
        border:none; background:transparent; color:inherit; cursor:pointer; font-size:18px;">×</button>
    </div>
  
    <div style="
      display:flex; gap:0;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 32px);
      width: 1080px; /* wider default so columns breathe */
      height: 64vh;  /* reasonable height; scrolls inside columns if needed */
      background: var(--canvas-bg);
      border:1px solid var(--input-border-dark);
      border-radius:6px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.4);
      overflow:hidden;">
      ${renderPeekColumn("TeamType", cleanId, bundle.team.entries)}
      ${renderPeekColumn("ScriptType", scriptId, scriptEntries)}
      ${renderPeekColumn("TaskForce", tfId, tfEntries)}
    </div>
  `;

  document.body.appendChild(el);

  const closeBtn = el.querySelector('.peek-close');
  if (closeBtn) closeBtn.addEventListener('click', hideteamInfo);

  const rect = el.getBoundingClientRect();
  el.style.left = `${Math.max(0, (window.innerWidth - rect.width) / 2)}px`;
  el.style.top = `${Math.max(0, (window.innerHeight - rect.height) / 2)}px`;

  makeDraggable(el, '.peek-header');
}

function hideteamInfo() {
  const el = document.getElementById("teamInfo");
  if (el) el.remove();
}

function makeDraggable(containerEl, handleSelector) {
  const handle = containerEl.querySelector(handleSelector) || containerEl;
  let sx = 0, sy = 0, ox = 0, oy = 0, down = false;

  const onDown = (e) => {
    down = true;
    const rect = containerEl.getBoundingClientRect();
    ox = rect.left;
    oy = rect.top;
    sx = (e.touches ? e.touches[0].clientX : e.clientX);
    sy = (e.touches ? e.touches[0].clientY : e.clientY);
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!down) return;
    const cx = (e.touches ? e.touches[0].clientX : e.clientX);
    const cy = (e.touches ? e.touches[0].clientY : e.clientY);
    containerEl.style.left = (ox + (cx - sx)) + "px";
    containerEl.style.top  = (oy + (cy - sy)) + "px";
  };
  const onUp = () => { down = false; };

  handle.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  // touch (?)
  handle.addEventListener('touchstart', onDown, {passive:false});
  window.addEventListener('touchmove', onMove, {passive:false});
  window.addEventListener('touchend', onUp);
}

// Clickable IDs
function makeTeamIdSpan(id) {
  const clean = String(id).trim();
  const span = document.createElement("span");
  span.className = "team-link";
  span.dataset.teamId = clean;
  span.textContent = clean;
  span.style.color = "var(--color-accent)";
  span.style.cursor = "pointer";
  span.style.textDecoration = "underline";
  span.addEventListener("click", function (e) { showteamInfoRaw(clean, e); });
  return span;
}

function regenerateEdges() {
    // verify raw when regenerating edges
    if (typeof raw === 'undefined') {
        return;
    }
    // modify the raw with the new values
    // this is very ugly because instead I should try to get existing one from index
    // not to mention i bet there is an easier way to do this
    if (localStorage.getItem('theme') == 'light') {
        for (var i = 0; i < raw.edges.length; i++) { 
            if (raw.edges[i].color === '#17CB49') {
	        raw.edges[i].color = '#129e36';
	    }
            else if (raw.edges[i].color === '#f74141') {
	        raw.edges[i].color = '#d12f2f';
	    }
            else if (raw.edges[i].color === '#FFEE22') {
	        raw.edges[i].color = '#d1ba15';
	    }
	    else if (raw.edges[i].color === '#168FFF') {
	        raw.edges[i].color = '#1c6fdb';
	    }
            else if (raw.edges[i].color === '#FF9F2D') {
	        raw.edges[i].color = '#e67e22';
	    }
	}
	for (var i = 0; i < raw.nodes.length; i++) {
	    if (raw.nodes[i].shape === 'triangle') {
		raw.nodes[i].color.background = '#FFB2FF';
                raw.nodes[i].color.border = '#990099';
		raw.nodes[i].color.highlight.border = '#990099'
	    }
	}
    }
    if (localStorage.getItem('theme') == 'dark') {
        for (var i = 0; i < raw.edges.length; i++) { 
            if (raw.edges[i].color === '#129e36') {
	        raw.edges[i].color = '#17CB49';
	    }
            else if (raw.edges[i].color === '#d12f2f') {
	        raw.edges[i].color = '#f74141';
	    }
            else if (raw.edges[i].color === '#d1ba15') {
	        raw.edges[i].color = '#FFEE22';
	    }
	    else if (raw.edges[i].color === '#1c6fdb') {
	        raw.edges[i].color = '#168FFF';
	    }
            else if (raw.edges[i].color === '#e67e22') {
	        raw.edges[i].color = '#FF9F2D';
	    }
	}
	for (var i = 0; i < raw.nodes.length; i++) {
	    if (raw.nodes[i].shape === 'triangle') {
		raw.nodes[i].color.background = '#CC33CC';
                raw.nodes[i].color.border = '#FF00FF';
		raw.nodes[i].color.highlight.border = '#FF00FF'
	    }
	}
    }
	
    // generate everything with the new values
    generateNetwork(raw);
    
    /*
    if (!nodesView) return;

    const updatedEdges = [];

    for (const node of nodesView.get()) {
        const id = node.id;

        if (node.house) {
            // Triggers: rewire links
            const raw = nodesData.get(id);
            const actions = raw?.actions || [];
            const eventsList = raw?.events || [];

            for (const action of actions) {
                switch (action.type) {
                    case 12:
                        updatedEdges.push({from: id, to: action.p[1], arrows: "to", color: getTriggerColor('destroy')});
                        break;
                    case 22:
                        updatedEdges.push({from: id, to: action.p[1], arrows: "to", color: getTriggerColor('force')});
                        break;
                    case 53:
                        updatedEdges.push({from: id, to: action.p[1], arrows: "to", color: getTriggerColor('enable')});
                        break;
                    case 54:
                        updatedEdges.push({from: id, to: action.p[1], arrows: "to", color: getTriggerColor('disable')});
                        break;
                }
            }

            for (const event of eventsList) {
                switch (event.type) {
                    case 36:
                        updatedEdges.push({from: 'L' + event.p[0], to: id, arrows: "to", color: getTriggerColor('enable'), dashes: true});
                        break;
                    case 37:
                        updatedEdges.push({from: 'L' + event.p[0], to: id, arrows: "to", color: getTriggerColor('disable'), dashes: true});
                        break;
                    case 27:
                        updatedEdges.push({from: 'G' + event.p[0], to: id, arrows: "to", color: getTriggerColor('enable'), dashes: true});
                        break;
                    case 28:
                        updatedEdges.push({from: 'G' + event.p[0], to: id, arrows: "to", color: getTriggerColor('disable'), dashes: true});
                        break;
                }
            }

            if (raw.link && raw.link.trim() !== '<none>') {
                updatedEdges.push({from: id, to: raw.link, arrows: "to;from", color: getTriggerColor('link')});
            }
        }
    }

    // Re-apply the edges
    network.setData({
        nodes: nodesView,
        edges: updatedEdges
    });
    */
}

function getThemedNetworkOptions() {
    const css = getComputedStyle(document.body);

    return {
        interaction: {
            navigationButtons: false,
            keyboard: false
        },
        physics: {
            enabled: true,
            barnesHut: {
                springConstant: 0.05,
                centralGravity: 0.4
            }
        },
        layout: {
            hierarchical: {
                enabled: false
            }
        },
        edges: {
            width: 3,
            selectionWidth: w => w * 2,
            length: 150,
            color: {
                color: css.getPropertyValue('--edge-color-default').trim(),
                highlight: css.getPropertyValue('--edge-color-highlight').trim(),
                hover: css.getPropertyValue('--edge-color-hover').trim()
            }
        },
        nodes: {
            widthConstraint: { maximum: 200 },
            color: {
                background: css.getPropertyValue('--node-bg').trim(),
                border: css.getPropertyValue('--node-border').trim(),
                highlight: {
                    background: css.getPropertyValue('--node-bg-highlight').trim(),
                    border: css.getPropertyValue('--node-border-highlight').trim()
                },
                hover: {
                    background: css.getPropertyValue('--node-bg-hover').trim(),
                    border: css.getPropertyValue('--node-border-hover').trim()
                }
            },
            font: {
                color: css.getPropertyValue('--font-color').trim()
            }
        }
    };
}

function getThemedTreeOptions() {
    const css = getComputedStyle(document.body);

    return {
        layout: {
            hierarchical: {
                enabled: true,
                direction: 'LR',
                sortMethod: 'hubsize',
            }
        },
        physics: {
            enabled: true,
            hierarchicalRepulsion: {
                avoidOverlap: 0.5
            }
        },
        edges: {
            width: 3,
            selectionWidth: w => w * 2,
            length: 150,
            color: {
                color: css.getPropertyValue('--edge-color-default').trim(),
                highlight: css.getPropertyValue('--edge-color-highlight').trim(),
                hover: css.getPropertyValue('--edge-color-hover').trim(),
            }
        },
        nodes: {
            widthConstraint: { maximum: 200 },
            color: {
                background: css.getPropertyValue('--node-bg').trim(),
                border: css.getPropertyValue('--node-border').trim(),
                highlight: {
                    background: css.getPropertyValue('--node-bg-highlight').trim(),
                    border: css.getPropertyValue('--node-border-highlight').trim()
                },
                hover: {
                    background: css.getPropertyValue('--node-bg-hover').trim(),
                    border: css.getPropertyValue('--node-border-hover').trim()
                }
            },
            font: {
                color: css.getPropertyValue('--font-color').trim()
            }
        },
        background: {
            color: css.getPropertyValue('--canvas-bg').trim()
        }
    };
}

var container = document.getElementById('nodeGraph');
var focusOptions = {
    scale: 1,
    offset: {x: 0, y: 0},
    animation: {duration: 1000,easingFunction: "easeInOutQuad"},
};

// Returns the CSS custom property value for a given trigger type
// Dynamically assigns colors depending on the active theme
const getTriggerColor = (type) => {
    const root = getComputedStyle(document.body);
    switch (type) {
        case 'enable': return root.getPropertyValue('--trigger-enable').trim();
        case 'disable': return root.getPropertyValue('--trigger-disable').trim();
        case 'destroy': return root.getPropertyValue('--trigger-destroy').trim();
        case 'force': return root.getPropertyValue('--trigger-force').trim();
        case 'link': return root.getPropertyValue('--trigger-link').trim();
        case 'global': return root.getPropertyValue('--variable-global').trim();
        default: return '#cccccc'; // Falls back to a neutral color if the type is unrecognized
    }
};


function createWelcomeNetworkData() {
    return {
        nodes: [
            { id: 0, label: "Load a Red Alert 2 map file", shape: "box" },
            { id: 1, label: "to see the triggers!", shape: "box" },
            { id: 2, label: "Drag and drop also works!", shape: "box" }
        ],
        edges: [
            { from: 0, to: 1, arrows: "to", length: 250, color: getTriggerColor('enable') },
            { from: 2, to: 1, arrows: "to", length: 250, color: getTriggerColor('enable') },
            { from: 0, to: 2, arrows: "to;from", length: 250, color: getTriggerColor('link') }
        ]
    };
}

var networkOptionsDefault = getThemedNetworkOptions()


var networkOptionsTree = {
    layout:{
        hierarchical:{
            enabled: true,
            direction: 'LR',
            sortMethod: 'hubsize',  // hubsize, directed
            // directed is the natural choice for hierachy layout, however, looping confuse the graph algorithm and produce ugly graph
            // using hubsize by default, but directed is not out of the question yet in future version
        }
    },
    physics:{
        enabled: true,
        hierarchicalRepulsion: {
            avoidOverlap: 0.5
        }
    }
}

// global options for filters
var nodeFilterOptions = {
    triggers: true,
    variables: true,
    easy: true,
    normal: true,
    hard: true
};

// for easy normal hard check box
document.getElementById('toggleEasy').onchange = quickFilter('easy');
document.getElementById('toggleNormal').onchange = quickFilter('normal');
document.getElementById('toggleHard').onchange = quickFilter('hard');
function quickFilter(str){
    return function (e){
        nodeFilterOptions[str] = e.target.checked;
        nodesView.refresh();
    };
}

// global physics
var pc = document.getElementById("togglePhysics");
pc.addEventListener("change", (e) =>{
    network.setOptions({physics:{enabled:e.target.checked}});
});
var sb = document.getElementById('btnAbort');
sb.addEventListener("click",(e)=>{
    network.stopSimulation();
});
var tree = document.getElementById('toggleTree');
tree.addEventListener('change', (e) => {
    const themedOptions = e.target.checked ? getThemedTreeOptions() : getThemedNetworkOptions();
    network.setOptions(themedOptions);

    document.getElementById('togglePhysics').checked = true;
    network.fit();
});

document.getElementById("btnCenterView").addEventListener("click", function () {
    network.fit();
});


//async load final alert events/actions data
var fadata = new XMLHttpRequest();

fadata.onreadystatechange = function () {
    if (this.readyState == 4 && this.status == 200) {
        fadata = JSON.parse(fadata.responseText);
        events = fadata.events;
        actions = fadata.actions;
    }
};
fadata.open('GET','./fadata.json',true);
fadata.send();
var events = [];
var actions = [];


//on load initialization
window.onload = function() {
    document.getElementById('searchMenu').value = '';
    var mapFileInput = document.getElementById('mapFileInput');

    mapFileInput.addEventListener('change', function(e) {
        var file = mapFileInput.files[0];

        var reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('searchMenu').value = '';
            network.destroy();
            var info = document.getElementById('info');
            info.innerHTML = 'File detected, attempting to load...';
            try{
                raw = parseText(e.target.result);
                try{
                    generateNetwork(raw);
                }catch(error){
                    alert('Unable to generate network graph!');
                    console.log(error);
                    info.innerHTML = 'File loading failed.';
                }
            }catch(error){
                alert('Map file parse Error!');
                console.log(error);
                info.innerHTML = 'File loading failed.';
            } 
        }
        reader.readAsText(file, 'UTF-8');
        
        reader.onerror = error=>console.log(error);
	});
}


 
container.ondragover = function(e){
    e.preventDefault();
};
container.ondrop = function(e) {
    
    var mapFileInput = document.getElementById('mapFileInput');
    mapFileInput.files = e.dataTransfer.files;
    const event = new Event('change');
    mapFileInput.dispatchEvent(event);
    e.preventDefault();
    
}

// search filter function
function searchFilterFunc(){
    var input = document.getElementById('searchMenu');
    var filter = input.value.toLowerCase();
    var info = document.getElementById('info');
    
    var nl = document.getElementById('triggerList')
    nl = nl.getElementsByTagName('div');
    var info = document.getElementById('info');
    for(i=0;i<nl.length;i++){
        
        if((nl[i].innerHTML + nl[i].inner_id).toLowerCase().indexOf(filter)>-1){
            nl[i].style.display = "";
        }else{
            nl[i].style.display = "none";
        }
    }
    
}

// receive an object and populate information box
function displayInfo(raw){
    var info = document.getElementById('info');
    while(info.hasChildNodes()){
        info.removeChild(info.childNodes[0]);
    }
    if(typeof(raw)=='string'){
        info.innerHTML = raw;
        return;
    } 
    // Triggers:
    if(raw.house){
        // ID and Label
        var d0 = document.createElement('div');
        d0.innerHTML = `
            <div class='listItem'>Name:&nbsp;${raw.label}</div>
            <div class='listItem'>ID:&nbsp;${raw.id}</div>
            `;
        
        var d1 = document.createElement('details');
        var s1 = document.createElement('summary');
        s1.innerHTML = 'Basic Info';
        d1.appendChild(s1);
        d1.open = true;
        const tags = raw.tags.join(',&nbsp')
        repeatType = raw.repeat==0 ? 'one time OR' : raw.repeat==1 ? 'one time AND' : 'repeating OR' ;
        d1.innerHTML +=  `
            <div class='listItem'>House: ${raw.house}</div> 
            <div class='listItem'>Repeat: ${raw.repeat} (${repeatType})</div>
            <div class='listItem'>Tags: ${tags} </div>`
        if(raw.link.trim() != '<none>'){
            console.log(raw.link);
            d1.innerHTML +=  `
            <div class='listItem'>Link Trigger: ${raw.link}</div>`
        }
        easy = raw.easy?'green':'red';
        normal = raw.normal?'green':'red';
        hard = raw.hard?'green':'red';
        disabled = raw.disabled?'red':'green';
        d1.innerHTML += `<div class='listItem'>Difficulty:&nbsp;<span class='${easy}'>Easy</span>&nbsp;&nbsp;<span class='${normal}'>Normal</span>&nbsp;&nbsp;<span class='${hard}'>Hard</span></div>`;
        d1.innerHTML += `<div class='listItem'>Disabled:&nbsp;<span class='${disabled}'>${raw.disabled?"True":"False"}</span></div>`;
        
        // Events
        var d2 = document.createElement('details');
        var s2 = document.createElement('summary');
        s2.innerHTML = `Events`;
        d2.appendChild(s2);
        d2.open = true;

        for(var i=0;i<raw.events.length;i++){
            var t = raw.events[i].type;
            var d = document.createElement('div');
            d.className = 'listItem';
            d.innerHTML += `Event ${i}: ${events[t].name}`;
            d.title = `${t}: ${events[t].description}`;
            // Check if the event type has more than 2 variables in its parameter
            if(events[t].p[0] > 0){
                d.innerHTML += ` ${raw.events[i].p[0]} ${raw.events[i].p[1]}`;
            }else{
                d.innerHTML += ` ${raw.events[i].p[0]}`
            }
            d2.appendChild(d);
        }

        // Actions
        var d3 = document.createElement('details');
        var s3 = document.createElement('summary');
        s3.innerHTML = `Actions`;
        d3.appendChild(s3);
        d3.open = true;
        for (var i = 0; i < raw.actions.length; i++) {
            var tRaw = raw.actions[i].type;
            var tNum = Number(tRaw);
            var t = tRaw;
            var d = document.createElement('div');
            d.className = 'listItem';
            d.title = `${t}: ${actions[t].description}`;

            // Base label
            var labelSpan = document.createElement('span');
            labelSpan.textContent = `Action ${i}: ${actions[t].name}`;
            d.appendChild(labelSpan);
			
            var clickableActionIds = new Set([4, 5, 7, 80, 104, 107]);
            for (j = 0; j < 7; j++) {
                if (actions[t].p[j] > 0) {
                    d.appendChild(document.createTextNode(' '));
                    if (j == 6) {
                        var wpVal = raw.actions[i].p[j];
                        d.appendChild(document.createTextNode(`@${wp(wpVal)}`));
                        continue;
                    }
            
                    var val = String(raw.actions[i].p[j]);
            
                    // Make all parameters clickable
                    if (clickableActionIds.has(tNum)) {
                        d.appendChild(makeTeamIdSpan(val));
                    } else {
                        d.appendChild(document.createTextNode(val));
                    }
                }
            }
            d3.appendChild(d);
        }
        info.appendChild(d0);
        info.appendChild(d1);
        info.appendChild(d2);
        info.appendChild(d3);
		
    }else{
        info.innerHTML = `
            Variable <br> 
            Name:&nbsp;${raw.label}<br>
            ID:&nbsp;${raw.id}<br>
            Initial Value:&nbsp;${raw.initValue}`;
    
    }
}

// receive nodes/edge object and generate network
function generateNetwork(raw) {
    var info = document.getElementById('info');
    info.innerHTML = `
    Parse complete, generating network graph. <br> 
    <div class='yellow'> Warnings: </div>
    <div> ${parseWarning(raw.warning)} </div>`;
    var warningText = parseWarning(raw.warning);
    var nodes = raw.nodes;
    var edges = raw.edges;
    const nodes_index = {};
    var L = document.getElementById('triggerList');
    L.innerHTML = '';
    nodesData = new vis.DataSet(nodes);

    const nodesFilter = (node) => {
        /**
         * filter flow:
         * triggers
         *     1 check if trigger is in filter, true -> step 3, false -> step 2
         *     2 check if it's a neighbour of variable, true -> step 3, false -> return false
         *     3 check if any the the trigger difficulty match the filter option, true -> return true, false -> return false
         * variables
         *     just check if variable is in filter
         */
        // triggers
        if(node.house != undefined){
            if(!nodeFilterOptions.triggers){
                var flag = true;
                for(var item of node.neighbour){
                    if(nodesData.get(item).house == undefined){
                        flag = false;
                        break;
                    }
                }
                if(flag) return false;
            }
            return (node.easy && nodeFilterOptions.easy) || (node.normal && nodeFilterOptions.normal) || (node.hard && nodeFilterOptions.hard);
        }else{
            return nodeFilterOptions.variables;

        }
        
    };
    nodesView = new vis.DataView(nodesData,{filter:nodesFilter});
   
    var data = {
        nodes: nodesView,
        edges: edges
    };  
    
    document.getElementById('togglePhysics').checked = true;
    document.getElementById('toggleTree').checked = false;

    network = new vis.Network(container, data, getThemedNetworkOptions());
    
    network.on("click", function (params) {
        if(params.nodes.length > 0){
            const n_id = params.nodes[0];
            displayInfo(nodesView.get(n_id));
        }else if(params.nodes.length == 0){
            displayInfo(warningText);
        }
    });

    network.on("doubleClick", function (params) {
        if(params.nodes.length > 0){
            network.focus(params.nodes[0],focusOptions);
        }
    });

    // loading progress and info display
    network.on("stabilizationProgress", function (params) {
        info.innerText = "Loading: " + Math.round(params.iterations / params.total * 100) + '%\n';
        info.innerText += `Assets: \nTriggers & Variables: ${nodes.length} \nLinks: ${edges.length}`
        if(raw.warning.length > 0){
            info.innerHTML += `
                <br> <div class='yellow'> Warnings: (Check your map for potential error)</div>
                <div> ${parseWarning(raw.warning)} </div>`;
        }
    });

    network.once("stabilizationIterationsDone", function () {
        
        // info box
        info.innerText = `100% Loaded. \nAssets: \nTriggers & Variables: ${nodes.length} \nLinks: ${edges.length} `;
        if(raw.warning.length>0){
            info.innerHTML += `
                <br> <div class='yellow'> Warnings: (Check your map for potential error) </div>
                <div> ${parseWarning(raw.warning)} </div>`;
        }
        // populate node list
        var nl = document.getElementById('triggerList');
        for(var i=0;i<nodes.length;i++){
            var d = document.createElement('div');
            d.className = "listItem";
            d.title = "Trigger ID: " + nodes[i].id;
            d.inner_id = nodes[i].id;
            d.innerHTML = nodes[i].label;
            d.addEventListener("click",function (e){
                displayInfo(nodesData.get(this.inner_id));
                // only focus and select when the node is in current view
                if(nodesFilter(nodesData.get(this.inner_id))){
                    network.focus(this.inner_id,focusOptions);
                    network.setSelection({nodes:[this.inner_id]});
                }
                
            });
            nl.appendChild(d); 
        }
    });
    
};

/**
 * @param {[]} data, the arrays of warning message
 * @return {String} an HTML string representing the warning message
 * input should be an array consist of warning messange,
 * warning information can get complex in the future, where each array element contains type of error and the detailed information for each error
 * 
*/ 
function parseWarning(data){
    return data.join('<br>')
}

// code that I shamelessly copy from stack overflow
function parseINIString(data){
    var regex = {
        section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
        param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
        comment: /^\s*;.*$/
    };
    var value = {};
    var lines = data.split(/[\r\n]+/);
    var section = null;
    lines.forEach(function(line){
        if(regex.comment.test(line)){
            return;
        }else if(regex.param.test(line)){
            var match = line.match(regex.param);
            if(section){
                value[section][match[1]] = match[2];
            }else{
                value[match[1]] = match[2];
            }
        }else if(regex.section.test(line)){
            var match = line.match(regex.section);
            value[match[1]] = {};
            section = match[1];
        }else if(line.length == 0 && section){
            section = null;
        };
    });
    return value;
}

/**
 * 
 * @param {String} data, the INI text string to be parsed 
 * @returns {object} an object containing 3 arrays: nodes, edges and warnings
 */
function parseText(data){
    // Store raw text for case sensitive lookups
    setMapText(data);
    config = parseINIString(data);
	
// nodes are treated as a map for easy access, will be convert to array during output
    var nodes = new Map();
    var edges = [];
    var warning = [];
    var unique_id = new Set();

    /**
     * Relationship between Triggers and Tags is not well understood
     * Here triggers are grouped as disjoint sets, i.e. each trigger belong to only one set.
     * each set may have one or more tags associated with it
     * the repeating type of a trigger will be determined by the first tags associated with its set.
     */
    // pre-processing
    disjointTrigger = {};
    triggerRef = {};

    // initialize the disjoint set
    for(var item in config.Triggers){
        const arr = config.Triggers[item].split(',');
        if(arr[1] == '<none>'){
            disjointTrigger[item] = item;
        }else{
            disjointTrigger[item] = arr[1];
        }
        triggerRef[item] = [];
    }
    
    // update the triggers reference using the disjoint set
    for(var item in config.Tags){
        const arr = config.Tags[item].split(',');
        const rep = findRep(arr[2]);
        if(triggerRef[rep] == undefined){
            warning.push(`Tag ${item} refer to a none existing trigger!`);
        }else{
            triggerRef[rep].push(item);
        }
    }

    // read trigger
    for(var item in config.Triggers){
        const arr = config.Triggers[item].split(',');
        var obj = {};

        // trigger property
        obj.id = item;
        obj.label = arr[2];
        obj.house = arr[0];             
        obj.easy = parseInt(arr[4]);
        obj.normal = parseInt(arr[5]);
        obj.hard = parseInt(arr[6]);
        obj.disabled = parseInt(arr[3]);
        obj.neighbour = new Set();
        // check if the trigger has any associated tags
        const rep = findRep(item);
        if(triggerRef[rep].length == 0){
            warning.push(`Trigger ${item} doesn't have any tags!`)
            continue;
        }
        // associated the repeating type with the first tag
        obj.tags = triggerRef[rep];
        obj.repeat = parseInt(config.Tags[obj.tags[0]].split(',')[0]);
        obj.link = arr[1];
        if(obj.link.trim() != '<none>'){
            edges.push({from: obj.id, to: obj.link, arrows: "to;from", color: getTriggerColor('link')});
        }

        // parse objects and events
        try{
            obj.events = parseEvents(config.Events[obj.id],obj.id);
            obj.actions = parseActions(config.Actions[obj.id],obj.id);
        }catch(error){
            warning.push(`Trigger ${item} has error in its events or actions`);
            console.log(error);
        }

        // customized nodes property
        obj.shape = "box";
        obj.mass = 2;
        if(obj.disabled){
            obj.color = {border:'#ff0000',highlight:{border:'#ff0000'}};
        }

        if(unique_id.has(item)){
            warning.push(`ID ${item} duplicated!`);
        }else{
            nodes.set(obj.id,obj);
            unique_id.add(obj.id)
        }
    }

    for(var item in config.VariableNames){
        var temp = config.VariableNames[item].split(',');
        nodes.set(
            'L'+item, 
            {
                id: 'L'+item,
                label: temp[0],
                initValue: temp[1],
                shape:"diamond", 
                mass: 4,
                neighbour: new Set()
            }
        );
    }
   // pre-processing: storing neighbour in nodes
    for(var i=0;i<edges.length;i++){
        try{
            nodes.get(edges[i].from).neighbour.add(edges[i].to);
            nodes.get(edges[i].to).neighbour.add(edges[i].from);
        }catch{
            continue;
        }
    }
    nodes = Array.from(nodes.values());
    if(config.Triggers == undefined){
        warning.push(`There are no triggers in this map!`);
    }
    result = {nodes, edges, warning};
    return result;
    
    // disjoint set find representative for element
    function findRep(id){
        if(disjointTrigger[id]!=id){
            disjointTrigger[id] = disjointTrigger[disjointTrigger[id]];
            return findRep(disjointTrigger[id]);
        }else{
            return id;
        }
    }
    // Parse Actions
    function parseActions(str,parent_id){
        var arr = str.split(',');
        var actions = [];
        const n = arr[0];
        for(var i=1;i<arr.length;i+=8){
            var obj = {};
            obj.type = parseInt(arr[i]);
            obj.p = [];
            for(var j=1;j<8;j++){
                obj.p.push(arr[i+j]);
            }
            actions.push(obj);
            switch(obj.type){
                case 12:
                    edges.push({from: parent_id, to: obj.p[1], arrows: "to", color: getTriggerColor('destroy')});
                    break;
                case 22:
                    edges.push({from: parent_id, to: obj.p[1], arrows: "to", color: getTriggerColor('force')});
                    break;
                case 53:
                    edges.push({from: parent_id, to: obj.p[1], arrows: "to", color: getTriggerColor('enable')});
                    break;
                case 54:
                    edges.push({from: parent_id, to: obj.p[1], arrows: "to", color: getTriggerColor('disable')});
                    break;
                case 56:
                    edges.push({from: parent_id, to: 'L' + obj.p[1], arrows: "to", color: getTriggerColor('enable'), dashes: true});
                    break;
                case 57:
                    edges.push({from: parent_id, to: 'L' + obj.p[1], arrows: "to", color: getTriggerColor('disable'), dashes: true});
                    break;
                case 28:
                    edges.push({from: parent_id, to: 'G' + obj.p[1], arrows: "to", color: getTriggerColor('enable'), dashes: true});
                    addGV(obj.p[1]);
                    break;
                case 29:
                    edges.push({from: parent_id, to: 'G' + obj.p[1], arrows: "to", color: getTriggerColor('disable'), dashes: true});
                    addGV(obj.p[1]);
                    break;
            }
            // just in case there are some extra parameters left behind, break the loop before those can be parse as a different actions
            if(actions.length == n) break;
        }
        return actions;
    }

    // events parsing
    function parseEvents(str,parent_id){
        var arr = str.split(',');
        var events = [];
        for(var i=1;i<arr.length;i+=3){
            var obj = {};
            obj.type = parseInt(arr[i]);
            flag = parseInt(arr[i+1]);
            
            if(flag == 2){
                obj.p = [arr[i+2],arr[i+3]];
                i++;
            }else{
                obj.p = [arr[i+2]];
            }
            switch(obj.type){
                // local variable: set
                case 36:
                    edges.push({from: 'L' + obj.p[0], to: parent_id, arrows: "to", color: getTriggerColor('enable'), dashes: true});
                    break;
                // local variable: set
                case 37:
                    edges.push({from: 'L' + obj.p[0], to: parent_id, arrows: "to", color: getTriggerColor('disable'), dashes: true});
                    break;
                // global variable: clear
                case 27:
                    edges.push({from: 'G' + obj.p[0], to: parent_id, arrows: "to", color: getTriggerColor('enable'), dashes: true});
                    addGV(obj.p[0]);
                    break;
                // global variable: clear
                case 28:
                    edges.push({from: 'G' + obj.p[0], to: parent_id, arrows: "to", color: getTriggerColor('disable'), dashes: true});
                    addGV(obj.p[0]);
                    break;
            }
            events.push(obj);
        }
        return events;
    }

    // global variable helper function
    function addGV(num) {
        if (!unique_id.has('G' + num)) {
            const localColor = getTriggerColor('global'); // uses --variable-global or --variable-local
            nodes.set(
                'G' + num,
                {
                    id: 'G' + num,
                    label: `Global Variable ${num}`,
                    shape: "triangle",
                    mass: 4,
                    neighbour: new Set(),
                    color: {
                        border: localColor,
                        highlight: { border: localColor }
                    }
                }
            );
            unique_id.add('G' + num);
        }
    }
}

function bind_coll(){
    var coll = document.getElementsByClassName("collapsible");

    for (var i = 0; i < coll.length; i++) {
        coll[i].addEventListener("click", function() {
            this.classList.toggle("active");
            var content = this.nextElementSibling;
            if (content.style.maxHeight != '0px'){
                content.style.maxHeight = '0px';
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });
        
    }
}

// Convert alphabetic waypoint values to numbers
function wp(str){
    const alp = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var r = 0;
    for(var i=0;i<str.length;i++){
        
        r = r*26 + alp.indexOf(str[i]) + 1;
    }
    return (r - 1);
}

window.createWelcomeNetworkData = createWelcomeNetworkData;
window.getThemedNetworkOptions = getThemedNetworkOptions;

document.addEventListener('click', function(e){
  var link = e.target && e.target.classList && e.target.classList.contains('team-link') ? e.target : (e.target.closest ? e.target.closest('.team-link') : null);
  if (!link) return;
  var id = link.dataset ? link.dataset.teamId : link.getAttribute('data-team-id');
  if (id) showteamInfoRaw(id, e);
});
