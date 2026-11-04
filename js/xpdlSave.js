/**
 * XPDL saver: writes the edited process back into the ORIGINAL file.
 *
 * Instead of generating a new document, the original XPDL text is parsed
 * again and only what was changed in the editor is patched in. Everything
 * else (pools, lanes, applications, participants, data fields, scripts,
 * other processes, tool-specific attributes, comments, formatting) is kept
 * exactly as it was. Saving without changes reproduces the original file.
 *
 * Handled: names, descriptions, performers, start/finish modes, limits,
 * deadlines, join types, colours, extended attributes, positions (including
 * moving between lanes, which also updates the performer like TWE does),
 * added/removed activities, transitions and conditions, split/join
 * transition references, block activities (activity sets) and the XPDL 1.0
 * Start/End markers. New elements are written in the file's own style
 * (namespace prefix, indentation, colour format, TWE sizes and gateway names).
 *
 * Public API (window.XpdlSave):
 *   canSave(graph)  -> true when the graph came from an XPDL file
 *   save(graph)     -> XPDL text
 */
(function(global) {
  'use strict';

  var U = global.XpdlImport._util;
  var ln = U.ln,
    kids = U.kids,
    kid = U.kid,
    attr = U.attr;

  // XPDL 2.x child order (1.0 is a subset in the same order)
  var ORDER = {
    WorkflowProcess: ['ProcessHeader', 'RedefinableHeader', 'FormalParameters', 'InputSets', 'OutputSets',
      'Participants', 'Applications', 'DataFields', 'ActivitySets', 'Activities', 'Transitions',
      'ExtendedAttributes', 'Assignments', 'PartnerLinks', 'Object', 'Extensions'],
    ActivitySet: ['Activities', 'Transitions', 'Object'],
    Activity: ['Description', 'Limit', 'Route', 'Implementation', 'BlockActivity', 'Event', 'Transaction',
      'Performers', 'Performer', 'StartMode', 'FinishMode', 'Priority', 'Deadline', 'SimulationInformation',
      'Icon', 'Documentation', 'TransitionRestrictions', 'ExtendedAttributes', 'DataFields', 'InputSets',
      'OutputSets', 'IORules', 'Loop', 'Assignments', 'Object', 'NodeGraphicsInfos', 'Extensions'],
    Transition: ['Condition', 'Description', 'ExtendedAttributes', 'Assignments', 'Object', 'ConnectorGraphicsInfos'],
    TransitionRestriction: ['Join', 'Split'],
    Deadline: ['DeadlineDuration', 'DeadlineCondition', 'ExceptionName']
  };

  // pseudo attributes the importer adds to keep information visible; never written back
  var PSEUDO_EXT = {XPDL_JoinType: 1, XPDL_IntermediateEvent: 1, XPDL_GatewayType: 1};

  function canSave(graph) {
    return !!(graph && graph.xpdlSource && graph.xpdlSource.text);
  }

  /* ------------------------------------------------------------------ */
  /* Writer context and DOM helpers                                      */
  /* ------------------------------------------------------------------ */

  function Writer(doc, procEl, version) {
    this.doc = doc;
    this.ns = procEl.namespaceURI;
    this.prefix = procEl.prefix;
    var v = String(version || '');
    this.v2 = /XPDL2|2004|2008|2009/.test(this.ns || '') || /^2/.test(v);
    this.unit = detectIndentUnit(doc);
    this.toolId = detectToolId(doc);
    this.colorFormat = detectColorFormat(doc);
    this.jaweOffsets = U.descendants(doc.documentElement, 'ExtendedAttribute').some(function(e) {
      return e.getAttribute('Name') === 'JaWE_GRAPH_OFFSET';
    });
    this.usedIds = {};
    var all = doc.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) {
      var id = all[i].getAttribute('Id');
      if (id) this.usedIds[id] = true;
    }
  }

  Writer.prototype.make = function(name, attrs) {
    var el = this.ns ? this.doc.createElementNS(this.ns, this.prefix ? this.prefix + ':' + name : name) :
      this.doc.createElement(name);
    for (var k in attrs || {}) {
      if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== '') el.setAttribute(k, String(attrs[k]));
    }
    return el;
  };

  // editor-internal ids (UUIDs) become readable, file-style ids
  Writer.prototype.niceId = function(wanted, kind) {
    if (wanted && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(wanted)) return this.uniqueId(wanted);
    var base = (attr(this.proc, 'Id') || 'process') + '_' + kind;
    var n = 1;
    while (this.usedIds[base + n]) n++;
    return this.uniqueId(base + n);
  };

  Writer.prototype.uniqueId = function(wanted) {
    var base = String(wanted || 'id').replace(/[^A-Za-z0-9_.-]/g, '_');
    if (!/^[A-Za-z_]/.test(base)) base = '_' + base;
    var id = base,
      n = 2;
    while (this.usedIds[id]) id = base + '_' + (n++);
    this.usedIds[id] = true;
    return id;
  };

  function detectIndentUnit(doc) {
    var root = doc.documentElement;
    var a = kids(root)[0];
    var b = a && kids(a)[0];
    var ia = a ? indentOf(a) : '',
      ib = b ? indentOf(b) : '';
    if (ib.length > ia.length) return ib.slice(ia.length);
    return '    ';
  }

  function detectToolId(doc) {
    var all = doc.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) {
      if (ln(all[i]) === 'NodeGraphicsInfo' && all[i].getAttribute('ToolId')) return all[i].getAttribute('ToolId');
    }
    return 'JaWE';
  }

  function detectColorFormat(doc) {
    var all = doc.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) {
      var v = all[i].getAttribute('FillColor') || all[i].getAttribute('BorderColor');
      if (!v) continue;
      if (/^\d+\s*,\s*\d+\s*,\s*\d+$/.test(v)) return 'csv';
      if (/^\d+\s*;\s*\d+\s*;\s*\d+$/.test(v)) return 'ssv';
      if (/^-?\d+$/.test(v)) return 'argb';
      if (/^#/.test(v)) return 'hex';
    }
    return 'csv';
  }

  Writer.prototype.formatColor = function(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    var v = parseInt(m[1], 16),
      r = (v >> 16) & 255,
      g = (v >> 8) & 255,
      b = v & 255;
    switch (this.colorFormat) {
      case 'ssv': return r + ';' + g + ';' + b;
      case 'argb': return String((0xFF000000 | v) >> 0);
      case 'hex': return '#' + m[1].toUpperCase();
      default: return r + ',' + g + ',' + b;
    }
  };

  function indentOf(el) {
    var p = el.previousSibling;
    if (p && p.nodeType === 3) {
      var m = /\n([ \t]*)$/.exec(p.nodeValue);
      if (m) return m[1];
    }
    return '';
  }

  Writer.prototype.childIndent = function(parent) {
    var c = kids(parent)[0];
    if (c) {
      var i = indentOf(c);
      if (i || c.previousSibling) return i;
    }
    return indentOf(parent) + this.unit;
  };

  // insert `el` into `parent` respecting the schema order, with indentation
  Writer.prototype.insert = function(parent, el, order) {
    var doc = this.doc;
    var ind = this.childIndent(parent);
    var before = null;
    if (order) {
      var idx = order.indexOf(ln(el));
      var ch = kids(parent);
      for (var i = 0; i < ch.length && idx >= 0; i++) {
        var ci = order.indexOf(ln(ch[i]));
        if (ci > idx) {
          before = ch[i];
          break;
        }
      }
    }
    if (before) {
      parent.insertBefore(el, before);
      parent.insertBefore(doc.createTextNode('\n' + ind), before);
    } else {
      var last = parent.lastChild;
      if (last && last.nodeType === 3 && /^\s*$/.test(last.nodeValue) && last.previousSibling) {
        parent.insertBefore(doc.createTextNode('\n' + ind), last);
        parent.insertBefore(el, last);
      } else if (last && last.nodeType === 3 && /^\s*$/.test(last.nodeValue)) {
        parent.insertBefore(doc.createTextNode('\n' + ind), last);
        parent.insertBefore(el, last);
      } else {
        parent.appendChild(doc.createTextNode('\n' + ind));
        parent.appendChild(el);
        parent.appendChild(doc.createTextNode('\n' + indentOf(parent)));
      }
    }
    this.pretty(el, ind);
    return el;
  };

  // indent a freshly built subtree (only elements without text content)
  Writer.prototype.pretty = function(el, ind) {
    var ch = kids(el);
    if (!ch.length) return;
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === 3 && /\S/.test(el.childNodes[i].nodeValue)) return;
    }
    var inner = ind + this.unit;
    var self = this;
    ch.forEach(function(c) {
      el.insertBefore(self.doc.createTextNode('\n' + inner), c);
      self.pretty(c, inner);
    });
    el.appendChild(this.doc.createTextNode('\n' + ind));
  };

  function remove(el) {
    if (!el || !el.parentNode) return;
    var p = el.previousSibling;
    if (p && p.nodeType === 3 && /^\s*$/.test(p.nodeValue)) p.parentNode.removeChild(p);
    el.parentNode.removeChild(el);
  }

  Writer.prototype.ensure = function(parent, name, order) {
    var c = kid(parent, name);
    if (c) return c;
    return this.insert(parent, this.make(name), order || ORDER[ln(parent)]);
  };

  function setText(el, value) {
    while (el.firstChild) el.removeChild(el.firstChild);
    if (value !== '' && value !== null && value !== undefined) el.appendChild(el.ownerDocument.createTextNode(String(value)));
  }

  // child element holding plain text (Description, Limit, ...); removed when empty
  Writer.prototype.setChildText = function(parent, name, value, order) {
    var c = kid(parent, name);
    if (!value) {
      if (c) remove(c);
      return;
    }
    if (!c) c = this.insert(parent, this.make(name), order || ORDER[ln(parent)]);
    setText(c, value);
  };

  function setAttr(el, name, value) {
    if (value === '' || value === null || value === undefined) el.removeAttribute(name);
    else el.setAttribute(name, String(value));
  }

  /* --------------------------- extended attributes ------------------- */

  Writer.prototype.extEl = function(owner, name) {
    var ea = kid(owner, 'ExtendedAttributes');
    var list = kids(ea, 'ExtendedAttribute');
    for (var i = 0; i < list.length; i++) {
      if (attr(list[i], 'Name') === name) return list[i];
    }
    return null;
  };

  Writer.prototype.setExt = function(owner, name, value, order) {
    var e = this.extEl(owner, name);
    if (value === undefined || value === null) {
      if (e) remove(e);
      return;
    }
    if (!e) {
      var ea = this.ensure(owner, 'ExtendedAttributes', order || ORDER[ln(owner)]);
      e = this.insert(ea, this.make('ExtendedAttribute', {Name: name}));
    }
    // keep values written as element content in that form
    if (!e.hasAttribute('Value') && /\S/.test(e.textContent)) setText(e, value);
    else e.setAttribute('Value', String(value));
  };

  // user extended attributes (the editor's "Extended Attribute Set")
  Writer.prototype.syncUserExt = function(owner, list, known) {
    var wanted = {},
      order = [];
    (list || []).forEach(function(s) {
      try {
        var o = JSON.parse(s);
        if (!o.name || PSEUDO_EXT[o.name]) return;
        if (!(o.name in wanted)) order.push(o.name);
        wanted[o.name] = o.value === undefined ? '' : o.value;
      } catch (e) { /* ignore */ }
    });
    var self = this;
    kids(kid(owner, 'ExtendedAttributes'), 'ExtendedAttribute').forEach(function(e) {
      var n = attr(e, 'Name');
      if (!n || known[n] || U.isLayoutExt(n)) return;
      if (!(n in wanted)) remove(e);
    });
    order.forEach(function(n) {
      self.setExt(owner, n, wanted[n]);
    });
  };

  /* ------------------------------------------------------------------ */
  /* Positions and lanes                                                 */
  /* ------------------------------------------------------------------ */

  // editor coordinates -> file coordinates (centre of the shape)
  function toFile(n, layout) {
    if (!layout) return {x: n.x, y: n.y};
    return {x: (n.x + layout.left - layout.mx) / layout.s, y: (n.y + layout.top - layout.my) / layout.s};
  }

  function findLane(laneInfo, p) {
    if (!laneInfo || !laneInfo.bands.length) return null;
    var bands = laneInfo.bands,
      best = null,
      bestD = Infinity;
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i],
        d;
      if (b.rect) {
        var dx = Math.max(b.rect.x - p.x, 0, p.x - (b.rect.x + b.rect.w));
        var dy = Math.max(b.rect.y - p.y, 0, p.y - (b.rect.y + b.rect.h));
        d = dx + dy;
      } else {
        var v = laneInfo.vertical ? p.x : p.y;
        d = Math.max(b.start - v, 0, v - (b.start + b.size));
      }
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  // TWE default sizes for new shapes
  function defaultBox(n) {
    if (n.type === 'start' || n.type === 'end') return {w: 31, h: 31};
    if (n.component === 'routeActivity') return {w: 43, h: 43};
    return {w: 90, h: 60};
  }

  function moved(n) {
    var x = n._xpdl;
    if (!x) return true;
    return Math.abs(n.x - x.ex) > 0.5 || Math.abs(n.y - x.ey) > 0.5;
  }

  // writes the position; returns the lane the node ends up in (or null)
  Writer.prototype.writePosition = function(el, n, layout, laneInfo, isNew) {
    var x = n._xpdl || {};
    var p = toFile(n, layout);
    if (!isFinite(p.x) || !isFinite(p.y)) return null; // never write broken coordinates
    var lane = findLane(laneInfo, p);
    var kind = !isNew && x.kind ? x.kind :
      kid(el, 'NodeGraphicsInfos') || this.v2 ? 'ngi' : this.jaweOffsets ? 'jawe' : 'offset';
    var box = !isNew && (x.w || x.h) ? {w: x.w, h: x.h} :
      kind === 'ngi' ? defaultBox(n) : kind === 'jawe' ? (n.type === 'activity' ? {w: 90, h: 60} : {w: 31, h: 31}) : {w: 0, h: 0};
    var vertical = laneInfo && laneInfo.vertical;
    var lx = p.x - box.w / 2,
      ly = p.y - box.h / 2;
    if (lane && laneInfo.mode === 'stacked') {
      if (vertical) lx -= lane.start;
      else ly -= lane.start;
    } else if (lane && laneInfo.mode === 'rel') {
      lx -= lane.rect.x;
      ly -= lane.rect.y;
    }
    lx = Math.round(lx);
    ly = Math.round(ly);

    if (kind === 'ngi') {
      var infos = this.ensure(el, 'NodeGraphicsInfos', ORDER.Activity);
      var list = kids(infos, 'NodeGraphicsInfo');
      var ngi = null;
      for (var i = 0; i < list.length && !ngi; i++) {
        if (kid(list[i], 'Coordinates')) ngi = list[i];
      }
      ngi = ngi || list[0];
      if (!ngi) {
        ngi = this.insert(infos, this.make('NodeGraphicsInfo', {
          BorderColor: this.colorFormat === 'csv' ? '0,0,0' : null,
          Height: box.h, IsVisible: 'true', ToolId: this.toolId, Width: box.w
        }));
      }
      if (lane && lane.id) ngi.setAttribute('LaneId', lane.id);
      var c = kid(ngi, 'Coordinates') || this.insert(ngi, this.make('Coordinates'));
      c.setAttribute('XCoordinate', String(lx));
      c.setAttribute('YCoordinate', String(ly));
    } else if (kind === 'jawe') {
      this.setExt(el, 'JaWE_GRAPH_OFFSET', Math.round(lx) + ',' + Math.round(ly));
      if (lane) this.setExt(el, 'JaWE_GRAPH_PARTICIPANT_ID', lane.id);
    } else {
      this.setExt(el, 'XOffset', String(lx));
      this.setExt(el, 'YOffset', String(ly));
      if (lane && laneInfo.mode === 'stacked') this.setExt(el, 'ParticipantID', lane.id);
    }
    return lane;
  };

  /* ------------------------------------------------------------------ */
  /* Activities                                                          */
  /* ------------------------------------------------------------------ */

  Writer.prototype.setPerformer = function(el, performer) {
    var perfs = kid(el, 'Performers');
    if (perfs || (this.v2 && !kid(el, 'Performer'))) {
      if (!performer) {
        if (perfs) remove(perfs);
        return;
      }
      perfs = perfs || this.insert(el, this.make('Performers'), ORDER.Activity);
      var p = kid(perfs, 'Performer') || this.insert(perfs, this.make('Performer'));
      setText(p, performer);
    } else {
      this.setChildText(el, 'Performer', performer, ORDER.Activity);
    }
    // legacy JaWE attribute kept in sync when present
    if (this.extEl(el, 'ParticipantID') && performer) this.setExt(el, 'ParticipantID', performer);
  };

  Writer.prototype.setMode = function(el, name, mode) {
    var v = mode === 'automatic' ? 'Automatic' : 'Manual';
    var child = kid(el, name);
    if (child) {
      while (child.firstChild) child.removeChild(child.firstChild);
      child.appendChild(this.make(v));
      return;
    }
    if (this.v2) el.setAttribute(name, v);
    else this.insert(el, (function(w) {
      var m = w.make(name);
      m.appendChild(w.make(v));
      return m;
    })(this), ORDER.Activity);
  };

  Writer.prototype.setColors = function(el, n, isNew) {
    if (this.v2 || kid(el, 'NodeGraphicsInfos')) {
      var infos = isNew || n.fillColor || n.borderColor ? this.ensure(el, 'NodeGraphicsInfos', ORDER.Activity) : kid(el, 'NodeGraphicsInfos');
      if (!infos) return;
      var ngi = kids(infos, 'NodeGraphicsInfo')[0];
      if (!ngi) ngi = this.insert(infos, this.make('NodeGraphicsInfo', {IsVisible: 'true', ToolId: this.toolId}));
      setAttr(ngi, 'FillColor', n.fillColor ? this.formatColor(n.fillColor) : null);
      setAttr(ngi, 'BorderColor', n.borderColor ? this.formatColor(n.borderColor) : null);
    } else {
      this.setExt(el, 'FillColor', n.fillColor || null);
      this.setExt(el, 'BorderColor', n.borderColor || null);
    }
    if (n.textColor || this.extEl(el, 'TextColor')) this.setExt(el, 'TextColor', n.textColor || null);
  };

  Writer.prototype.writeDeadlines = function(el, list) {
    var existing = kids(el, 'Deadline');
    var useCondition = existing.some(function(d) { return kid(d, 'DeadlineCondition'); }) || !this.v2;
    existing.forEach(remove);
    var self = this;
    (list || []).forEach(function(s) {
      var d;
      try {
        d = JSON.parse(s);
      } catch (e) {
        return;
      }
      var dl = self.make('Deadline', {Execution: d.execution || null});
      dl.appendChild(self.make(useCondition ? 'DeadlineCondition' : 'DeadlineDuration'));
      setText(dl.lastChild, d.deadlineCondition || '');
      dl.appendChild(self.make('ExceptionName'));
      setText(dl.lastChild, d.exceptionName || '');
      self.insert(el, dl, ORDER.Activity);
    });
  };

  var OTHER_EXT = ['taskAssignMode', 'MustActivity', 'isMulInstance', 'autoAcceptAllAssignments', 'isResponsible',
    'completeAllAssignments', 'assignmentsOrder', 'ActivityEndEvent', 'ActivityCreateEvent', 'FinishRule',
    'isResponsibleTem', 'responsible', 'warnTime', 'warnAgentClassName', 'LimitAgentClassName', 'isCreateNew', 'syncType'];

  // apply the editor's changes to an existing <Activity>
  Writer.prototype.updateActivity = function(el, n, layout, laneInfo) {
    var x = n._xpdl;
    var a = JSON.parse(x.snap),
      b = JSON.parse(XpdlImport.snapshotNode(n));
    var c = n.conventional || {};
    var isEvent = n.type === 'start' || n.type === 'end';
    if (!isEvent && a.title !== b.title) setAttr(el, 'Name', n.title);
    if (a.description !== b.description) this.setChildText(el, 'Description', c.description, ORDER.Activity);
    if (!isEvent) {
      if (a.startMode !== b.startMode) this.setMode(el, 'StartMode', c.startMode);
      if (a.finishMode !== b.finishMode) this.setMode(el, 'FinishMode', c.finishMode);
      if (a.limit !== b.limit) this.setChildText(el, 'Limit', n.timeoutLimit.limitTime, ORDER.Activity);
      if (JSON.stringify(a.deadline) !== JSON.stringify(b.deadline)) this.writeDeadlines(el, n.timeoutLimit.deadline);
      if (JSON.stringify(a.extendAttr) !== JSON.stringify(b.extendAttr)) this.syncUserExt(el, n.extendAttr, U.KNOWN_ACTIVITY_EXT);
      var self = this;
      OTHER_EXT.forEach(function(k) {
        if (JSON.stringify(a.other[k]) !== JSON.stringify(b.other[k])) {
          self.setExt(el, k, b.other[k] === undefined || b.other[k] === null ? null : String(b.other[k]));
        }
      });
    }
    if (a.fill !== b.fill || a.border !== b.border || a.text !== b.text) this.setColors(el, n, false);

    var performer = c.performer || '';
    var performerChanged = a.performer !== b.performer;
    if (moved(n)) {
      var lane = this.writePosition(el, n, layout, laneInfo, false);
      // moving into another lane hands the activity to that lane's participant (as in TWE)
      if (lane && lane.performer && lane.id !== x.lane && takesPerformer(n)) {
        performer = lane.performer;
        if (n.conventional) n.conventional.performer = performer;
        performerChanged = true;
      }
    }
    if (performerChanged && takesPerformer(n)) this.setPerformer(el, performer);
  };

  function takesPerformer(n) {
    return n.type === 'activity' && n.component !== 'routeActivity';
  }

  // build a new <Activity> for a node drawn in the editor
  Writer.prototype.createActivity = function(n, layout, laneInfo, container) {
    var isEvent = n.type === 'start' || n.type === 'end';
    var id = this.niceId(n.id, isEvent ? n.type : 'act');
    var el = this.make('Activity', {Id: id, Name: isEvent ? (n.eventName || null) : n.title});
    var c = n.conventional || {};
    if (c.description) {
      el.appendChild(this.make('Description'));
      setText(el.lastChild, c.description);
    }
    if (n.type === 'start' || n.type === 'end') {
      var ev = this.make('Event');
      ev.appendChild(n.type === 'start' ? this.make('StartEvent', {Trigger: 'None'}) : this.make('EndEvent', {Result: 'None'}));
      el.appendChild(ev);
    } else if (n.component === 'routeActivity') {
      el.appendChild(this.make('Route', this.v2 ? {GatewayType: (n.frontCondition || {}).convergeType === 'AND' ? 'Parallel' : 'Exclusive'} : {}));
    } else if (n.component === 'blockActivity') {
      var setId = n.activitySet && n.activitySet.activitySetId || id + '_Set';
      el.appendChild(this.make('BlockActivity', this.v2 ? {ActivitySetId: setId} : {BlockId: setId}));
    } else {
      var impl = this.make('Implementation');
      if (n.component === 'subFlowActivity') {
        impl.appendChild(this.make('SubFlow', {Id: n.subFlow && n.subFlow.id || null, Execution: n.subFlow && n.subFlow.execution || 'SYNCHR'}));
      } else {
        impl.appendChild(this.make('No'));
      }
      el.appendChild(impl);
    }
    var acts = this.ensure(container, 'Activities', ORDER[ln(container)]);
    this.insert(acts, el);

    var lane = this.writePosition(el, n, layout, laneInfo, true);
    var performer = c.performer || (lane && lane.performer) || '';
    if (lane && lane.performer && takesPerformer(n)) performer = lane.performer;
    if (performer && takesPerformer(n)) {
      this.setPerformer(el, performer);
      if (n.conventional) n.conventional.performer = performer;
    }
    if (!isEvent) {
      if (c.startMode === 'automatic') this.setMode(el, 'StartMode', 'automatic');
      if (c.finishMode === 'automatic') this.setMode(el, 'FinishMode', 'automatic');
      if (n.timeoutLimit && n.timeoutLimit.limitTime) this.setChildText(el, 'Limit', n.timeoutLimit.limitTime, ORDER.Activity);
      if (n.timeoutLimit && n.timeoutLimit.deadline && n.timeoutLimit.deadline.length) this.writeDeadlines(el, n.timeoutLimit.deadline);
      this.syncUserExt(el, n.extendAttr, U.KNOWN_ACTIVITY_EXT);
    }
    if (n.fillColor || n.borderColor || n.textColor) this.setColors(el, n, true);
    return el;
  };

  /* ------------------------------------------------------------------ */
  /* Transitions                                                         */
  /* ------------------------------------------------------------------ */

  Writer.prototype.writeCondition = function(tr, pc) {
    var type = '',
      value = '';
    switch (pc.conditype) {
      case 'OTHERWISE':
      case 'DEFAULTEXCEPTION':
        type = pc.conditype;
        break;
      case 'EXCEPTION':
        type = 'EXCEPTION';
        value = pc.condiException || '';
        break;
      case 'USERDEFINE':
      case 'CUSTOM':
      case 'CONDITION':
      case 'WORKFLOWBEAN':
      case 'TACHE':
        type = 'CONDITION';
        value = pc.condition_data || '';
        break;
    }
    var c = kid(tr, 'Condition');
    if (!type) {
      if (c) remove(c);
      return;
    }
    if (!c) c = this.insert(tr, this.make('Condition'), ORDER.Transition);
    c.setAttribute('Type', type);
    var expr = kid(c, 'Expression');
    if (expr) setText(expr, value);
    else setText(c, value);
  };

  Writer.prototype.updateTransition = function(tr, e) {
    var a = JSON.parse(e._xpdl.snap),
      b = JSON.parse(XpdlImport.snapshotEdge(e));
    var pc = e.postCondition || {};
    if (a.name !== b.name) setAttr(tr, 'Name', pc.edgeName);
    if (a.description !== b.description) this.setChildText(tr, 'Description', pc.description, ORDER.Transition);
    if (a.conditype !== b.conditype || a.condition !== b.condition || a.exception !== b.exception) this.writeCondition(tr, pc);
    if (JSON.stringify(a.ext) !== JSON.stringify(b.ext)) this.syncUserExt(tr, pc.extendedAttrs, U.KNOWN_TRANSITION_EXT);
    if (a.color !== b.color) this.setLineColor(tr, e.color);
  };

  Writer.prototype.setLineColor = function(tr, color) {
    if (this.v2 || kid(tr, 'ConnectorGraphicsInfos')) {
      var infos = color ? this.ensure(tr, 'ConnectorGraphicsInfos', ORDER.Transition) : kid(tr, 'ConnectorGraphicsInfos');
      if (!infos) return;
      var cgi = kids(infos, 'ConnectorGraphicsInfo')[0] ||
        this.insert(infos, this.make('ConnectorGraphicsInfo', {IsVisible: 'true', ToolId: this.toolId}));
      var key = cgi.hasAttribute('BorderColor') || !cgi.hasAttribute('FillColor') ? 'BorderColor' : 'FillColor';
      setAttr(cgi, key, color ? this.formatColor(color) : null);
    } else {
      this.setExt(tr, 'LineColor', color || null);
    }
  };

  Writer.prototype.createTransition = function(e, fromId, toId, container) {
    var pc = e.postCondition || {};
    var tr = this.make('Transition', {From: fromId, Id: this.niceId(e.edgeId, 'tra'), Name: pc.edgeName || null, To: toId});
    var trs = this.ensure(container, 'Transitions', ORDER[ln(container)]);
    this.insert(trs, tr);
    this.writeCondition(tr, pc);
    if (pc.description) this.setChildText(tr, 'Description', pc.description, ORDER.Transition);
    if (pc.extendedAttrs && pc.extendedAttrs.length) this.syncUserExt(tr, pc.extendedAttrs, U.KNOWN_TRANSITION_EXT);
    if (e.color) this.setLineColor(tr, e.color);
    return tr;
  };

  // keep Split TransitionRefs / Join in step with the transitions
  Writer.prototype.syncRestrictions = function(actEl, outIds, inCount, joinType) {
    var self = this;
    var trs = kid(actEl, 'TransitionRestrictions');
    var tr = kid(trs, 'TransitionRestriction');
    var split = kid(tr, 'Split'),
      join = kid(tr, 'Join');
    var ensureTr = function() {
      trs = trs || self.insert(actEl, self.make('TransitionRestrictions'), ORDER.Activity);
      tr = tr || self.insert(trs, self.make('TransitionRestriction'));
      return tr;
    };
    var xor = this.v2 ? 'Exclusive' : 'XOR',
      and = this.v2 ? 'Parallel' : 'AND';
    if (split) {
      var refs = kid(split, 'TransitionRefs') || this.insert(split, this.make('TransitionRefs'));
      var have = {};
      kids(refs, 'TransitionRef').forEach(function(r) {
        var id = attr(r, 'Id');
        if (outIds.indexOf(id) === -1) remove(r);
        else have[id] = true;
      });
      outIds.forEach(function(id) {
        if (!have[id]) self.insert(refs, self.make('TransitionRef', {Id: id}));
      });
    } else if (outIds.length > 1) {
      var s = this.make('Split', {Type: xor});
      var r2 = this.make('TransitionRefs');
      outIds.forEach(function(id) {
        r2.appendChild(self.make('TransitionRef', {Id: id}));
      });
      s.appendChild(r2);
      this.insert(ensureTr(), s, ORDER.TransitionRestriction);
    }
    if (joinType) {
      var t = joinType === 'AND' ? and : xor;
      if (join) join.setAttribute('Type', t);
      else this.insert(ensureTr(), this.make('Join', {Type: t}), ORDER.TransitionRestriction);
    } else if (!join && inCount > 1) {
      this.insert(ensureTr(), this.make('Join', {Type: xor}), ORDER.TransitionRestriction);
    }
  };

  /* ------------------------------------------------------------------ */
  /* XPDL 1.0 Start/End markers                                          */
  /* ------------------------------------------------------------------ */

  // Start/End markers are extended attributes of the process (or block
  // activity). Unchanged markers stay exactly where they are; only markers of
  // moved/new start-end nodes or changed connections are rewritten.
  Writer.prototype.syncMarkers = function(owner, nodes, edges, idOf, layout, laneInfo, isBlock) {
    var self = this;
    var existing = [];
    var kvStyle = false;
    kids(kid(owner, 'ExtendedAttributes'), 'ExtendedAttribute').forEach(function(e) {
      var n = attr(e, 'Name');
      if (/^(Start|End)Of(Workflow|Block)$/.test(n)) existing.push(e);
      if (/^JaWE_GRAPH_(START|END)_OF_(WORKFLOW|BLOCK)$/.test(n)) {
        existing.push(e);
        kvStyle = true;
      }
    });

    var wanted = [];
    var generate = function(n, other, e, kv) {
      var isStart = n.type === 'start';
      var p = toFile(n, layout);
      var lane = findLane(laneInfo, p);
      var lx = p.x - (kv ? 15 : 0),
        ly = p.y - (kv ? 15 : 0);
      if (lane && laneInfo.mode === 'stacked') {
        if (laneInfo.vertical) lx -= lane.start;
        else ly -= lane.start;
      }
      var style = e && e.drawLine === 'SIMPLEROUTING' ? 'SIMPLEROUTING' : 'NOROUTING';
      var otherId = other ? idOf(other) || '' : '';
      if (kv) {
        return {
          name: 'JaWE_GRAPH_' + (isStart ? 'START' : 'END') + '_OF_' + (isBlock ? 'BLOCK' : 'WORKFLOW'),
          value: 'JaWE_GRAPH_PARTICIPANT_ID=' + (lane ? lane.id : '') + ',CONNECTING_ACTIVITY_ID=' + otherId +
            ',X_OFFSET=' + Math.round(lx) + ',Y_OFFSET=' + Math.round(ly) +
            ',JaWE_GRAPH_TRANSITION_STYLE=' + (style === 'SIMPLEROUTING' ? 'SIMPLE_ROUTING_ORTHOGONAL' : 'NO_ROUTING_ORTHOGONAL') +
            ',TYPE=' + (isStart ? 'START' : 'END') + '_DEFAULT'
        };
      }
      return {
        name: (isStart ? 'Start' : 'End') + 'Of' + (isBlock ? 'Block' : 'Workflow'),
        value: (lane ? lane.id : 'none') + ';' + (otherId || '-1') + ';' + Math.round(lx) + ';' + Math.round(ly) + ';' + style
      };
    };

    nodes.forEach(function(n) {
      if (n.type !== 'start' && n.type !== 'end') return;
      var isStart = n.type === 'start';
      var x = n._xpdl && n._xpdl.marker ? n._xpdl : null;
      var still = x && !moved(n);
      var raw = x ? x.rawMarkers || [] : [];
      var mine = edges.filter(function(e) {
        return isStart ? e.source === n : e.target === n;
      });
      var covered = {};
      mine.forEach(function(e) {
        var other = isStart ? e.target : e.source;
        var otherId = idOf(other);
        if (!otherId) return;
        // unchanged: keep every original marker (any style) describing this connection
        var orig = still ? raw.filter(function(r) { return r.activity === otherId; }) : [];
        if (orig.length) {
          orig.forEach(function(r) {
            wanted.push({name: r.name, value: r.value});
          });
          covered[otherId] = true;
          return;
        }
        var styles = raw.length ? raw.map(function(r) { return /^JaWE_GRAPH_/.test(r.name); }) : [kvStyle];
        styles.filter(function(v, i, arr) { return arr.indexOf(v) === i; }).forEach(function(kv) {
          wanted.push(generate(n, other, e, kv));
        });
      });
      // markers that never pointed at an activity
      if (still) {
        raw.forEach(function(r) {
          if (!r.activity && !mine.length) wanted.push({name: r.name, value: r.value});
        });
      } else if (!mine.length) {
        wanted.push(generate(n, null, null, kvStyle));
      }
    });

    // reconcile: unchanged markers stay, changed ones are updated in place,
    // stale ones removed, new ones added
    var pending = wanted.slice();
    var stale = [];
    existing.forEach(function(e) {
      var i = -1;
      for (var k = 0; k < pending.length; k++) {
        if (pending[k].name === attr(e, 'Name') && pending[k].value === attr(e, 'Value')) {
          i = k;
          break;
        }
      }
      if (i >= 0) pending.splice(i, 1);
      else stale.push(e);
    });
    var target = function(v) {
      var m = /CONNECTING_ACTIVITY_ID=([^,]*)/.exec(v) || /^[^;]*;([^;]*)/.exec(v);
      return m ? m[1] : '';
    };
    stale.forEach(function(e) {
      for (var k = 0; k < pending.length; k++) {
        if (pending[k].name === attr(e, 'Name') && target(pending[k].value) === target(attr(e, 'Value'))) {
          e.setAttribute('Value', pending[k].value);
          pending.splice(k, 1);
          return;
        }
      }
      remove(e);
    });
    pending.forEach(function(w) {
      var ea = self.ensure(owner, 'ExtendedAttributes', ORDER[ln(owner)]);
      self.insert(ea, self.make('ExtendedAttribute', {Name: w.name, Value: w.value}));
    });
  };

  /* ------------------------------------------------------------------ */
  /* One container (process or activity set)                            */
  /* ------------------------------------------------------------------ */

  Writer.prototype.patchContainer = function(container, graph, layout, laneInfo, markerOwner, isBlock) {
    var self = this;
    var nodes = graph.nodes || [],
      edges = graph.edges || [];
    // XPDL 1.0 (and files that use them): start/end are markers, not activities
    var useMarkers = !this.v2 || nodes.some(function(n) {
      return n._xpdl && n._xpdl.marker;
    });
    var isMarkerNode = function(n) {
      return useMarkers && (n.type === 'start' || n.type === 'end');
    };
    var isMarkerEdge = function(e) {
      return isMarkerNode(e.source) || isMarkerNode(e.target);
    };

    var existing = {};
    kids(kid(container, 'Activities'), 'Activity').forEach(function(a) {
      existing[attr(a, 'Id')] = a;
    });
    var elOf = new Map(),
      idMap = new Map();
    var keep = {};
    nodes.forEach(function(n) {
      var x = n._xpdl;
      if (isMarkerNode(n) || !x || x.marker || !x.rawId || !existing[x.rawId] || keep[x.rawId]) return;
      keep[x.rawId] = true;
      elOf.set(n, existing[x.rawId]);
      idMap.set(n, x.rawId);
    });

    // removed activities (and the activity sets only they used)
    var removedSets = [];
    Object.keys(existing).forEach(function(id) {
      if (keep[id]) return;
      var b = kid(existing[id], 'BlockActivity');
      if (b) removedSets.push(attr(b, 'ActivitySetId') || attr(b, 'BlockId'));
      remove(existing[id]);
    });

    // updated / new activities
    nodes.forEach(function(n) {
      if (isMarkerNode(n)) return;
      var el = elOf.get(n);
      if (el) {
        self.updateActivity(el, n, layout, laneInfo);
      } else {
        el = self.createActivity(n, layout, laneInfo, container);
        elOf.set(n, el);
        idMap.set(n, attr(el, 'Id'));
      }
    });
    var idOf = function(n) {
      return idMap.get(n);
    };

    // transitions
    var trsEl = kid(container, 'Transitions');
    var existingT = {};
    kids(trsEl, 'Transition').forEach(function(t) {
      existingT[attr(t, 'Id')] = t;
    });
    var keepT = {},
      touched = new Set();
    edges.forEach(function(e) {
      if (isMarkerEdge(e)) return;
      var x = e._xpdl;
      if (x && !x.marker && x.rawId && existingT[x.rawId] && !keepT[x.rawId] &&
          x.from === e.source && x.to === e.target && idOf(e.source) && idOf(e.target)) {
        keepT[x.rawId] = e;
      }
    });
    Object.keys(existingT).forEach(function(id) {
      if (keepT[id]) return;
      var t = existingT[id];
      [attr(t, 'From'), attr(t, 'To')].forEach(function(aid) {
        touched.add(aid);
      });
      remove(t);
    });
    var trIdOf = new Map();
    edges.forEach(function(e) {
      if (isMarkerEdge(e)) return;
      var from = idOf(e.source),
        to = idOf(e.target);
      if (!from || !to) return;
      var x = e._xpdl;
      if (x && keepT[x.rawId] === e) {
        self.updateTransition(existingT[x.rawId], e);
        trIdOf.set(e, x.rawId);
      } else {
        var t = self.createTransition(e, from, to, container);
        trIdOf.set(e, attr(t, 'Id'));
        touched.add(from);
        touched.add(to);
      }
    });

    // split/join bookkeeping for activities whose transitions changed (or join type edited)
    nodes.forEach(function(n) {
      var el = elOf.get(n);
      if (!el || n.type !== 'activity') return;
      var id = idOf(n);
      var joinChanged = false;
      if (n._xpdl && n._xpdl.snap) {
        joinChanged = JSON.parse(n._xpdl.snap).convergeType !== ((n.frontCondition || {}).convergeType || '');
      }
      if (!touched.has(id) && !joinChanged && n._xpdl && n._xpdl.snap) return;
      var outIds = [],
        inCount = 0;
      edges.forEach(function(e) {
        if (!trIdOf.has(e)) return;
        if (e.source === n) outIds.push(trIdOf.get(e));
        if (e.target === n) inCount++;
      });
      self.syncRestrictions(el, outIds, inCount, joinChanged ? (n.frontCondition || {}).convergeType : null);
    });

    if (useMarkers && markerOwner) {
      this.syncMarkers(markerOwner, nodes, edges, idOf, layout, laneInfo, isBlock);
    }

    // block activities: their content lives in an ActivitySet of the process
    nodes.forEach(function(n) {
      if (n.component !== 'blockActivity' || !n.activitySet) return;
      var el = elOf.get(n);
      var b = kid(el, 'BlockActivity');
      var setId = b ? attr(b, 'ActivitySetId') || attr(b, 'BlockId') : n.activitySet.activitySetId;
      var proc = self.proc;
      var sets = self.ensure(proc, 'ActivitySets', ORDER.WorkflowProcess);
      var setEl = null;
      kids(sets, 'ActivitySet').forEach(function(s) {
        if (attr(s, 'Id') === setId) setEl = s;
      });
      if (!setEl) {
        setEl = self.insert(sets, self.make('ActivitySet', {Id: setId}));
        self.usedIds[setId] = true;
      }
      var sub = n.activitySet.graphCreator || {nodes: [], edges: []};
      var meta = n.activitySet.xpdl || {};
      self.patchContainer(setEl, sub, meta.layout || null, meta.laneInfo || null, el, true);
    });

    // activity sets no longer used by any block activity
    removedSets.forEach(function(setId) {
      if (!setId) return;
      var stillUsed = descendantsWithAttr(self.proc, 'BlockActivity', setId).length;
      if (stillUsed) return;
      kids(kid(self.proc, 'ActivitySets'), 'ActivitySet').forEach(function(s) {
        if (attr(s, 'Id') === setId) remove(s);
      });
    });
  };

  function descendantsWithAttr(root, name, setId) {
    return U.descendants(root, name).filter(function(b) {
      return attr(b, 'ActivitySetId') === setId || attr(b, 'BlockId') === setId;
    });
  }

  /* ------------------------------------------------------------------ */

  function save(graph) {
    var src = graph.xpdlSource;
    var doc = U.parseXml(src.text);
    var procs = U.descendants(doc.documentElement, 'WorkflowProcess');
    if (U.ln(doc.documentElement) === 'WorkflowProcess') procs.unshift(doc.documentElement);
    var proc = null;
    procs.forEach(function(p) {
      if (!proc && attr(p, 'Id') === src.processId) proc = p;
    });
    proc = proc || procs[src.processIndex || 0];
    if (!proc) throw new Error('The process was not found in the original file.');

    var w = new Writer(doc, proc, src.version);
    w.proc = proc;
    w.patchContainer(proc, graph, src.layout, src.laneInfo, proc, false);

    // everything before the root element (declaration, DOCTYPE, comments) is kept verbatim
    var rootStart = findRootStart(src.text);
    var prolog = rootStart > 0 ? src.text.slice(0, rootStart).replace(/^\uFEFF/, '') : '';
    prolog = prolog.replace(/(<\?xml[^>]*encoding\s*=\s*["'])[^"']*(["'])/, '$1UTF-8$2');
    if (!/^\s*<\?xml/.test(prolog)) prolog = '<?xml version="1.0" encoding="UTF-8"?>\n' + prolog;
    var tail = src.text.slice(findRootEnd(src.text));
    // the root start tag is never edited: copy it so attribute/namespace order stays as written
    var rootTag = /^<[^>]*>/.exec(src.text.slice(rootStart));
    var body = serialize(doc.documentElement, rootTag && !/\/>$/.test(rootTag[0]) ? rootTag[0] : null);
    // keep Windows line endings if the file used them (the parser turns them into \n)
    if (/\r\n/.test(src.text)) body = body.replace(/\r?\n/g, '\r\n');
    return prolog + body + tail;
  }

  // index of the root element's start tag in the original text
  function findRootStart(s) {
    var re = /<(!--[\s\S]*?--|\?[\s\S]*?\?|!DOCTYPE(?:[^\[>]|\[[\s\S]*?\])*|[A-Za-z_])/g,
      m;
    while ((m = re.exec(s))) {
      if (/^[A-Za-z_]$/.test(m[1])) return m.index;
    }
    return 0;
  }

  // text after the root element (trailing comments / newline)
  function findRootEnd(s) {
    var i = s.lastIndexOf('>');
    // skip trailing comments / PIs
    var trimmed = s.replace(/(\s*(<!--[\s\S]*?-->|<\?[\s\S]*?\?>))*\s*$/, '');
    return trimmed.length || i + 1;
  }

  function escText(v) {
    // a literal \r would be turned into \n when the file is read again
    return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#13;');
  }

  function escAttr(v) {
    return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/\r/g, '&#13;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;');
  }

  // write nodes exactly as they are named in the file (prefixes and namespace
  // declarations included); the browser's XMLSerializer may rename prefixes
  function serialize(node, startTag) {
    switch (node.nodeType) {
      case 1:
        var s = '<' + node.nodeName;
        for (var i = 0; i < node.attributes.length; i++) {
          var a = node.attributes[i];
          s += ' ' + a.name + '="' + escAttr(a.value) + '"';
        }
        if (startTag) s = startTag.slice(0, -1);
        if (!node.firstChild) return s + '/>';
        s += '>';
        for (var c = node.firstChild; c; c = c.nextSibling) s += serialize(c);
        return s + '</' + node.nodeName + '>';
      case 3:
        return escText(node.nodeValue);
      case 4:
        return '<![CDATA[' + node.nodeValue + ']]>';
      case 7:
        return '<?' + node.target + (node.data ? ' ' + node.data : '') + '?>';
      case 8:
        return '<!--' + node.nodeValue + '-->';
      default:
        return '';
    }
  }

  global.XpdlSave = {
    canSave: canSave,
    save: save
  };
})(window);
