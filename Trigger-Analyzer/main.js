// Optimized Trigger Analyzer
class TriggerAnalyzer {
    constructor() {
        // Core data structures
        this.network = null;
        this.nodesData = null;
        this.nodesView = null;
        this.edgesDataSet = null;
        this.rawData = null;
        
        // Cached data for performance
        this.triggerListCache = [];
        this.searchIndex = new Map();
        
        // Configuration
        this.nodeFilterOptions = {
            triggers: true,
            variables: true,
            easy: true,
            normal: true,
            hard: true
        };
        
        // Event/Action data
        this.events = [];
        this.actions = [];
        
        // Focus options constant
        this.focusOptions = {
            scale: 1,
            offset: {x: 0, y: 0},
            animation: {duration: 1000, easingFunction: "easeInOutQuad"}
        };
    }
    
    // Load event/action definitions
    async loadEventActionData() {
        try {
            const response = await fetch('./fadata.json');
            const data = await response.json();
            this.events = data.events;
            this.actions = data.actions;
        } catch (error) {
            console.error('Failed to load event/action data:', error);
            // Fallback to empty arrays if load fails
            this.events = [];
            this.actions = [];
        }
    }
    
    // Update network theme without recreating
    updateNetworkTheme() {
        if (!this.network || !this.nodesData) return;
        
        // Update network options
        this.network.setOptions(this.getThemedNetworkOptions());
        
        // Update global variable node colors
        const updatedNodes = [];
        const isLight = document.body.classList.contains('light-mode');
        
        this.nodesData.forEach(node => {
            if (node.shape === 'triangle') { // Global variables
                updatedNodes.push({
                    id: node.id,
                    color: {
                        background: isLight ? '#FFB2FF' : '#CC33CC',
                        border: isLight ? '#990099' : '#FF00FF',
                        highlight: {
                            border: isLight ? '#990099' : '#FF00FF'
                        }
                    }
                });
            }
        });
        
        if (updatedNodes.length > 0) {
            this.nodesData.update(updatedNodes);
        }
        
        // Update edge colors if needed
        if (this.rawData && this.rawData.edges) {
            const updatedEdges = this.rawData.edges.map(edge => ({
                ...edge,
                color: this.getTriggerColor(this.getEdgeColorType(edge))
            }));
            this.network.setData({
                nodes: this.nodesView,
                edges: updatedEdges
            });
        }
    }
    
    // Helper to determine edge color type from original edge data
    getEdgeColorType(edge) {
        // This is a simplified version - you might need to store the color type with edges
        if (edge.color) {
            const colorMap = {
                '#17CB49': 'enable',
                '#129e36': 'enable',
                '#f74141': 'disable',
                '#d12f2f': 'disable',
                '#FFEE22': 'destroy',
                '#d1ba15': 'destroy',
                '#168FFF': 'force',
                '#1c6fdb': 'force',
                '#FF9F2D': 'link',
                '#e67e22': 'link'
            };
            return colorMap[edge.color] || 'default';
        }
        return 'default';
    }
    
    // Update network theme without recreating
    updateNetworkTheme() {
        if (!this.network || !this.nodesData) return;
        
        // Update network options
        this.network.setOptions(this.getThemedNetworkOptions());
        
        // Update global variable node colors
        const updatedNodes = [];
        const isLight = document.body.classList.contains('light-mode');
        
        this.nodesData.forEach(node => {
            if (node.shape === 'triangle') { // Global variables
                updatedNodes.push({
                    id: node.id,
                    color: {
                        background: isLight ? '#FFB2FF' : '#CC33CC',
                        border: isLight ? '#990099' : '#FF00FF',
                        highlight: {
                            border: isLight ? '#990099' : '#FF00FF'
                        }
                    }
                });
            }
        });
        
        if (updatedNodes.length > 0) {
            this.nodesData.update(updatedNodes);
        }
        
        // Update edge colors
        if (this.edgesDataSet) {
            const updatedEdges = [];
            this.edgesDataSet.forEach(edge => {
                if (edge.colorType) {
                    updatedEdges.push({
                        id: edge.id,
                        color: this.getTriggerColor(edge.colorType)
                    });
                }
            });
            if (updatedEdges.length > 0) {
                this.edgesDataSet.update(updatedEdges);
            }
        }
    }
    
    // Get color based on current theme
    getTriggerColor(type) {
        const root = getComputedStyle(document.body);
        const colorMap = {
            'enable': '--trigger-enable',
            'disable': '--trigger-disable',
            'destroy': '--trigger-destroy',
            'force': '--trigger-force',
            'link': '--trigger-link',
            'global': '--variable-global'
        };
        return root.getPropertyValue(colorMap[type] || '--edge-color-default').trim();
    }
    
    // Network options
    getThemedNetworkOptions() {
        const css = getComputedStyle(document.body);
        const isTreeMode = document.getElementById('toggleTree').checked;
        
        const baseOptions = {
            interaction: {
                navigationButtons: false,
                keyboard: false
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
        
        if (isTreeMode) {
            return {
                ...baseOptions,
                layout: {
                    hierarchical: {
                        enabled: true,
                        direction: 'LR',
                        sortMethod: 'hubsize'
                    }
                },
                physics: {
                    enabled: true,
                    hierarchicalRepulsion: {
                        avoidOverlap: 0.5
                    }
                }
            };
        } else {
            return {
                ...baseOptions,
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
                }
            };
        }
    }
    
    // Create initial welcome network
    createWelcomeNetwork() {
        const container = document.getElementById('nodeGraph');
        const nodes = new vis.DataSet([
            { id: 0, label: "Load a Red Alert 2 map file", shape: "box" },
            { id: 1, label: "to see the triggers!", shape: "box" },
            { id: 2, label: "Drag and drop also works!", shape: "box" }
        ]);
        
        const edges = new vis.DataSet([
            { id: 'e1', from: 0, to: 1, arrows: "to", length: 250, color: this.getTriggerColor('enable'), colorType: 'enable' },
            { id: 'e2', from: 2, to: 1, arrows: "to", length: 250, color: this.getTriggerColor('enable'), colorType: 'enable' },
            { id: 'e3', from: 0, to: 2, arrows: "to;from", length: 250, color: this.getTriggerColor('link'), colorType: 'link' }
        ]);
        
        this.network = new vis.Network(container, {nodes, edges}, this.getThemedNetworkOptions());
        this.nodesData = nodes;
        this.edgesDataSet = edges;
    }
    
    // Convert alphabetic waypoint to number
    convertWaypoint(str) {
        const alp = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let r = 0;
        for (let i = 0; i < str.length; i++) {
            r = r * 26 + alp.indexOf(str[i]) + 1;
        }
        return r - 1;
    }
    
    // Parse INI format
    parseINI(data) {
        const regex = {
            section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
            param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
            comment: /^\s*;.*$/
        };
        const result = {};
        const lines = data.split(/[\r\n]+/);
        let section = null;
        
        lines.forEach(line => {
            if (regex.comment.test(line)) return;
            
            if (regex.param.test(line)) {
                const match = line.match(regex.param);
                if (section) {
                    result[section][match[1]] = match[2];
                } else {
                    result[match[1]] = match[2];
                }
            } else if (regex.section.test(line)) {
                const match = line.match(regex.section);
                result[match[1]] = {};
                section = match[1];
            } else if (line.length === 0 && section) {
                section = null;
            }
        });
        
        return result;
    }
    
    // Parse map file
    parseMapFile(data) {
        const config = this.parseINI(data);
        const nodes = new Map();
        const edges = [];
        const warnings = [];
        const uniqueIds = new Set();
        
        // Process triggers and tags relationship
        const disjointTrigger = {};
        const triggerRef = {};
        
        // Initialize disjoint sets
        for (const id in config.Triggers) {
            const [house, link, name] = config.Triggers[id].split(',');
            disjointTrigger[id] = link === '<none>' ? id : link;
            triggerRef[id] = [];
        }
        
        // Helper for disjoint set
        const findRep = (id) => {
            if (disjointTrigger[id] !== id) {
                disjointTrigger[id] = findRep(disjointTrigger[id]);
            }
            return disjointTrigger[id];
        };
        
        // Process tags
        for (const tagId in config.Tags) {
            const [repeat, , triggerId] = config.Tags[tagId].split(',');
            const rep = findRep(triggerId);
            if (!triggerRef[rep]) {
                warnings.push(`Tag ${tagId} refers to non-existent trigger!`);
            } else {
                triggerRef[rep].push(tagId);
            }
        }
        
        // Process triggers
        for (const id in config.Triggers) {
            const [house, link, name, disabled, easy, normal, hard] = config.Triggers[id].split(',');
            const rep = findRep(id);
            
            if (!triggerRef[rep].length) {
                warnings.push(`Trigger ${id} doesn't have any tags!`);
                continue;
            }
            
            const trigger = {
                id,
                label: name,
                house,
                easy: parseInt(easy),
                normal: parseInt(normal),
                hard: parseInt(hard),
                disabled: parseInt(disabled),
                tags: triggerRef[rep],
                repeat: parseInt(config.Tags[triggerRef[rep][0]].split(',')[0]),
                link,
                neighbour: new Set(),
                shape: "box",
                mass: 2
            };
            
            if (trigger.disabled) {
                trigger.color = { border: '#ff0000', highlight: { border: '#ff0000' } };
            }
            
            // Parse events and actions
            try {
                trigger.events = this.parseEvents(config.Events[id], id, edges, nodes, uniqueIds);
                trigger.actions = this.parseActions(config.Actions[id], id, edges, nodes, uniqueIds);
            } catch (error) {
                warnings.push(`Trigger ${id} has error in events or actions`);
                console.error(error);
            }
            
            if (link.trim() !== '<none>') {
                edges.push({ 
                    from: id, 
                    to: link, 
                    arrows: "to;from", 
                    color: this.getTriggerColor('link'),
                    colorType: 'link'
                });
            }
            
            if (uniqueIds.has(id)) {
                warnings.push(`ID ${id} duplicated!`);
            } else {
                nodes.set(id, trigger);
                uniqueIds.add(id);
            }
        }
        
        // Process variables
        for (const id in config.VariableNames) {
            const [name, initValue] = config.VariableNames[id].split(',');
            nodes.set(`L${id}`, {
                id: `L${id}`,
                label: name,
                initValue,
                shape: "diamond",
                mass: 4,
                neighbour: new Set()
            });
        }
        
        // Build neighbor relationships
        edges.forEach(edge => {
            const fromNode = nodes.get(edge.from);
            const toNode = nodes.get(edge.to);
            if (fromNode && toNode) {
                fromNode.neighbour.add(edge.to);
                toNode.neighbour.add(edge.from);
            }
        });
        
        if (!config.Triggers) {
            warnings.push('There are no triggers in this map!');
        }
        
        return { nodes: Array.from(nodes.values()), edges, warning: warnings };
    }
    
    // Parse events
    parseEvents(str, parentId, edges, nodes, uniqueIds) {
        if (!str) return [];
        
        const arr = str.split(',');
        const events = [];
        
        for (let i = 1; i < arr.length; i += 3) {
            const type = parseInt(arr[i]);
            const flag = parseInt(arr[i + 1]);
            const event = { type, p: [] };
            
            if (flag === 2) {
                event.p = [arr[i + 2], arr[i + 3]];
                i++;
            } else {
                event.p = [arr[i + 2]];
            }
            
            // Handle special event types that create edges
            switch (type) {
                case 36: // Local variable set
                case 37: // Local variable clear
                    edges.push({
                        from: `L${event.p[0]}`,
                        to: parentId,
                        arrows: "to",
                        color: this.getTriggerColor(type === 36 ? 'enable' : 'disable'),
                        dashes: true,
                        colorType: type === 36 ? 'enable' : 'disable'
                    });
                    break;
                case 27: // Global variable set
                case 28: // Global variable clear
                    this.addGlobalVariable(event.p[0], nodes, uniqueIds);
                    edges.push({
                        from: `G${event.p[0]}`,
                        to: parentId,
                        arrows: "to",
                        color: this.getTriggerColor(type === 27 ? 'enable' : 'disable'),
                        dashes: true,
                        colorType: type === 27 ? 'enable' : 'disable'
                    });
                    break;
            }
            
            events.push(event);
        }
        
        return events;
    }
    
    // Parse actions
    parseActions(str, parentId, edges, nodes, uniqueIds) {
        if (!str) return [];
        
        const arr = str.split(',');
        const actions = [];
        const count = parseInt(arr[0]);
        
        for (let i = 1; i < arr.length && actions.length < count; i += 8) {
            const type = parseInt(arr[i]);
            const action = { type, p: [] };
            
            for (let j = 1; j < 8; j++) {
                action.p.push(arr[i + j] || '');
            }
            
            // Handle special action types that create edges
            const edgeConfig = {
                12: { color: 'destroy', arrows: "to" },           // Destroy trigger
                22: { color: 'force', arrows: "to" },             // Force trigger
                53: { color: 'enable', arrows: "to" },            // Enable trigger
                54: { color: 'disable', arrows: "to" },           // Disable trigger
                56: { color: 'enable', arrows: "to", dashes: true, prefix: 'L' },  // Set local variable
                57: { color: 'disable', arrows: "to", dashes: true, prefix: 'L' }, // Clear local variable
                28: { color: 'enable', arrows: "to", dashes: true, prefix: 'G' },  // Set global variable
                29: { color: 'disable', arrows: "to", dashes: true, prefix: 'G' }  // Clear global variable
            };
            
            if (edgeConfig[type]) {
                const config = edgeConfig[type];
                const targetId = config.prefix ? `${config.prefix}${action.p[1]}` : action.p[1];
                
                if (config.prefix === 'G') {
                    this.addGlobalVariable(action.p[1], nodes, uniqueIds);
                }
                
                edges.push({
                    from: parentId,
                    to: targetId,
                    arrows: config.arrows,
                    color: this.getTriggerColor(config.color),
                    dashes: config.dashes,
                    colorType: config.color
                });
            }
            
            actions.push(action);
        }
        
        return actions;
    }
    
    // Add global variable node
    addGlobalVariable(id, nodes, uniqueIds) {
        const globalId = `G${id}`;
        if (!uniqueIds.has(globalId)) {
            const color = this.getTriggerColor('global');
            nodes.set(globalId, {
                id: globalId,
                label: `Global Variable ${id}`,
                shape: "triangle",
                mass: 4,
                neighbour: new Set(),
                color: {
                    background: document.body.classList.contains('light-mode') ? '#FFB2FF' : '#CC33CC',
                    border: document.body.classList.contains('light-mode') ? '#990099' : '#FF00FF',
                    highlight: {
                        border: document.body.classList.contains('light-mode') ? '#990099' : '#FF00FF'
                    }
                }
            });
            uniqueIds.add(globalId);
        }
    }
    
    // Update info panel
    updateInfo(content) {
        const info = document.getElementById('info');
        if (typeof content === 'string') {
            info.innerHTML = content;
        } else {
            this.displayTriggerInfo(content);
        }
    }
    
    // Display trigger information
    displayTriggerInfo(raw) {
        const info = document.getElementById('info');
        info.innerHTML = '';
        
        if (!raw.house) {
            // Variable info
            info.innerHTML = `
                Variable<br>
                Name: ${raw.label}<br>
                ID: ${raw.id}<br>
                Initial Value: ${raw.initValue || 'N/A'}`;
            return;
        }
        
        // Trigger info
        const repeatType = raw.repeat === 0 ? 'one time OR' : 
                          raw.repeat === 1 ? 'one time AND' : 'repeating OR';
        
        const createSection = (title, content, open = true) => {
            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = title;
            details.appendChild(summary);
            details.innerHTML += content;
            details.open = open;
            return details;
        };
        
        // Basic info
        info.innerHTML = `
            <div class='listItem'>Name: ${raw.label}</div>
            <div class='listItem'>ID: ${raw.id}</div>`;
        
        // Basic details section
        const basicInfo = `
            <div class='listItem'>House: ${raw.house}</div>
            <div class='listItem'>Repeat: ${raw.repeat} (${repeatType})</div>
            <div class='listItem'>Tags: ${raw.tags.join(', ')}</div>
            ${raw.link.trim() !== '<none>' ? `<div class='listItem'>Link Trigger: ${raw.link}</div>` : ''}
            <div class='listItem'>Difficulty: 
                <span class='${raw.easy ? 'green' : 'red'}'>Easy</span> 
                <span class='${raw.normal ? 'green' : 'red'}'>Normal</span> 
                <span class='${raw.hard ? 'green' : 'red'}'>Hard</span>
            </div>
            <div class='listItem'>Disabled: <span class='${raw.disabled ? 'red' : 'green'}'>${raw.disabled ? 'True' : 'False'}</span></div>`;
        
        info.appendChild(createSection('Basic Info', basicInfo));
        
        // Events section
        let eventsContent = '';
        raw.events.forEach((event, i) => {
            const eventDef = this.events[event.type] || { name: 'Unknown', description: '' };
            eventsContent += `<div class='listItem' title='${event.type}: ${eventDef.description}'>
                Event ${i}: ${eventDef.name} ${event.p.join(' ')}
            </div>`;
        });
        info.appendChild(createSection('Events', eventsContent));
        
        // Actions section
        let actionsContent = '';
        raw.actions.forEach((action, i) => {
            const actionDef = this.actions[action.type] || { name: 'Unknown', description: '' };
            let params = '';
            for (let j = 0; j < 7; j++) {
                if (actionDef.p && actionDef.p[j] > 0) {
                    if (j !== 6) {
                        params += ` ${action.p[j]}`;
                    } else {
                        params += ` @${this.convertWaypoint(action.p[j])}`;
                    }
                }
            }
            actionsContent += `<div class='listItem' title='${action.type}: ${actionDef.description}'>
                Action ${i}: ${actionDef.name}${params}
            </div>`;
        });
        info.appendChild(createSection('Actions', actionsContent));
    }
    
    // Node filter function
    filterNode(node) {
        if (node.house !== undefined) {
            // Trigger node
            if (!this.nodeFilterOptions.triggers) {
                // Check if it's a neighbor of a variable
                let hasVariableNeighbor = false;
                for (const neighborId of node.neighbour) {
                    const neighbor = this.nodesData.get(neighborId);
                    if (neighbor && neighbor.house === undefined) {
                        hasVariableNeighbor = true;
                        break;
                    }
                }
                if (!hasVariableNeighbor) return false;
            }
            
            return (node.easy && this.nodeFilterOptions.easy) ||
                   (node.normal && this.nodeFilterOptions.normal) ||
                   (node.hard && this.nodeFilterOptions.hard);
        } else {
            // Variable node
            return this.nodeFilterOptions.variables;
        }
    }
    
    // Generate network visualization
    generateNetwork() {
        const info = document.getElementById('info');
        const warnings = this.rawData.warning.join('<br>');
        
        info.innerHTML = `
            Parse complete, generating network graph.<br>
            ${warnings ? `<div class='yellow'>Warnings:</div><div>${warnings}</div>` : ''}`;
        
        // Clear trigger list
        document.getElementById('triggerList').innerHTML = '';
        
        // Create data sets
        this.nodesData = new vis.DataSet(this.rawData.nodes);
        this.edgesDataSet = new vis.DataSet(this.rawData.edges);
        
        // Create filtered view
        this.nodesView = new vis.DataView(this.nodesData, {
            filter: (node) => this.filterNode(node)
        });
        
        // Create network
        const container = document.getElementById('nodeGraph');
        const data = {
            nodes: this.nodesView,
            edges: this.edgesDataSet
        };
        
        document.getElementById('togglePhysics').checked = true;
        document.getElementById('toggleTree').checked = false;
        
        this.network = new vis.Network(container, data, this.getThemedNetworkOptions());
        
        // Setup network events
        this.setupNetworkEvents(warnings);
        
        // Build trigger list for search
        this.buildTriggerList();
    }
    
    // Setup network event handlers
    setupNetworkEvents(warningText) {
        this.network.on("click", (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                this.updateInfo(this.nodesView.get(nodeId));
            } else {
                this.updateInfo(warningText || 'Click on a node to see details');
            }
        });
        
        this.network.on("doubleClick", (params) => {
            if (params.nodes.length > 0) {
                this.network.focus(params.nodes[0], this.focusOptions);
            }
        });
        
        this.network.on("stabilizationProgress", (params) => {
            const progress = Math.round(params.iterations / params.total * 100);
            this.updateInfo(`Loading: ${progress}%<br>
                Assets:<br>
                Triggers & Variables: ${this.rawData.nodes.length}<br>
                Links: ${this.rawData.edges.length}
                ${warningText ? `<br><div class='yellow'>Warnings:</div><div>${warningText}</div>` : ''}`);
        });
        
        this.network.once("stabilizationIterationsDone", () => {
            this.updateInfo(`100% Loaded.<br>
                Assets:<br>
                Triggers & Variables: ${this.rawData.nodes.length}<br>
                Links: ${this.rawData.edges.length}
                ${warningText ? `<br><div class='yellow'>Warnings:</div><div>${warningText}</div>` : ''}`);
        });
    }
    
    // Build trigger list for UI
    buildTriggerList() {
        const triggerList = document.getElementById('triggerList');
        const fragment = document.createDocumentFragment();
        
        this.rawData.nodes.forEach(node => {
            const item = document.createElement('div');
            item.className = 'listItem';
            item.title = `Trigger ID: ${node.id}`;
            item.dataset.triggerId = node.id;
            item.textContent = node.label;
            
            item.addEventListener('click', () => {
                this.updateInfo(this.nodesData.get(node.id));
                
                if (this.filterNode(this.nodesData.get(node.id))) {
                    this.network.focus(node.id, this.focusOptions);
                    this.network.setSelection({ nodes: [node.id] });
                }
            });
            
            fragment.appendChild(item);
        });
        
        triggerList.appendChild(fragment);
    }
}

// Global instance for compatibility with existing code
let analyzer;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Initialize analyzer
    analyzer = new TriggerAnalyzer();
    analyzer.loadEventActionData();
    
    // Theme management
    const toggleTheme = document.getElementById('toggleTheme');
    const savedTheme = localStorage.getItem('theme');
    const isLight = savedTheme === 'light';
    
    if (isLight) {
        document.body.classList.add('light-mode');
        toggleTheme.innerHTML = '<i data-lucide="moon"></i>';
        toggleTheme.setAttribute('title', 'Toggle Dark Mode');
    } else {
        toggleTheme.innerHTML = '<i data-lucide="sun"></i>';
        toggleTheme.setAttribute('title', 'Toggle Light Mode');
    }
    
    // Theme toggle
    toggleTheme.addEventListener('click', function () {
        const isNowLight = document.body.classList.toggle('light-mode');
        localStorage.setItem('theme', isNowLight ? 'light' : 'dark');
        toggleTheme.innerHTML = `<i data-lucide="${isNowLight ? 'moon' : 'sun'}"></i>`;
        toggleTheme.setAttribute('title', isNowLight ? 'Toggle Dark Mode' : 'Toggle Light Mode');
        lucide.createIcons();
        
        if (analyzer.network) {
            analyzer.updateNetworkTheme();
        }
    });
    
    // File handling
    const mapFileInput = document.getElementById('mapFileInput');
    const mapFileName = document.getElementById('mapFileName');
    
    mapFileInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        
        mapFileName.textContent = `Uploaded ${file.name}`;
        document.getElementById('searchMenu').value = '';
        
        const reader = new FileReader();
        reader.onload = function(e) {
            if (analyzer.network) analyzer.network.destroy();
            analyzer.updateInfo('File detected, attempting to load...');
            
            try {
                analyzer.rawData = analyzer.parseMapFile(e.target.result);
                analyzer.generateNetwork();
            } catch (error) {
                console.error('Parse error:', error);
                alert('Map file parse Error!');
                analyzer.updateInfo('File loading failed.');
            }
        };
        reader.onerror = error => {
            console.error('File read error:', error);
            analyzer.updateInfo('File reading failed.');
        };
        reader.readAsText(file, 'UTF-8');
    });
    
    // Drag and drop
    const container = document.getElementById('nodeGraph');
    container.ondragover = e => e.preventDefault();
    container.ondrop = e => {
        mapFileInput.files = e.dataTransfer.files;
        mapFileInput.dispatchEvent(new Event('change'));
        e.preventDefault();
    };
    
    // Filter toggles
    ['Easy', 'Normal', 'Hard'].forEach(difficulty => {
        document.getElementById(`toggle${difficulty}`).addEventListener('change', e => {
            analyzer.nodeFilterOptions[difficulty.toLowerCase()] = e.target.checked;
            if (analyzer.nodesView) analyzer.nodesView.refresh();
        });
    });
    
    // Physics toggle
    document.getElementById('togglePhysics').addEventListener('change', e => {
        if (analyzer.network) {
            analyzer.network.setOptions({ physics: { enabled: e.target.checked } });
        }
    });
    
    // Abort button
    document.getElementById('btnAbort').addEventListener('click', () => {
        if (analyzer.network) analyzer.network.stopSimulation();
    });
    
    // Tree toggle
    document.getElementById('toggleTree').addEventListener('change', () => {
        if (analyzer.network) {
            analyzer.network.setOptions(analyzer.getThemedNetworkOptions());
            document.getElementById('togglePhysics').checked = true;
            analyzer.network.fit();
        }
    });
    
    // Center view
    document.getElementById('btnCenterView').addEventListener('click', () => {
        if (analyzer.network) analyzer.network.fit();
    });
    
    // Search with debouncing
    let searchTimeout;
    document.getElementById('searchMenu').addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const filter = e.target.value.toLowerCase();
            const items = document.querySelectorAll('#triggerList .listItem');
            
            if (!filter) {
                items.forEach(item => item.style.display = '');
                return;
            }
            
            items.forEach(item => {
                const searchText = (item.textContent + (item.dataset.triggerId || '')).toLowerCase();
                item.style.display = searchText.includes(filter) ? '' : 'none';
            });
        }, 150);
    });
    
    // Panel resizers
    const resizer = document.getElementById('dragHandle');
    const nodeGraph = document.getElementById('nodeGraph');
    const rightPanel = document.querySelector('.right-panel');
    const infoBox = document.getElementById('info');
    const triggerList = document.getElementById('triggerList');
    const infoResizer = document.getElementById('infoResizer');
    
    let isDragging = false;
    let isDraggingInfo = false;
    
    resizer.addEventListener('mousedown', e => {
        isDragging = true;
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });
    
    infoResizer.addEventListener('mousedown', e => {
        isDraggingInfo = true;
        document.body.style.cursor = 'row-resize';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', e => {
        if (isDragging) {
            const contentBox = document.querySelector('.content');
            const totalWidth = contentBox.getBoundingClientRect().width;
            let newLeftWidth = e.clientX - contentBox.getBoundingClientRect().left;
            newLeftWidth = Math.max(200, Math.min(newLeftWidth, totalWidth - 200));
            const leftPercent = (newLeftWidth / totalWidth) * 100;
            nodeGraph.style.width = `${leftPercent}%`;
            rightPanel.style.width = `${100 - leftPercent}%`;
        } else if (isDraggingInfo) {
            const totalHeight = rightPanel.getBoundingClientRect().height;
            let newUpHeight = e.clientY - rightPanel.getBoundingClientRect().top;
            newUpHeight = Math.max(100, Math.min(newUpHeight, totalHeight - 100));
            const upPercent = (newUpHeight / totalHeight) * 100;
            infoBox.style.height = `${upPercent}%`;
            triggerList.style.height = `${100 - upPercent}%`;
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging || isDraggingInfo) {
            isDragging = false;
            isDraggingInfo = false;
            document.body.style.cursor = '';
        }
    });
    
    // Create welcome network
    analyzer.createWelcomeNetwork();
    
    // Initialize icons
    lucide.createIcons();
});

// Global functions for backwards compatibility
function getThemedNetworkOptions() {
    return analyzer ? analyzer.getThemedNetworkOptions() : {};
}

function createWelcomeNetworkData() {
    return {
        nodes: [
            { id: 0, label: "Load a Red Alert 2 map file", shape: "box" },
            { id: 1, label: "to see the triggers!", shape: "box" },
            { id: 2, label: "Drag and drop also works!", shape: "box" }
        ],
        edges: [
            { from: 0, to: 1, arrows: "to", length: 250, color: analyzer ? analyzer.getTriggerColor('enable') : '#17CB49' },
            { from: 2, to: 1, arrows: "to", length: 250, color: analyzer ? analyzer.getTriggerColor('enable') : '#17CB49' },
            { from: 0, to: 2, arrows: "to;from", length: 250, color: analyzer ? analyzer.getTriggerColor('link') : '#FF9F2D' }
        ]
    };
}