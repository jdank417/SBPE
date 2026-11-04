/**
 * XPDL importer
 *
 * Reads XPDL files produced by any tool and converts one of their workflow
 * processes into this editor's graph model ({nodes, edges, participants}).
 *
 * Supported:
 *  - XPDL 1.0, 2.0, 2.1 and 2.2, with or without namespace prefixes
 *    (xpdl:Package, xpdl2:Package, default namespace, or no namespace at all)
 *  - Full packages or bare <WorkflowProcesses>/<WorkflowProcess> fragments
 *  - Any text encoding (BOM sniffing + the XML declaration, with fallbacks)
 *  - Layout from XPDL 2.x NodeGraphicsInfo (absolute or lane-relative
 *    coordinates), JaWE/TWE 1.x XOffset/YOffset, JaWE/TWE 2.x
 *    JaWE_GRAPH_OFFSET (both lane-relative), and this editor's own format
 *  - Start/End nodes from BPMN events (XPDL 2.x) and from the
 *    StartOfWorkflow / JaWE_GRAPH_START_OF_WORKFLOW style markers (XPDL 1.0)
 *  - Block activities / embedded sub-processes (ActivitySets), sub-flows,
 *    routes / gateways, participants, conditions, deadlines and
 *    extended attributes (unknown ones are preserved)
 *  - Files with no layout information at all (automatic layered layout)
 *
 * Public API (window.XpdlImport):
 *  decode(arrayBuffer)       -> string   (encoding detection)
 *  read(text)                -> package summary with a list of processes
 *  build(pkg, processIndex)  -> {processId, processName, nodes, edges, participants, warnings, stats}
 */
(function(global) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Text decoding                                                       */
  /* ------------------------------------------------------------------ */

  function decodeWith(label, bytes, fatal) {
    return new TextDecoder(label, {fatal: !!fatal}).decode(bytes);
  }

  function decode(buffer) {
    var b = new Uint8Array(buffer);
    if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return decodeWith('utf-8', b.subarray(3));
    if (b[0] === 0xFF && b[1] === 0xFE) return decodeWith('utf-16le', b.subarray(2));
    if (b[0] === 0xFE && b[1] === 0xFF) return decodeWith('utf-16be', b.subarray(2));
    if (b[0] === 0x3C && b[1] === 0x00) return decodeWith('utf-16le', b);
    if (b[0] === 0x00 && b[1] === 0x3C) return decodeWith('utf-16be', b);

    var head = '';
    for (var i = 0; i < Math.min(b.length, 512); i++) head += String.fromCharCode(b[i]);
    var m = /<\?xml[^>]*encoding\s*=\s*["']([A-Za-z0-9._:-]+)["']/.exec(head);
    var declared = m ? m[1].toLowerCase() : null;

    if (declared && !/^utf-?8$/.test(declared)) {
      try {
        return decodeWith(declared, b);
      } catch (e) { /* unknown label: fall through */ }
    }
    // UTF-8 (declared or default). Files that are really Windows-1252 /
    // Latin-1 but don't say so are common, so fall back if UTF-8 is invalid.
    try {
      return decodeWith('utf-8', b, true);
    } catch (e) {
      return decodeWith('windows-1252', b);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Namespace-agnostic XML helpers                                      */
  /* ------------------------------------------------------------------ */

  function ln(el) {
    return el.localName || String(el.nodeName).replace(/^.*:/, '');
  }

  function kids(el, name) {
    var out = [];
    if (!el) return out;
    var list = el.childNodes;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.nodeType === 1 && (!name || ln(c) === name)) out.push(c);
    }
    return out;
  }

  function kid(el, name) {
    return kids(el, name)[0] || null;
  }

  // follow a chain of child names: path(el, 'A', 'B') == el>A>B
  function path(el) {
    for (var i = 1; i < arguments.length && el; i++) el = kid(el, arguments[i]);
    return el || null;
  }

  function descendants(el, name) {
    var all = el.getElementsByTagName('*'),
      out = [];
    for (var i = 0; i < all.length; i++) {
      if (ln(all[i]) === name) out.push(all[i]);
    }
    return out;
  }

  function attr(el, name) {
    if (!el) return null;
    if (el.hasAttribute(name)) return el.getAttribute(name);
    var lower = name.toLowerCase(),
      attrs = el.attributes;
    for (var i = 0; i < attrs.length; i++) {
      if ((attrs[i].localName || attrs[i].name).toLowerCase() === lower) return attrs[i].value;
    }
    return null;
  }

  function text(el) {
    return el ? String(el.textContent || '').trim() : '';
  }

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : null;
  }

  function cleanName(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function extAttrs(el) {
    var list = [];
    kids(kid(el, 'ExtendedAttributes'), 'ExtendedAttribute').forEach(function(e) {
      var v = attr(e, 'Value');
      if (v === null) v = text(e);
      list.push({name: attr(e, 'Name') || '', value: v || ''});
    });
    return list;
  }

  function extMap(list) {
    var m = {};
    list.forEach(function(a) {
      if (!(a.name in m)) m[a.name] = a.value;
    });
    return m;
  }

  /* ------------------------------------------------------------------ */
  /* XML parsing                                                         */
  /* ------------------------------------------------------------------ */

  function tryParse(str) {
    var doc = new DOMParser().parseFromString(str, 'application/xml');
    var err = doc.getElementsByTagName('parsererror');
    if (err.length || !doc.documentElement || ln(doc.documentElement) === 'parsererror') {
      return {error: err.length ? text(err[0]).split('\n').slice(0, 2).join(' ') : 'unknown error'};
    }
    return {doc: doc};
  }

  function parseXml(str) {
    // BOM, and whitespace before the XML declaration (invalid, but some tools write it)
    str = String(str).replace(/^\uFEFF/, '').replace(/^\s+(?=<)/, '');
    var r = tryParse(str);
    if (r.doc) return r.doc;
    // Common breakage: stray "&" or HTML entities such as &nbsp;
    var repaired = str.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
    if (repaired !== str) {
      var r2 = tryParse(repaired);
      if (r2.doc) return r2.doc;
    }
    throw new Error('The file is not well-formed XML (' + r.error + ').');
  }

  /* ------------------------------------------------------------------ */
  /* Package summary                                                     */
  /* ------------------------------------------------------------------ */

  function detectVersion(doc, pkg) {
    var v = text(path(pkg, 'PackageHeader', 'XPDLVersion'));
    if (v) return v;
    var ns = doc.documentElement.namespaceURI || '';
    var m = /XPDL\s*([0-9.]+)/i.exec(ns);
    return m ? m[1] : '';
  }

  function countActivities(proc) {
    var n = kids(kid(proc, 'Activities'), 'Activity').length;
    kids(kid(proc, 'ActivitySets'), 'ActivitySet').forEach(function(set) {
      n += kids(kid(set, 'Activities'), 'Activity').length;
    });
    return n;
  }

  function read(str) {
    var doc = parseXml(str);
    var root = doc.documentElement;
    var pkg = ln(root) === 'Package' ? root : (descendants(root, 'Package')[0] || null);
    var procEls = ln(root) === 'WorkflowProcess' ? [root] : descendants(root, 'WorkflowProcess');

    if (!procEls.length) {
      if (pkg) {
        throw new Error('This XPDL package contains no workflow processes (it only has package-level definitions such as participants or applications).');
      }
      throw new Error('No workflow process was found. Is this an XPDL file? (root element: <' + root.nodeName + '>)');
    }

    var pools = {};
    if (pkg) {
      kids(kid(pkg, 'Pools'), 'Pool').forEach(function(pool) {
        var pid = attr(pool, 'Process');
        if (pid && !pools[pid]) pools[pid] = pool;
      });
    }

    var processes = procEls.map(function(proc, i) {
      var id = attr(proc, 'Id') || ('Process' + (i + 1));
      var pool = pools[id] || null;
      var name = cleanName(attr(proc, 'Name'));
      var poolName = pool ? cleanName(attr(pool, 'Name')) : '';
      return {
        index: i,
        id: id,
        name: name || poolName || id,
        poolName: poolName,
        activityCount: countActivities(proc),
        transitionCount: kids(kid(proc, 'Transitions'), 'Transition').length,
        el: proc,
        pool: pool
      };
    });

    return {
      text: str,
      doc: doc,
      pkg: pkg,
      id: pkg ? attr(pkg, 'Id') : null,
      name: pkg ? cleanName(attr(pkg, 'Name')) : '',
      version: detectVersion(doc, pkg || root),
      processes: processes
    };
  }

  /* ------------------------------------------------------------------ */
  /* Building the editor model                                           */
  /* ------------------------------------------------------------------ */

  // extended attributes the editor maps to its own fields (or that only
  // carry layout), everything else is kept as a user extended attribute
  var KNOWN_ACTIVITY_EXT = {
    isMulInstance: 1, isResponsibleTem: 1, responsible: 1, syncType: 1, MustActivity: 1,
    isCreateNew: 1, taskAssignMode: 1, assignmentsOrder: 1, completeAllAssignments: 1,
    autoAcceptAllAssignments: 1, isResponsible: 1, deadline: 1, ActivityEndEvent: 1,
    ActivityCreateEvent: 1, FinishRule: 1, warnTimeiFrequency: 1, warnTime: 1,
    warnAgentClassName: 1, LimitAgentClassName: 1, ParticipantID: 1, XOffset: 1, YOffset: 1,
    StartOfBlock: 1, EndOfBlock: 1, FillColor: 1, BorderColor: 1, TextColor: 1
  };
  var KNOWN_TRANSITION_EXT = {
    condiException: 1, condixml: 1, TransitionRuleType: 1, TransitionEvent: 1,
    TransitionEventType: 1, conditype: 1, RoutingType: 1, LineColor: 1
  };

  function color(v) {
    return typeof global.parseXpdlColor === 'function' ? global.parseXpdlColor(v) : null;
  }

  // FillColor / BorderColor from NodeGraphicsInfo (any tool), or from the
  // extended attributes this editor writes
  function colorsOf(el, em) {
    var out = {fill: color(em.FillColor), border: color(em.BorderColor), text: color(em.TextColor)};
    kids(kid(el, 'NodeGraphicsInfos'), 'NodeGraphicsInfo').forEach(function(info) {
      if (!out.fill) out.fill = color(attr(info, 'FillColor'));
      if (!out.border) out.border = color(attr(info, 'BorderColor'));
    });
    return out;
  }

  function lineColorOf(tr, em) {
    var c = color(em.LineColor);
    kids(kid(tr, 'ConnectorGraphicsInfos'), 'ConnectorGraphicsInfo').forEach(function(info) {
      if (!c) c = color(attr(info, 'BorderColor')) || color(attr(info, 'FillColor'));
    });
    return c;
  }

  function applyColors(node, c) {
    if (c.fill) node.fillColor = c.fill;
    if (c.border) node.borderColor = c.border;
    if (c.text) node.textColor = c.text;
  }

  function isLayoutExt(name) {
    return /^JaWE_GRAPH_/.test(name) || /^(Start|End)Of(Workflow|Block)$/.test(name);
  }

  function routing(v) {
    v = String(v || '').toUpperCase();
    if (/^SIMPLE/.test(v)) return 'SIMPLEROUTING';
    return 'NOROUTING';
  }

  function stripOuterParens(s) {
    s = s.trim();
    while (s.charAt(0) === '(' && s.charAt(s.length - 1) === ')') {
      var depth = 0,
        wraps = true;
      for (var i = 0; i < s.length - 1; i++) {
        if (s[i] === '(') depth++;
        else if (s[i] === ')') depth--;
        if (depth === 0) {
          wraps = false;
          break;
        }
      }
      if (!wraps) break;
      s = s.slice(1, -1).trim();
    }
    return s;
  }

  // attach data that must not show up in JSON exports or be copied around
  function hide(obj, key, value) {
    Object.defineProperty(obj, key, {value: value, writable: true, configurable: true, enumerable: false});
    return value;
  }

  // the fields the editor can change; saving compares against these
  function snapshotNode(n) {
    var c = n.conventional || {},
      t = n.timeoutLimit || {},
      h = n.highLevel || {},
      m = n.monitorinf || {},
      f = n.frontCondition || {};
    return JSON.stringify({
      title: n.title, description: c.description || '', performer: c.performer || '',
      startMode: c.startMode || '', finishMode: c.finishMode || '', limit: t.limitTime || '',
      deadline: t.deadline || [], convergeType: f.convergeType || '',
      fill: n.fillColor || '', border: n.borderColor || '', text: n.textColor || '',
      extendAttr: n.extendAttr || [],
      other: {
        taskAssignMode: c.taskAssign, MustActivity: c.MustActivity, isMulInstance: c.isMulInstance,
        autoAcceptAllAssignments: c.autoAcceptAllAssignments, isResponsible: c.isResponsible,
        completeAllAssignments: c.completeAllAssignments, assignmentsOrder: c.assignmentsOrder,
        ActivityEndEvent: h.activityEndEvent, ActivityCreateEvent: h.activityCreateEvent, FinishRule: h.finishRule,
        isResponsibleTem: m.isResponsibleTem, responsible: m.responsible && m.responsible.join ? m.responsible.join(',') : m.responsible,
        warnTime: t.warnTime, warnAgentClassName: t.warnAgentClassName, LimitAgentClassName: t.limitAgentClassName,
        isCreateNew: f.isCreateNew, syncType: f.syncType ? f.syncType + '|' + (f.voteText || '') : ''
      }
    });
  }

  function snapshotEdge(e) {
    var p = e.postCondition || {};
    return JSON.stringify({
      name: p.edgeName || '', description: p.description || '', conditype: p.conditype || '',
      condition: p.condition_data || '', exception: p.condiException || '', color: e.color || '',
      ext: p.extendedAttrs || [], drawLine: e.drawLine || ''
    });
  }

  function Context(pkgInfo, proc) {
    this.pkgInfo = pkgInfo;
    this.proc = proc;
    this.used = {};
    this.counter = 0;
    this.warnings = [];
    this.stats = {activities: 0, transitions: 0, startEnd: 0, blocks: 0, autoLayout: 0, renamedIds: 0, skippedTransitions: 0};
    this.activitySets = {};
    var self = this;
    kids(kid(proc.el, 'ActivitySets'), 'ActivitySet').forEach(function(set) {
      self.activitySets[attr(set, 'Id')] = set;
    });
  }

  Context.prototype.warn = function(msg) {
    if (this.warnings.indexOf(msg) === -1) this.warnings.push(msg);
  };

  // ids are used in CSS selectors and as d3 keys: keep them simple and unique
  Context.prototype.safeId = function(raw, fallbackPrefix) {
    var base = String(raw || '').trim();
    var safe = base.replace(/[^A-Za-z0-9_-]/g, '_');
    if (!safe) safe = (fallbackPrefix || 'id') + '_' + (++this.counter);
    if (safe !== base && base) this.stats.renamedIds++;
    var candidate = safe,
      n = 2;
    while (this.used[candidate]) candidate = safe + '_' + (n++);
    this.used[candidate] = true;
    return candidate;
  };

  function classify(act) {
    var ev = kid(act, 'Event');
    if (ev) {
      if (kid(ev, 'StartEvent')) return {type: 'start', trigger: attr(kid(ev, 'StartEvent'), 'Trigger')};
      if (kid(ev, 'EndEvent')) return {type: 'end', trigger: attr(kid(ev, 'EndEvent'), 'Result')};
      var ie = kid(ev, 'IntermediateEvent');
      return {type: 'activity', component: 'ordinaryActivity', label: 'Event', event: ie ? (attr(ie, 'Trigger') || 'None') : 'Event'};
    }
    var route = kid(act, 'Route');
    if (route) return {type: 'activity', component: 'routeActivity', label: attr(route, 'GatewayType') ? 'Gateway' : 'Route', gateway: attr(route, 'GatewayType')};
    var block = kid(act, 'BlockActivity');
    if (block) return {type: 'activity', component: 'blockActivity', label: 'Block Activity', blockId: attr(block, 'ActivitySetId') || attr(block, 'BlockId')};
    var impl = kid(act, 'Implementation');
    var sub = kid(impl, 'SubFlow');
    if (sub) return {type: 'activity', component: 'subFlowActivity', label: 'Sub-Activity', subFlow: {id: attr(sub, 'Id') || '', execution: attr(sub, 'Execution') || 'SYNCHR'}};
    return {type: 'activity', component: 'ordinaryActivity', label: 'Activity'};
  }

  function joinType(act) {
    var join = path(act, 'TransitionRestrictions', 'TransitionRestriction', 'Join') || kid(act, 'Join');
    var t = join ? String(attr(join, 'Type') || '').toUpperCase() : '';
    if (!t) {
      var gw = String(attr(kid(act, 'Route'), 'GatewayType') || '').toUpperCase();
      if (gw === 'PARALLEL' || gw === 'AND') t = gw;
    }
    if (!t) return {};
    if (t === 'AND' || t === 'PARALLEL') return {value: 'AND'};
    if (t === 'XOR' || t === 'EXCLUSIVE') return {value: 'XOR'};
    return {value: 'XOR', original: t};
  }

  function modeOf(act, name) {
    var el = kid(act, name);
    var v = el ? (kids(el)[0] ? ln(kids(el)[0]) : text(el)) : attr(act, name);
    v = String(v || '').toLowerCase();
    return v === 'automatic' ? 'automatic' : 'manual';
  }

  function performerOf(act) {
    var p = kid(act, 'Performer') || path(act, 'Performers', 'Performer');
    return text(p);
  }

  function graphicsOf(el) {
    var infos = kids(kid(el, 'NodeGraphicsInfos'), 'NodeGraphicsInfo');
    for (var i = 0; i < infos.length; i++) {
      var c = kid(infos[i], 'Coordinates');
      var x = num(attr(c, 'XCoordinate')),
        y = num(attr(c, 'YCoordinate'));
      if (c && x !== null && y !== null) {
        return {
          x: x,
          y: y,
          w: num(attr(infos[i], 'Width')) || 0,
          h: num(attr(infos[i], 'Height')) || 0,
          laneId: attr(infos[i], 'LaneId')
        };
      }
    }
    return null;
  }

  // position of an activity in the file, before normalisation
  function rawPosition(act, em) {
    var g = graphicsOf(act);
    if (g) return {x: g.x + g.w / 2, y: g.y + g.h / 2, kind: 'ngi', lane: g.laneId, rect: g};
    if (em.JaWE_GRAPH_OFFSET) {
      var parts = em.JaWE_GRAPH_OFFSET.split(/[,;]/);
      var jx = num(parts[0]),
        jy = num(parts[1]);
      if (jx !== null && jy !== null) return {x: jx + 45, y: jy + 30, kind: 'jawe', lane: em.JaWE_GRAPH_PARTICIPANT_ID || ''};
    }
    var ox = num(em.XOffset),
      oy = num(em.YOffset);
    if (ox !== null && oy !== null) return {x: ox, y: oy, kind: 'offset', lane: em.ParticipantID || ''};
    return null;
  }

  function makeActivity(ctx, act, info) {
    var ext = extAttrs(act),
      em = extMap(ext);
    var rawId = attr(act, 'Id');
    var name = cleanName(attr(act, 'Name'));
    var node;

    if (info.type === 'start' || info.type === 'end') {
      node = {
        id: ctx.safeId(rawId, info.type),
        title: info.type === 'start' ? 'S' : 'E', // the editor draws a single letter here
        component: info.type === 'start' ? 'startComponent' : 'endComponent',
        type: info.type
      };
      if (name) node.eventName = name;
      applyColors(node, colorsOf(act, em));
      ctx.stats.startEnd++;
      return {node: node, pos: rawPosition(act, em), rawId: rawId, el: act};
    }

    var title = name;
    if (!title) title = info.event ? info.event + ' Event' : info.label;
    var join = joinType(act);
    var deadlines = kids(act, 'Deadline').map(function(dl) {
      return JSON.stringify({
        execution: attr(dl, 'Execution') || '',
        deadlineCondition: text(kid(dl, 'DeadlineCondition') || kid(dl, 'DeadlineDuration')),
        exceptionName: text(kid(dl, 'ExceptionName'))
      });
    });
    var syncType = em.syncType || '';
    var extendAttr = [];
    ext.forEach(function(a) {
      if (!a.name || KNOWN_ACTIVITY_EXT[a.name] || isLayoutExt(a.name)) return;
      extendAttr.push(JSON.stringify({name: a.name, value: a.value}));
    });
    if (join.original) extendAttr.push(JSON.stringify({name: 'XPDL_JoinType', value: join.original}));
    if (info.event) extendAttr.push(JSON.stringify({name: 'XPDL_IntermediateEvent', value: info.event}));
    if (info.gateway && info.gateway.toUpperCase() !== 'EXCLUSIVE' && info.gateway.toUpperCase() !== 'PARALLEL') {
      extendAttr.push(JSON.stringify({name: 'XPDL_GatewayType', value: info.gateway}));
    }

    var bool = function(v, dflt) {
      if (v === undefined || v === '') return dflt;
      return String(v) === 'true';
    };

    node = {
      id: ctx.safeId(rawId, 'act'),
      title: title,
      component: info.component,
      type: 'activity',
      conventional: {
        MustActivity: bool(em.MustActivity, true),
        taskAssign: em.taskAssignMode || 'taskAutoMode',
        autoAcceptAllAssignments: bool(em.autoAcceptAllAssignments, true),
        isResponsible: bool(em.isResponsible, true),
        isMulInstance: bool(em.isMulInstance, false),
        completeAllAssignments: bool(em.completeAllAssignments, false),
        assignmentsOrder: bool(em.assignmentsOrder, false),
        startMode: modeOf(act, 'StartMode'),
        finishMode: modeOf(act, 'FinishMode'),
        description: text(kid(act, 'Description')),
        participantID: em.ParticipantID || '',
        performer: performerOf(act)
      },
      frontCondition: {
        convergeType: join.value || '',
        isCreateNew: em.isCreateNew || '',
        syncType: syncType.split('|')[0] || '',
        voteModel: syncType.split('|')[0] || '',
        voteText: syncType.split('|')[1] || ''
      },
      postCondition: {},
      extendAttr: extendAttr,
      highLevel: {
        activityEndEvent: em.ActivityEndEvent || '',
        activityCreateEvent: em.ActivityCreateEvent || '',
        finishRule: em.FinishRule || ''
      },
      timeoutLimit: {
        limitTime: text(kid(act, 'Limit')),
        warnTime: em.warnTime || '',
        warnAgentClassName: em.warnAgentClassName || '',
        limitAgentClassName: em.LimitAgentClassName || '',
        deadline: deadlines
      },
      monitorinf: {
        isResponsibleTem: em.isResponsibleTem ? em.isResponsibleTem === 'true' : true,
        responsible: em.responsible ? em.responsible.split(',') : ''
      },
      eventTypeId: null
    };
    if (info.subFlow) node.subFlow = info.subFlow;
    applyColors(node, colorsOf(act, em));
    ctx.stats.activities++;
    return {node: node, pos: rawPosition(act, em), rawId: rawId, ext: ext, info: info, el: act};
  }

  /* ---------------------- start / end markers ------------------------ */

  // StartOfWorkflow="lane;activityId;x;y;routing" (JaWE 1.x and this editor)
  // JaWE_GRAPH_START_OF_WORKFLOW="JaWE_GRAPH_PARTICIPANT_ID=p,CONNECTING_ACTIVITY_ID=a,X_OFFSET=..,Y_OFFSET=..,JaWE_GRAPH_TRANSITION_STYLE=.."
  function parseMarkers(extList) {
    var markers = [];
    extList.forEach(function(a) {
      var m1 = /^(Start|End)Of(Workflow|Block)$/.exec(a.name);
      var m2 = /^JaWE_GRAPH_(START|END)_OF_(WORKFLOW|BLOCK)$/.exec(a.name);
      if (m1) {
        var p = String(a.value).split(';');
        markers.push({
          raw: a.value,
          rawName: a.name,
          type: m1[1] === 'Start' ? 'start' : 'end',
          lane: p[0] && p[0] !== 'none' ? p[0] : '',
          activity: p[1] && p[1] !== '-1' ? p[1] : '',
          x: num(p[2]),
          y: num(p[3]),
          drawLine: routing(p[4]),
          jawe: !!(p[0] && p[0] !== 'none')
        });
      } else if (m2) {
        var kv = {};
        String(a.value).split(',').forEach(function(pair) {
          var i = pair.indexOf('=');
          if (i > 0) kv[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
        });
        markers.push({
          raw: a.value,
          rawName: a.name,
          type: m2[1] === 'START' ? 'start' : 'end',
          lane: kv.JaWE_GRAPH_PARTICIPANT_ID || '',
          activity: kv.CONNECTING_ACTIVITY_ID || '',
          x: num(kv.X_OFFSET) !== null ? num(kv.X_OFFSET) + 15 : null,
          y: num(kv.Y_OFFSET) !== null ? num(kv.Y_OFFSET) + 15 : null,
          drawLine: routing(kv.JaWE_GRAPH_TRANSITION_STYLE),
          jawe: true
        });
      }
    });
    return markers;
  }

  /* ---------------------------- lanes -------------------------------- */

  function laneOrder(ctx, items) {
    var order = [];
    var pem = extMap(extAttrs(ctx.proc.el));
    var declared = pem.JaWE_GRAPH_WORKFLOW_PARTICIPANT_ORDER || pem.ParticipantVisualOrder || '';
    declared.split(/[;,]/).forEach(function(p) {
      p = p.trim();
      if (p && order.indexOf(p) === -1) order.push(p);
    });
    items.forEach(function(it) {
      if (it.lane !== undefined && order.indexOf(it.lane) === -1) order.push(it.lane);
    });
    return order;
  }

  // JaWE-style offsets are relative to the participant's swim lane: stack the
  // lanes top to bottom (in the given order) and shift each item by its lane's top
  // vertical pools have their lanes side by side, so stack along x instead
  // returns the lane bands [{id, start, size}] along the stacking axis
  // (lanes in `keepEmpty` get a band even when nothing is in them)
  function stackLanes(items, order, vertical, keepEmpty) {
    var axis = vertical ? 'x' : 'y';
    var bottom = {};
    (keepEmpty || []).forEach(function(l) {
      bottom[l] = 0;
    });
    items.forEach(function(it) {
      var l = it.lane || '';
      bottom[l] = Math.max(bottom[l] || 0, it[axis] + (vertical ? 90 : 60));
    });
    order = order.slice();
    Object.keys(bottom).forEach(function(l) {
      if (order.indexOf(l) === -1) order.push(l);
    });
    var top = {},
      acc = 0,
      bands = [];
    order.forEach(function(l) {
      if (!(l in bottom)) return;
      top[l] = acc;
      var size = Math.max(bottom[l] + 30, 120);
      bands.push({id: l, start: acc, size: size});
      acc += size;
    });
    items.forEach(function(it) {
      it[axis] += top[it.lane || ''] || 0;
    });
    return bands;
  }

  function isVertical(ctx) {
    var pem = extMap(extAttrs(ctx.proc.el));
    var o = pem.JaWE_GRAPH_WORKFLOW_PARTICIPANT_ORIENTATION || attr(ctx.proc.pool, 'Orientation') || '';
    return String(o).toUpperCase() === 'VERTICAL';
  }

  function participantName(ctx, id) {
    var lists = [kid(ctx.proc.el, 'Participants')];
    if (ctx.pkgInfo.pkg) lists.push(kid(ctx.pkgInfo.pkg, 'Participants'));
    for (var i = 0; i < lists.length; i++) {
      var ps = kids(lists[i], 'Participant');
      for (var j = 0; j < ps.length; j++) {
        if (attr(ps[j], 'Id') === id) return cleanName(attr(ps[j], 'Name')) || id;
      }
    }
    return id;
  }

  // JaWE 1.x/2.x: lanes are participants
  function resolveJaweLanes(ctx, items) {
    var vertical = isVertical(ctx);
    var pem = extMap(extAttrs(ctx.proc.el));
    var declared = (pem.JaWE_GRAPH_WORKFLOW_PARTICIPANT_ORDER || pem.ParticipantVisualOrder || '')
      .split(/[;,]/).map(function(s) { return s.trim(); }).filter(Boolean);
    var bands = stackLanes(items, laneOrder(ctx, items), vertical, declared);
    return {
      mode: 'stacked',
      vertical: vertical,
      bands: bands.map(function(b) {
        return {id: b.id, start: b.start, size: b.size, name: b.id ? participantName(ctx, b.id) : '', performer: b.id};
      })
    };
  }

  // XPDL 2.x coordinates are normally absolute, but some tools write them
  // relative to the lane (and lanes relative to the pool), and some (TWE)
  // give lanes no geometry at all. Handle all three.
  function resolveNgiLanes(ctx, items) {
    var pkg = ctx.pkgInfo.pkg;
    if (!pkg) return null;
    var lanes = {},
      laneEls = {},
      ownLanes = [],
      laneOrderList = [];
    var pools = kids(kid(pkg, 'Pools'), 'Pool');
    // the process's own pool first, so its lanes come first in the stacking order
    pools.sort(function(a, b) {
      return (b === ctx.proc.pool) - (a === ctx.proc.pool);
    });
    pools.forEach(function(pool) {
      var poolG = graphicsOf(pool);
      kids(kid(pool, 'Lanes'), 'Lane').forEach(function(lane) {
        var id = attr(lane, 'Id');
        laneOrderList.push(id);
        laneEls[id] = lane;
        if (pool === ctx.proc.pool) ownLanes.push(id);
        var g = graphicsOf(lane);
        if (!g) {
          lanes[id] = null;
          return;
        }
        var abs = {x: g.x, y: g.y, w: g.w, h: g.h};
        if (poolG) {
          var inside = g.x >= poolG.x - 1 && g.y >= poolG.y - 1 &&
            g.x + g.w <= poolG.x + poolG.w + 1 && g.y + g.h <= poolG.y + poolG.h + 1;
          var insideRel = g.x + poolG.x + g.w <= poolG.x + poolG.w + 1 && g.y + poolG.y + g.h <= poolG.y + poolG.h + 1;
          if (!inside && insideRel) abs = {x: g.x + poolG.x, y: g.y + poolG.y, w: g.w, h: g.h};
        }
        lanes[id] = abs;
      });
    });

    var describe = function(id, extra) {
      var el = laneEls[id];
      var info = {id: id, name: el ? cleanName(attr(el, 'Name')) || id : id,
        performer: el ? text(path(el, 'Performers', 'Performer')) : '',
        fill: el ? color(attr(path(el, 'NodeGraphicsInfos', 'NodeGraphicsInfo'), 'FillColor')) : null};
      for (var k in extra) info[k] = extra[k];
      return info;
    };
    var vertical = isVertical(ctx);

    // lanes without geometry (TWE): coordinates are lane-relative, stack the lanes
    var noGeomLanes = ownLanes.filter(function(id) { return lanes[id] === null; });
    var noGeom = items.filter(function(it) {
      return it.lane && lanes[it.lane] === null;
    });
    if (noGeom.length) {
      var bands = stackLanes(noGeom, laneOrderList, vertical, noGeomLanes);
      return {
        mode: 'stacked',
        vertical: vertical,
        poolName: ctx.proc.pool ? cleanName(attr(ctx.proc.pool, 'Name')) : '',
        bands: bands.map(function(b) { return describe(b.id, {start: b.start, size: b.size}); })
      };
    }

    var inAbs = 0,
      inRel = 0;
    var within = function(px, py, r) {
      return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
    };
    items.forEach(function(it) {
      var r = lanes[it.lane];
      if (!r) return;
      if (within(it.x, it.y, r)) inAbs++;
      if (within(it.x + r.x, it.y + r.y, r)) inRel++;
    });
    var rel = inRel > inAbs;
    if (rel) {
      items.forEach(function(it) {
        var r = lanes[it.lane];
        if (r) {
          it.x += r.x;
          it.y += r.y;
        }
      });
    }
    var rectBands = ownLanes.filter(function(id) { return lanes[id]; }).map(function(id) {
      return describe(id, {rect: lanes[id]});
    });
    if (!rectBands.length) return null;
    return {mode: rel ? 'rel' : 'abs', vertical: vertical, bands: rectBands};
  }

  /* --------------------------- layout -------------------------------- */

  var GAP_X = 50,
    GAP_Y = 26;

  function boxOf(n) {
    if (typeof global.nodeGeometry === 'function') return global.nodeGeometry(n);
    return n.type === 'activity' ? {w: 110, h: 46} : {w: 44, h: 44};
  }

  function autoLayout(nodes, edges) {
    var index = {};
    nodes.forEach(function(n, i) {
      index[n.id] = i;
    });
    var succ = nodes.map(function() { return []; }),
      pred = nodes.map(function() { return []; });
    var parent = nodes.map(function(n, i) { return i; });
    var find = function(i) {
      while (parent[i] !== i) i = parent[i] = parent[parent[i]];
      return i;
    };
    edges.forEach(function(e) {
      var s = index[e.source.id],
        t = index[e.target.id];
      if (s === undefined || t === undefined || s === t) return;
      succ[s].push(t);
      pred[t].push(s);
      parent[find(s)] = find(t);
    });

    // components, largest first
    var comps = {};
    nodes.forEach(function(n, i) {
      var r = find(i);
      (comps[r] = comps[r] || []).push(i);
    });
    var compList = Object.keys(comps).map(function(k) { return comps[k]; });
    compList.sort(function(a, b) { return b.length - a.length; });

    var top = 80;
    compList.forEach(function(comp) {
      // break cycles with a DFS from the natural entry points
      var inComp = {};
      comp.forEach(function(i) { inComp[i] = true; });
      var state = {},
        back = {};
      var roots = comp.filter(function(i) { return nodes[i].type === 'start'; })
        .concat(comp.filter(function(i) { return pred[i].length === 0; }))
        .concat(comp);
      var visit = function(start) {
        var stack = [[start, 0]];
        state[start] = 1;
        while (stack.length) {
          var top_ = stack[stack.length - 1],
            v = top_[0];
          if (top_[1] < succ[v].length) {
            var w = succ[v][top_[1]++];
            if (state[w] === 1) back[v + '>' + w] = true;
            else if (!state[w]) {
              state[w] = 1;
              stack.push([w, 0]);
            }
          } else {
            state[v] = 2;
            stack.pop();
          }
        }
      };
      roots.forEach(function(r) {
        if (!state[r]) visit(r);
      });

      // longest-path layering
      var layer = {},
        indeg = {};
      comp.forEach(function(i) {
        indeg[i] = 0;
      });
      comp.forEach(function(i) {
        succ[i].forEach(function(j) {
          if (!back[i + '>' + j]) indeg[j]++;
        });
      });
      var queue = comp.filter(function(i) { return indeg[i] === 0; });
      queue.forEach(function(i) { layer[i] = 0; });
      while (queue.length) {
        var v = queue.shift();
        succ[v].forEach(function(j) {
          if (back[v + '>' + j]) return;
          layer[j] = Math.max(layer[j] || 0, layer[v] + 1);
          if (--indeg[j] === 0) queue.push(j);
        });
      }
      var layers = [];
      comp.forEach(function(i) {
        var l = layer[i] || 0;
        (layers[l] = layers[l] || []).push(i);
      });
      layers = layers.filter(function(l) { return l && l.length; });

      // barycentre ordering sweeps
      var posIn = {};
      var setPos = function() {
        layers.forEach(function(l) {
          l.forEach(function(i, k) { posIn[i] = k; });
        });
      };
      setPos();
      var bary = function(i, nbrs) {
        var s = 0,
          c = 0;
        nbrs.forEach(function(j) {
          if (posIn[j] !== undefined && inComp[j]) {
            s += posIn[j];
            c++;
          }
        });
        return c ? s / c : posIn[i];
      };
      for (var it = 0; it < 4; it++) {
        for (var a = 1; a < layers.length; a++) {
          layers[a].sort(function(x, y) { return bary(x, pred[x]) - bary(y, pred[y]); });
          setPos();
        }
        for (var b = layers.length - 2; b >= 0; b--) {
          layers[b].sort(function(x, y) { return bary(x, succ[x]) - bary(y, succ[y]); });
          setPos();
        }
      }

      // columns as wide as their widest node, nodes stacked by their heights
      var colX = [],
        x = 80,
        colH = [],
        maxH = 0;
      layers.forEach(function(l, li) {
        var w = 0,
          h = 0;
        l.forEach(function(i) {
          var b = boxOf(nodes[i]);
          w = Math.max(w, b.w);
          h += b.h + GAP_Y;
        });
        colX[li] = x + w / 2;
        x += w + GAP_X;
        colH[li] = h - GAP_Y;
        maxH = Math.max(maxH, colH[li]);
      });
      layers.forEach(function(l, li) {
        var y = top + (maxH - colH[li]) / 2;
        l.forEach(function(i) {
          var b = boxOf(nodes[i]);
          nodes[i].x = Math.round(colX[li]);
          nodes[i].y = Math.round(y + b.h / 2);
          y += b.h + GAP_Y;
        });
      });
      top += maxH + 60;
    });
  }

  function nearestDistances(pts) {
    var out = [];
    var n = pts.length;
    var step = n > 600 ? Math.ceil(n / 600) : 1;
    for (var i = 0; i < n; i += step) {
      var best = Infinity;
      for (var j = 0; j < n; j++) {
        if (i === j) continue;
        var dx = pts[i].x - pts[j].x,
          dy = pts[i].y - pts[j].y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < best) best = d;
      }
      if (best < Infinity) out.push(best);
    }
    return out.sort(function(a, b) { return a - b; });
  }

  // Scale factor that separates (nearly) all boxes: for each node, the
  // smallest scale at which it no longer overlaps any other node; take the
  // 90th percentile so a few overlaps that exist in the source don't blow
  // the whole drawing up. Very sparse drawings are compacted.
  function scaleToFit(nodes) {
    var n = nodes.length;
    if (n < 2) return 1;
    var boxes = nodes.map(boxOf);
    var step = n > 400 ? Math.ceil(n / 400) : 1;
    var need = [];
    for (var i = 0; i < n; i += step) {
      var worst = 0;
      for (var j = 0; j < n; j++) {
        if (i === j) continue;
        var dx = Math.abs(nodes[i].x - nodes[j].x),
          dy = Math.abs(nodes[i].y - nodes[j].y);
        var sx = dx ? ((boxes[i].w + boxes[j].w) / 2 + 20) / dx : Infinity,
          sy = dy ? ((boxes[i].h + boxes[j].h) / 2 + 14) / dy : Infinity;
        var s = Math.min(sx, sy);
        if (s > worst) worst = s;
      }
      need.push(worst);
    }
    need.sort(function(a, b) { return a - b; });
    var p = need[Math.min(need.length - 1, Math.floor(need.length * 0.9))];
    if (!isFinite(p)) p = 6;
    if (p > 1.05) return Math.min(p, 6);
    if (p < 0.5) return p / 0.6; // lots of empty space: tighten, keeping a margin
    return 1;
  }

  function sizeScale(nodes) {
    var rw = [],
      rh = [];
    nodes.forEach(function(n) {
      var x = n._xpdl;
      if (!x || n.type !== 'activity' || !x.kind) return;
      // JaWE 1.x offsets carry no size: its boxes are 90x60
      var fw = x.w || (x.kind === 'offset' || x.kind === 'jawe' ? 90 : 0),
        fh = x.h || (x.kind === 'offset' || x.kind === 'jawe' ? 60 : 0);
      if (!fw || !fh) return;
      var b = boxOf(n);
      rw.push(b.w / fw);
      rh.push(b.h / fh);
    });
    if (!rw.length) return null;
    var med = function(a) {
      a.sort(function(p, q) { return p - q; });
      return a[a.length >> 1];
    };
    return Math.min(Math.max(med(rw), med(rh), 1), 6);
  }

  // position every node, then scale/translate into the editor's space
  // returns the transform used: editor = file * s - left + mx (same for y), or
  // null when the positions were generated (no file coordinates)
  function layoutGraph(ctx, nodes, edges, positioned, native, laneInfo) {
    var withPos = nodes.filter(function(n) { return positioned[n.id]; });
    var missing = nodes.length - withPos.length;

    var useAuto = withPos.length === 0 || missing > nodes.length * 0.25;
    if (!useAuto && withPos.length > 2) {
      var d = nearestDistances(withPos);
      var zeros = d.filter(function(v) { return v < 1; }).length;
      if (zeros > d.length * 0.3) useAuto = true;
    }

    if (useAuto) {
      if (nodes.length) {
        autoLayout(nodes, edges);
        ctx.stats.autoLayout++;
      }
      return null;
    }

    // a few nodes lack positions: put them next to a connected node
    if (missing) {
      var maxY = Math.max.apply(null, withPos.map(function(n) { return n.y; }));
      var minX = Math.min.apply(null, withPos.map(function(n) { return n.x; }));
      var spare = 0;
      nodes.forEach(function(n) {
        if (positioned[n.id]) return;
        var nb = null;
        edges.forEach(function(e) {
          if (!nb && e.source === n && positioned[e.target.id]) nb = {n: e.target, dx: -1};
          if (!nb && e.target === n && positioned[e.source.id]) nb = {n: e.source, dx: 1};
        });
        if (nb) {
          n.x = nb.n.x + nb.dx * 110;
          n.y = nb.n.y + 70;
        } else {
          n.x = minX + (spare++) * 110;
          n.y = maxY + 140;
        }
      });
    }

    // this editor's own format is already in editor coordinates
    if (native && !missing) return {s: 1, left: 0, top: 0, mx: 0, my: 0};

    // Scale from shape sizes (editor box vs the file's own Width/Height), so a
    // file always opens at the same scale no matter how its nodes are arranged.
    // Only files without any size information fall back to spacing-based fitting.
    var s = sizeScale(nodes) || scaleToFit(nodes);
    // scale, then move so the top-left box edges sit 40px from the origin
    nodes.forEach(function(n) {
      n.x *= s;
      n.y *= s;
    });
    var left = Infinity,
      top = Infinity;
    nodes.forEach(function(n) {
      var b = boxOf(n);
      left = Math.min(left, n.x - b.w / 2);
      top = Math.min(top, n.y - b.h / 2);
    });
    var mx = 40,
      my = 40;
    if (laneInfo) {
      // keep whole lanes in view and leave room for the lane/pool headers
      var header = LANE_HEADER + (laneInfo.poolName ? POOL_HEADER : 0) + 16;
      laneInfo.bands.forEach(function(b) {
        if (b.rect) {
          left = Math.min(left, b.rect.x * s);
          top = Math.min(top, b.rect.y * s);
        } else if (laneInfo.vertical) {
          left = Math.min(left, b.start * s);
          top = Math.min(top, 0);
        } else {
          top = Math.min(top, b.start * s);
          left = Math.min(left, 0);
        }
      });
      if (laneInfo.mode === 'stacked') {
        if (laneInfo.vertical) my = 10 + header;
        else mx = 10 + header;
        if (laneInfo.vertical) mx = 10;
        else my = 10;
      } else {
        mx = my = 10;
      }
    }
    nodes.forEach(function(n) {
      n.x = Math.round(n.x - left + mx);
      n.y = Math.round(n.y - top + my);
    });
    return {s: s, left: left, top: top, mx: mx, my: my};
  }

  var LANE_HEADER = 28,
    POOL_HEADER = 24;

  // file coordinates -> editor coordinates for lane bands
  function lanesToEditor(laneInfo, t) {
    if (!laneInfo || !t) return null;
    var out = {vertical: laneInfo.vertical, mode: laneInfo.mode, poolName: laneInfo.poolName || '', bands: []};
    laneInfo.bands.forEach(function(b) {
      var e = {id: b.id, name: b.name, fill: b.fill || null, performer: b.performer || ''};
      if (b.rect) {
        e.x = b.rect.x * t.s - t.left + t.mx;
        e.y = b.rect.y * t.s - t.top + t.my;
        e.w = b.rect.w * t.s;
        e.h = b.rect.h * t.s;
      } else if (laneInfo.vertical) {
        e.x = b.start * t.s - t.left + t.mx;
        e.w = b.size * t.s;
        e.y = 0 * t.s - t.top + t.my; // lane body starts at the lane-relative origin
      } else {
        e.y = b.start * t.s - t.top + t.my;
        e.h = b.size * t.s;
        e.x = 0 * t.s - t.left + t.mx;
      }
      out.bands.push(e);
    });
    return out;
  }

  /* --------------------------- one graph ------------------------------ */

  // container = WorkflowProcess or ActivitySet; markerExt = ext attrs holding
  // Start/End markers (process for the main graph, block activity for a set)
  function buildGraph(ctx, container, markerExt, visiting) {
    var nodes = [],
      edges = [],
      byRaw = {},
      positioned = {};
    var items = []; // layout entries before resolution

    kids(kid(container, 'Activities'), 'Activity').forEach(function(act) {
      var info = classify(act);
      var r = makeActivity(ctx, act, info);
      nodes.push(r.node);
      if (r.rawId) byRaw[r.rawId] = r.node;
      var box = !r.pos ? {w: 0, h: 0} : r.pos.rect ? {w: r.pos.rect.w, h: r.pos.rect.h} :
        r.pos.kind === 'jawe' ? {w: 90, h: 60} : {w: 0, h: 0};
      hide(r.node, '_xpdl', {rawId: r.rawId, kind: r.pos ? r.pos.kind : null, lane: r.pos ? r.pos.lane : null,
        w: box.w, h: box.h, eventName: r.node.eventName || ''});
      if (r.pos) items.push({node: r.node, x: r.pos.x, y: r.pos.y, kind: r.pos.kind, lane: r.pos.lane});

      if (info.component === 'blockActivity') {
        ctx.stats.blocks++;
        var setEl = info.blockId ? ctx.activitySets[info.blockId] : null;
        var setId = ctx.safeId(info.blockId || (r.node.id + '_Set'), 'set');
        var sub = {nodes: [], edges: [], participants: []};
        if (setEl && !visiting[info.blockId]) {
          var v2 = {};
          for (var k in visiting) v2[k] = true;
          v2[info.blockId] = true;
          sub = buildGraph(ctx, setEl, r.ext, v2);
        } else if (!setEl) {
          ctx.warn('Block activity "' + r.node.title + '" refers to a missing activity set; it was imported empty.');
        }
        r.node.activitySet = {
          activitySetId: setId,
          graphCreator: typeof global.wrapGraphData === 'function' ? global.wrapGraphData(sub) : sub
        };
        hide(r.node.activitySet, 'xpdl', {setRawId: info.blockId || null, layout: sub.layout || null, laneInfo: sub.laneInfo || null});
      }
    });

    // Start/End markers (XPDL 1.0 style)
    var markerNodes = [];
    parseMarkers(markerExt || []).forEach(function(m) {
      var existing = null;
      if (m.x !== null && m.y !== null) {
        markerNodes.forEach(function(mn) {
          if (mn.type === m.type && mn.mx === m.x && mn.my === m.y && mn.lane === m.lane) existing = mn.node;
        });
      }
      var node = existing;
      if (node) node._xpdl.rawMarkers.push({name: m.rawName, value: m.raw, activity: m.activity});
      if (!node) {
        node = {
          id: ctx.safeId(m.type + '_' + (ctx.counter + 1), m.type),
          title: m.type === 'start' ? 'S' : 'E',
          component: m.type === 'start' ? 'startComponent' : 'endComponent',
          type: m.type
        };
        nodes.push(node);
        ctx.stats.startEnd++;
        hide(node, '_xpdl', {marker: true, kind: m.jawe ? 'jawe' : 'offset', lane: m.lane, w: m.jawe ? 31 : 0, h: m.jawe ? 31 : 0,
          rawMarkers: [{name: m.rawName, value: m.raw, activity: m.activity}]});
        markerNodes.push({node: node, type: m.type, mx: m.x, my: m.y, lane: m.lane});
        if (m.x !== null && m.y !== null) {
          items.push({node: node, x: m.x, y: m.y, kind: m.jawe ? 'jawe' : 'offset', lane: m.lane});
        }
      }
      var act = byRaw[m.activity];
      if (act) {
        var me = {
          edgeId: ctx.safeId('', 'tra'),
          drawLine: m.drawLine,
          postCondition: {},
          source: m.type === 'start' ? node : act,
          target: m.type === 'start' ? act : node
        };
        hide(me, '_xpdl', {marker: true, value: m.raw, name: m.rawName});
        edges.push(me);
      }
    });

    // resolve lane-relative coordinates
    var pem = extMap(extAttrs(ctx.proc.el));
    var jaweMode = items.some(function(it) { return it.kind === 'jawe'; }) ||
      !!(pem.ParticipantVisualOrder || pem.JaWE_GRAPH_WORKFLOW_PARTICIPANT_ORDER);
    var laneItems = items.filter(function(it) {
      return it.kind === 'jawe' || (it.kind === 'offset' && jaweMode);
    });
    var laneInfo = null;
    if (laneItems.length) laneInfo = resolveJaweLanes(ctx, laneItems);
    var ngiItems = items.filter(function(it) { return it.kind === 'ngi'; });
    if (ngiItems.length && container === ctx.proc.el) laneInfo = resolveNgiLanes(ctx, ngiItems) || laneInfo;
    items.forEach(function(it) {
      it.node.x = it.x;
      it.node.y = it.y;
      positioned[it.node.id] = true;
    });

    // transitions
    kids(kid(container, 'Transitions'), 'Transition').forEach(function(tr) {
      var from = byRaw[attr(tr, 'From')],
        to = byRaw[attr(tr, 'To')];
      if (!from || !to) {
        ctx.stats.skippedTransitions++;
        ctx.warn('Skipped transition(s) that point to activities not in this process (e.g. "' + (attr(tr, 'Id') || '?') + '").');
        return;
      }
      if (from.type === 'end' || to.type === 'start') {
        ctx.stats.skippedTransitions++;
        ctx.warn('Skipped transition(s) leaving an End event or entering a Start event.');
        return;
      }
      var ext = extAttrs(tr),
        em = extMap(ext);
      var cond = kid(tr, 'Condition');
      var condType = String(attr(cond, 'Type') || '').toUpperCase();
      var condText = stripOuterParens(text(cond));
      var pc = {
        edgeName: cleanName(attr(tr, 'Name')),
        description: text(kid(tr, 'Description')),
        transitionEventType: em.TransitionEventType,
        transitionRuleType: em.TransitionRuleType || '',
        transitionEvent: em.TransitionEvent || '',
        extendedAttrs: []
      };
      if (em.conditype && (em.conditype !== 'WORKFLOWBEAN' && em.conditype !== 'CONDITION' || em.condixml)) {
        // written by this editor: keep its own condition model
        pc.conditype = em.conditype;
        if (em.condixml) pc.condixml = em.condixml;
        if (em.condiException) pc.condiException = em.condiException;
        if (condText && (em.conditype === 'USERDEFINE' || em.conditype === 'CUSTOM')) pc.condition_data = condText;
      } else if (condType === 'OTHERWISE' || condType === 'EXCEPTION' || condType === 'DEFAULTEXCEPTION') {
        pc.conditype = condType;
        if (condType === 'EXCEPTION' && condText) pc.condiException = condText;
      } else if (condText) {
        pc.conditype = 'USERDEFINE';
        pc.condition_data = condText;
      }
      ext.forEach(function(a) {
        if (!a.name || KNOWN_TRANSITION_EXT[a.name] || isLayoutExt(a.name)) return;
        pc.extendedAttrs.push(JSON.stringify({name: a.name, value: a.value}));
      });
      var edge = {
        edgeId: ctx.safeId(attr(tr, 'Id'), 'tra'),
        _rawId: attr(tr, 'Id'),
        drawLine: routing(em.RoutingType || em.JaWE_GRAPH_TRANSITION_STYLE),
        postCondition: pc,
        source: from,
        target: to
      };
      var lc = lineColorOf(tr, em);
      if (lc) edge.color = lc;
      edges.push(edge);
      ctx.stats.transitions++;
    });

    var native = !jaweMode && items.length > 0 && items.every(function(it) { return it.kind === 'offset'; });
    var layout = layoutGraph(ctx, nodes, edges, positioned, native, laneInfo);

    // remember where everything came from, so saving can patch the original file
    nodes.forEach(function(n) {
      var x = n._xpdl || {};
      if (!n._xpdl) hide(n, '_xpdl', x);
      x.ex = n.x;
      x.ey = n.y;
      x.hadPos = !!positioned[n.id];
      x.snap = snapshotNode(n);
    });
    edges.forEach(function(e) {
      var raw = e._rawId;
      delete e._rawId;
      if (!e._xpdl) hide(e, '_xpdl', {rawId: raw, from: e.source, to: e.target});
      e._xpdl.snap = snapshotEdge(e);
    });
    var g = {nodes: nodes, edges: edges, participants: []};
    hide(g, 'layout', layout);
    hide(g, 'laneInfo', laneInfo);
    return g;
  }

  function readParticipants(ctx) {
    var seen = {},
      out = [];
    var lists = [];
    if (ctx.pkgInfo.pkg) lists.push(kid(ctx.pkgInfo.pkg, 'Participants'));
    lists.push(kid(ctx.proc.el, 'Participants'));
    lists.forEach(function(list) {
      kids(list, 'Participant').forEach(function(p) {
        var id = attr(p, 'Id');
        if (!id || seen[id]) return;
        seen[id] = true;
        var participant = {
          conventional_definition_id: id,
          conventional_definition_name: cleanName(attr(p, 'Name')),
          conventional_definition_description: text(kid(p, 'Description')),
          conventional_definition_participant: '',
          typeName: [], isAppData: [], itemName: [], itemValue: [], secLevelS: [],
          secLevelE: [], condition: [], conditionXml: [], roleName: []
        };
        extAttrs(p).forEach(function(a) {
          if (a.name === 'PartyBeanId') participant.conventional_definition_participant = a.value;
          else if (participant[a.name] instanceof Array) participant[a.name] = a.value ? a.value.split(',') : [];
        });
        out.push(participant);
      });
    });
    return out;
  }

  function build(pkgInfo, processIndex) {
    var proc = pkgInfo.processes[processIndex || 0];
    if (!proc) throw new Error('Process not found.');
    var ctx = new Context(pkgInfo, proc);
    var graph = buildGraph(ctx, proc.el, extAttrs(proc.el), {});

    if (!graph.nodes.length) ctx.warn('This process has no activities.');
    if (ctx.stats.renamedIds) ctx.warn(ctx.stats.renamedIds + ' id(s) contained characters the editor cannot use and were adjusted.');
    if (ctx.stats.autoLayout) ctx.warn('Some diagrams had no usable layout information and were arranged automatically.');
    var msgFlows = pkgInfo.pkg ? descendants(pkgInfo.pkg, 'MessageFlow').length : 0;
    if (msgFlows) ctx.warn(msgFlows + ' message flow(s) between pools are not shown (the editor shows one process at a time).');

    var source = {
      text: pkgInfo.text,
      processId: proc.id,
      processIndex: proc.index,
      version: pkgInfo.version,
      layout: graph.layout,
      laneInfo: graph.laneInfo
    };
    return {
      source: source,
      lanes: lanesToEditor(graph.laneInfo, graph.layout),
      packageId: pkgInfo.id,
      packageName: pkgInfo.name,
      version: pkgInfo.version,
      processId: proc.id,
      processName: proc.name,
      nodes: graph.nodes,
      edges: graph.edges,
      participants: readParticipants(ctx),
      warnings: ctx.warnings,
      stats: ctx.stats
    };
  }

  global.XpdlImport = {
    decode: decode,
    read: read,
    build: build,
    snapshotNode: snapshotNode,
    snapshotEdge: snapshotEdge,
    // shared with the saver (js/xpdlSave.js)
    _util: {ln: ln, kids: kids, kid: kid, path: path, attr: attr, text: text, num: num, parseXml: parseXml,
      extAttrs: extAttrs, extMap: extMap, descendants: descendants, graphicsOf: graphicsOf, color: color,
      isLayoutExt: isLayoutExt, KNOWN_ACTIVITY_EXT: KNOWN_ACTIVITY_EXT, KNOWN_TRANSITION_EXT: KNOWN_TRANSITION_EXT}
  };
})(window);
