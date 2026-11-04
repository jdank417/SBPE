/**
 * Toolbar - Import/Export
 */
function handleImportOrExport(e) {
  var isImport = e.target.className.indexOf('in'),
    textarea = $('.json_data textarea');
  $('.ui.modal.json_data').modal({
    onApprove: function() {
      if (isImport !== -1) { // Import
        var jsonStr = textarea.val();
        if (jsonStr) {
          var jsonObj = JSON.parse(jsonStr);
          jsonObj = edgeAssociateNode(jsonObj);
          graph_main.nodes = graph_main.nodes.concat(jsonObj.nodes);
          graph_main.edges = graph_main.edges.concat(jsonObj.edges);
          graph_main.updateGraph();
        }
      }
    },
    onHidden: function() {
      textarea.val('');
    }
  })
  .modal('setting', 'transition', 'scale')
  .modal('show');

  var element_header = $('div.json_data .header');
  if (isImport !== -1) {
    element_header.text('Import Data');
  } else {
    element_header.text('Export Data');
    var data = {
      nodes: graph_main.nodes,
      edges: graph_main.edges
    };
    textarea.val(JSON.stringify(data));
  }
}

/**
 * Toolbar - Clear
 */
function clearGraph() {
  layer.confirm('Clear everything?', {
    icon: 0,
    btn: ['OK','Cancel'],
    offset: '180px'
  }, function() {
    var pools = graphPool.pools;
    for (var i = 0; i < pools.length; i++) {
      var id = pools[i].containerId;
      switch (id) {
        case 'tab_main':
          pools[i].deleteGraph();
          break;
        default:
          $('.full-right [data-tab='+id+']').remove();
          pools.splice(i, 1);
          break;
      }
    }
    layer.msg('Deleted successfully', {icon: 1, offset: '180px', time: 600});
  }, function() {
    
  });
  
}

/**
 * Toolbar - Delete node
 */
function handleDeleteNode() {
  var graph_active = graphPool.getGraphByActiveEdit();
  var selectedNode = graph_active.state.selectedNode,
    selectedEdge = graph_active.state.selectedEdge;
  if (!selectedNode && !selectedEdge) {
    layer.msg('Please select an element!', {time: 2000, icon: 0, offset: '180px'});
    return;
  } else {
    layer.confirm('Delete the selected element?', {
      icon: 0,
      btn: ['OK','Cancel'],
      offset: '180px'
    }, function() {
      if (selectedNode) {
        var nodes = graph_active.nodes;
        nodes.splice(nodes.indexOf(selectedNode), 1);
        graph_active.spliceLinksForNode(selectedNode);
        if (selectedNode.component === 'blockActivity') {
          var containerId = 'tab_'+selectedNode.id;
          $('.full-right [data-tab='+containerId+']').remove();
          graphPool.removeGraphFromPools(containerId);
        }
        selectedNode = null;
        graph_active.updateGraph();
      } else if (selectedEdge) {
        var edges = graph_active.edges;
        edges.splice(edges.indexOf(selectedEdge), 1);
        selectedEdge = null;
        graph_active.updateGraph();
      }
      layer.msg('Deleted successfully', {icon: 1, offset: '180px', time: 600});
    }, function() {
      
    });
  }
}

/**
 * Toolbar - Zoom in/out buttons scale(0.3-2)
 */
function handleClickZoom() {
  var graph_active = graphPool.getGraphByActiveEdit();
  var translate = graph_active.dragSvg.translate(),
    scale = graph_active.dragSvg.scale(),
    extent = graph_active.dragSvg.scaleExtent(),
    direction = 1,
    factor = 0.1;
  direction = (this.id === 'zoom-enlarge') ? 1 : -1;
  if ((scale <= extent[0] && direction < 0) || (scale >= extent[1] && direction > 0)) {
    return;
  } else {
    scale = parseFloat(scale) + factor * direction;
  }
  graph_active.dragSvg.scale(scale)
      .translate(translate);
  graph_active.zoomed();
}

/**
 * Toolbar - Reset zoom and position
 */
function resetZoom() {
  var graph_active = graphPool.getGraphByActiveEdit();
  graph_active.svgG.transition() // start a transition
    .duration(1000) // make it last 1 second
    .attr('transform', 'translate(0,0) scale(1)');
  graph_active.dragSvg.scale(1);
  graph_active.dragSvg.translate([0,0]);
}

/**
 * Toolbar - Help
 */
function handleHelp() {
  if ($('.layer_notice').length) return;
  layer.open({
    type: 1,
    shade: false,
    title: false, // Do not show title
    offset: ['91px', '394px'],
    content: '<ul class="layer_notice">'+
             '  <li><a href="javascript:;">1. Drag an activity from the left panel into the editor</a></li>'+
             '  <li><a href="javascript:;">2. Select"Transition"or"Self Transition" to draw links between activities in the editor</a></li>'+
             '  <li><a href="javascript:;">3. Right-click activities and lines to edit their properties </a></li>'+
             '</ul>',
    cancel: function() {
      // console.log('helper closed!');
    }
  });
}

/**
 * Left-side components
 */
function handleComponentsBtn() {
  $(this).siblings().removeClass('active').end().addClass('active');
  var graph_active = graphPool.getGraphByActiveEdit(),
    state = graph_active.state,
    nodeName = $(this).attr('name'),
    container = $('.svg-container');
  if (nodeName === 'NOROUTING' || nodeName === 'SIMPLEROUTING') {
    state.drawLine = nodeName;
    container.on('mouseover mouseout', '.conceptG', function(e) {
      if (e.type === 'mouseover') {
        this.style.cursor = 'crosshair';
      } else if (e.type == 'mouseout') {
        this.style.cursor = 'default';
      }
    });
  } else {
    container.off('mouseover mouseout', '.conceptG');
    state.drawLine = null;
  }
}

/**
 * Auto-insert start and end nodes
 */
function handleAddStartEnd() {
  var graph_active = graphPool.getGraphByActiveEdit();
  var edges = graph_active.edges;
  var nodes = graph_active.filterActivities();
  nodes.forEach(function(node) {
    if (!graph_active.hasLinked(node, false, -1)) {
      var start = {
        id: generateUUID(),
        title: 'S',
        component: 'startComponent',
        type: 'start',
        x: node.x - nodeGeometry(node).w / 2 - 70,
        y: node.y
      };
      graph_active.nodes.push(start);
      var edge_start = {
        edgeId: generateUUID(),
        drawLine: 'NOROUTING',
        source: start,
        target: node
      };
      graph_active.edges.push(edge_start);
      graph_active.updateGraph();
    }
    if (!graph_active.hasLinked(node, false, 1)) {
      var end = { 
        id: generateUUID(),
        title: 'E',
        component: 'endComponent',
        type: 'end',
        x: node.x + nodeGeometry(node).w / 2 + 70,
        y: node.y
      };
      graph_active.nodes.push(end);
      var edge_end = {
        edgeId: generateUUID(),
        drawLine: 'NOROUTING',
        source: node,
        target: end
      };
      graph_active.edges.push(edge_end);
      graph_active.updateGraph();
    }
  });
}

/**
 * View tabs (Chart View, Xpdl View, Xml View)
 */
function handleViews() {
  var dataTab = $(this).attr('data-tab');
  var element = $('.full-right>.tab.active .content-div');
  var activitysetid = $('.full-right>.menu>.item.active').attr('activitysetid');
  switch (dataTab) {
    case 'second':
      var xpdlContent = graph_main.emergeAllxpdlContent();
      $('#xpdlContainer xmp').empty().text(xpdlContent);
      element.mCustomScrollbar("update");
      break;
    case 'third':
      var XmlContent = graph_main.emergeAllXmlContent();
      $('#xmlContainer xmp').empty().text(XmlContent);
      break;
  }
  var isSubGraphXpdlView = dataTab !== 'second' && /_second$/.test(dataTab);
  if (isSubGraphXpdlView) {
    var blockActivity = graph_main.findActByActSetId(activitysetid);
    var subGraph = blockActivity.activitySet.graphCreator;
    var activitySet = graph_main.emergeActivitySet.call(subGraph, activitysetid);
    activitySet = vkbeautify.xml('<ActivitySet>' + activitySet + '</ActivitySet>');
    element.find('xmp').empty().text(activitySet);
    element.mCustomScrollbar("update");
  }
}

/**
 * Toolbar - Save: writes the whole package as an .xpdl file
 * (Chrome/Edge: "Save as" dialog, then later saves go to the chosen file;
 *  other browsers: download)
 */
function buildPackageXpdl() {
  var xpdl = graph_main.emergeAllxpdlContent();
  var xpdl_top = /*This block should be obtainable from WfDSystemConfig.xml, but the Applet and the xml differ*/
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' +
    '   <Package xmlns="http://www.wfmc.org/2002/XPDL1.0" xmlns:xpdl="http://www.wfmc.org/2002/XPDL1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Id="' + package_id + '" Name="' + xmlEsc(package_name) + '" xsi:schemaLocation="http://www.wfmc.org/2002/XPDL1.0 http://wfmc.org/standards/dtd/TC-1025_schema_10_xpdl.xsd">' +
    '       <PackageHeader>' +
    '           <XPDLVersion>1.0</XPDLVersion>' +
    '           <Vendor>GENTLESOFT</Vendor>' +
    '           <Created>' + xmlEsc(create_time) + '</Created>' +
    '       </PackageHeader>' +
    '       <RedefinableHeader PublicationStatus="UNDER_TEST">' +
    '           <Author>Administrator</Author>' +
    '           <Version>1.0</Version>' +
    '       </RedefinableHeader>' +
    '       <ConformanceClass GraphConformance="NON_BLOCKED"/>' +
    '       <Script Type="text/javascript"/>' +
    '       <DataFields>' +
    '           <DataField Id="sourceReferenceId" IsArray="FALSE" Name="sourceReferenceId">' +
    '               <DataType>' +
    '                   <BasicType Type="STRING"/>' +
    '               </DataType>' +
    '               <InitialValue>null</InitialValue>' +
    '           </DataField>' +
    '           <DataField Id="formId" IsArray="FALSE" Name="formId">' +
    '               <DataType>' +
    '                   <BasicType Type="STRING"/>' +
    '               </DataType>' +
    '               <InitialValue>null</InitialValue>' +
    '           </DataField>' +
    '           <DataField Id="nextActivityInfo" IsArray="FALSE" Name="nextActivityInfo">' +
    '               <DataType>' +
    '                   <ExternalReference location="org.gentlesoft.wf.NextActivitiesParty"/>' +
    '               </DataType>' +
    '               <InitialValue>null</InitialValue>' +
    '           </DataField>' +
    '           <DataField Id="nextActivityName" IsArray="FALSE" Name="nextActivityName">' +
    '               <DataType>' +
    '                   <ExternalReference location="java.util.ArrayList"/>' +
    '               </DataType>' +
    '               <InitialValue>null</InitialValue>' +
    '           </DataField>' +
    '           <DataField Id="formType" IsArray="FALSE" Name="formType">' +
    '               <DataType>' +
    '                   <BasicType Type="STRING"/>' +
    '               </DataType>' +
    '               <InitialValue>null</InitialValue>' +
    '           </DataField>' +
    '       </DataFields>';
  var xpdl_end = 
    '       <ExtendedAttributes>'+
    '           <ExtendedAttribute Name="MadeBy" Value="com.gentlesoft.tools.wfd"/>' +
    '           <ExtendedAttribute Name="Version" Value="1.4.2"/>' +
    '       </ExtendedAttributes>' +
    '   </Package>';
  return vkbeautify.xml('<?xml version="1.0" encoding="UTF-8" standalone="no"?>' +
    (xpdl_top + xpdl + xpdl_end).replace(/^<\?xml[^>]*\?>/, ''));
}

var xpdlSaveHandle = null; // file chosen in this session's "Save as" dialog
var xpdlFileName = null;   // name of the file that was opened, used as the suggested name

function suggestedXpdlName() {
  var base = xpdlFileName ? xpdlFileName.replace(/\.[^.]*$/, '') : (workflow_name || 'process');
  return base.replace(/[\\\/:*?"<>|]+/g, '_').trim() + '.xpdl';
}

function handleSave() {
  var content;
  try {
    content = buildPackageXpdl();
  } catch (e) {
    layer.alert('The diagram could not be converted to XPDL: ' + htmlEsc(e.message), {icon: 2, title: 'Save'});
    return;
  }
  var done = function(name) {
    layer.msg('Saved ' + htmlEsc(name), {icon: 1, offset: '180px', time: 1500});
  };
  var fail = function(e) {
    if (e && e.name === 'AbortError') return; // dialog cancelled
    layer.alert('Saving failed: ' + htmlEsc(e && e.message || e), {icon: 2, title: 'Save'});
  };

  if (window.showSaveFilePicker) {
    var getHandle = xpdlSaveHandle ? Promise.resolve(xpdlSaveHandle) : window.showSaveFilePicker({
      suggestedName: suggestedXpdlName(),
      types: [{description: 'XPDL process', accept: {'application/xml': ['.xpdl', '.xml']}}]
    });
    getHandle.then(function(handle) {
      xpdlSaveHandle = handle;
      return handle.createWritable().then(function(writable) {
        return writable.write(content).then(function() {
          return writable.close();
        });
      }).then(function() {
        done(handle.name);
      });
    }).catch(fail);
    return;
  }

  // fallback: download
  try {
    var blob = new Blob([content], {type: 'application/xml;charset=utf-8'});
    var name = suggestedXpdlName();
    if (window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(blob, name);
    } else {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    }
    done(name);
  } catch (e) {
    fail(e);
  }
}

/**
 * Right-click menu edit
 */
function handleMenuEdit() {
  var graph_active = graphPool.getGraphByActiveEdit();
  var selectedNode = graph_active.state.selectedNode;
  var data = {
      id: selectedNode.id,
      activitySetId: selectedNode.activitySet.activitySetId
    };
  var full_right = $('.full-right'),
    menu = full_right.children('.menu'),
    tab = full_right.find('.tab.active'),
    curr_tab = menu.find('[data-tab="tab_'+ data.id + '"]');
  if (curr_tab.length) {
    full_right.find('[data-tab=tab_' + data.id + ']').show();
    curr_tab.trigger('click');
  } else { // create tab and graph object
    menu.append(juicer($('#blockActiEdi_item_tpl').html(), data));
    full_right.append(juicer($('#blockActiEdi_tab_tpl').html(), data));
    menu.find('.item').tab();
    menu.find('[data-tab="tab_' + data.id + '"]').trigger('click');
    tab.find('.full-right-btn .item').tab();
    tab.find('.content-div').mCustomScrollbar();
    graph_active.createSubGraph();
  }
}

function handleNodeMenuProp() {
  var graph_active = graphPool.getGraphByActiveEdit();
  var selectedNode = graph_active.state.selectedNode;
  $('.ui.modal.prop_node').modal({
    autofocus: false,
    closable: false,
    onApprove: function() {
      //Update - Extended Attributes
      selectedNode.extendAttr = [];
      $('.extended_attr tbody tr').each(function() {
        var jsonstr = $(this).attr('jsonstr');
        selectedNode.extendAttr.push(jsonstr);
      });
      //Update - Advanced properties
      selectedNode.highLevel = {};
      var highLevel = {};
      $('.prop_node .highLevel').find('input').each(function() {
        highLevel[$(this).attr('name')] = $(this).val();
      });
      selectedNode.highLevel = highLevel;
      //Update - Timeout Limits
      $('.timeout_limit').find('input[name], select[name]').each(function() {
        selectedNode.timeoutLimit[$(this).attr('name')] = $(this).val();
      });
      selectedNode.timeoutLimit.deadline = [];
      $('.timeout_limit tbody tr').each(function() {
        var jsonstr = $(this).attr('jsonstr');
        selectedNode.timeoutLimit.deadline.push(jsonstr);
      });
      //Update - Post-conditions
      graph_active.updatePostCondi('.post_condition');
      //Update - Pre-conditions
      selectedNode.frontCondition = {};
      $('.front_condition > div:not(".hideDiv")').find('input:not(:radio)[name], select').each(function() {
        selectedNode.frontCondition[$(this).attr('name')] = $(this).val();
      });
      //Update - Tools
      
      //Update - General
      selectedNode.conventional = {};
      var conventional = {};
      $('.prop_node .conventional').find('input[name], textarea, select').each(function() {
        conventional[$(this).attr('name')] = $(this).val();
      });
      if (conventional.ID != selectedNode.id) {
        selectedNode.id = conventional.ID;
      }
      if (conventional.name != selectedNode.title) {
        selectedNode.title = conventional.name;
      }
      var $role = $('.conventional select[name="definition_role"]').parent();
      conventional.performer = $role.children('.text').attr('definition_id') || '';
      var role_txt = $role.dropdown('get text'); //Semantic has a bug: re-initialized dropdown cannot get value
      if (role_txt !='Please select' && role_txt !='(Empty)') {
        conventional.participantID = $role.dropdown('get text');
      }
      selectedNode.conventional = conventional;
      graph_active.updateGraph();
    },
    onShow: function() {
      var node = selectedNode;
      //Show - Monitoring Info
      $('.monitorinf select[name="isResponsibleTem"]').dropdown('set selected', node.monitorinf.isResponsibleTem);
      var responsible = node.monitorinf.responsible;
      if (responsible && responsible.length) {
        var tr = '';
        responsible.forEach(function(resp) {
          graph_active.participants.forEach(function(participant) {
            if (resp == participant.conventional_definition_id) {
              tr += participant.conventional_definition_name?'<tr definition_id="'+resp+'"><td>'+(participant.conventional_definition_name+'-rol')+'</td></tr>':
                '<tr  definition_id="'+resp+'"><td>'+(resp+'-rol')+'</td></tr>';
            }
          });
        });
        $('.monitorinf tbody').append(tr);
      }
      //Show - Advanced
      $('.highLevel').find('input').each(function() {
        for (var i in node.highLevel) {
          if ($(this).attr('name') == i) {
            $(this).val(node.highLevel[i]);
          }
        }
      });
      //Show - Timeout Limits
      $('.timeout_limit').find('input').each(function() {
        for (var i in node.timeoutLimit) {
          if ($(this).attr('name') == i) {
            $(this).val(node.timeoutLimit[i]);
          }
        }
      });
      $('.timeout_limit').find('select').each(function() {
        for (var i in node.timeoutLimit) {
          if ($(this).attr('name') == i) {
            $(this).dropdown('set selected', node.timeoutLimit[i]);
          }
        }
      });
      var deadline_strs = node.timeoutLimit.deadline;
      if (deadline_strs && deadline_strs.length) {
        var d_tr = '';
        deadline_strs.forEach(function(deadline_str){
          var deadline_obj = JSON.parse(deadline_str);
          d_tr += '<tr jsonstr= '+deadline_str+'><td>'+deadline_obj.deadlineCondition+'</td></tr>';
        });
        $('.timeout_limit tbody').append(d_tr);
      }
      //Show - Extended Attribute Set
      var extendAttr_strs = node.extendAttr;
      if (extendAttr_strs && extendAttr_strs.length) {
        var e_tr = '';
        extendAttr_strs.forEach(function(extendAttr_str) {
          var extendAttr_obj = JSON.parse(extendAttr_str);
          var data = {
            data: extendAttr_obj, 
            jsonstr: extendAttr_str
          };
          e_tr += juicer($('#extended_attr_tpl').html(), data);
        });
        $('.extended_attr tbody').append(e_tr).find('.ui.checkbox').checkbox();
      }
      //Show - Post-conditions
      $('.post_condition .targetActivity').html($('#transition_tpl').html());
      $('.post_condition .targetActivity .menu .item').tab();
      $(".targetActivity .transferInf_extended_attr .postCondi_extendedAttr").mCustomScrollbar();
      $('.targetActivity .conditionList,.conditionList2').mCustomScrollbar();
      var postCondition = {targetActivities: []};
      var edges_act = graph_active.edgesLinkAcivity();
      edges_act.forEach(function(edge) {
        if (edge.source == node) {
          postCondition.targetActivities.push({'activity': edge.target, 'transition': edge});
        }
      });
      if (postCondition.targetActivities.length > 0) {
        $('.post_condition .targetActivity').removeClass('invisible');
        $('.post_condition select[name="splitType"]').parent().removeClass('disabled');
        if (postCondition.targetActivities.length > 1) {
          var splitType = graph_active.state.selectedNode.postCondition.splitType || 'XOR';
          $('.post_condition select[name="splitType"]').parent().dropdown('set selected', splitType);
        } else {
          $('.post_condition select[name="splitType"]').parent().addClass('disabled');
        }
        postCondition.targetActivities.forEach(function(targetActivity) {// show target activities
          $('.post_condition .list').append('<div class="item" acivityId="'+htmlEsc(targetActivity.activity.id)+'" jsonstr="'+htmlEsc(JSON.stringify(targetActivity.transition))+'">'+
                                            '    <div class="content">'+
                                            '        <div class="">'+htmlEsc(targetActivity.activity.title)+'</div>'+
                                            '    </div>'+
                                            '</div>');
        });
        $('.post_condition .list').on('click', '.item', function() {// click target activity
          $(this).addClass('active').siblings().removeClass('active');
          var transition = JSON.parse($(this).attr('jsonstr'));
          graph_active.showTransition('.post_condition', transition);
        });
        $('.post_condition .list .item').eq(0).trigger('click');
      } else {
        $('.post_condition .targetActivity').addClass('invisible');
        $('.post_condition select[name="splitType"]').parent().addClass('disabled');
      }
      //Show - Pre-conditions
      var frontCondition = node.frontCondition;
      if (frontCondition.convergeType) {
        $('.front_condition .dropdown.convergeType').dropdown('set selected', frontCondition.convergeType);
        $('.front_condition select[name=syncType]').dropdown('set selected', frontCondition.syncType || "");
        $('.front_condition input[name=voteText]').val(frontCondition.voteText || "");
        if (frontCondition.isCreateNew == "true") {
          $('.front_condition input[tabindex="true"]').parent().checkbox('check');
        } else if (frontCondition.isCreateNew == "false") {
          $('.front_condition input[tabindex="false"]').parent().checkbox('check');
        }
      }
      //Show - Tools
      
      //Show - General
      var conventional = node.conventional;
      $('.conventional').find('input[name], textarea').each(function() {
        for (var key in conventional) {
          if (key == $(this).attr('name')) {
            $(this).val(conventional[key]);
          }
        }
      });
      $('.conventional').find('select').not($('input[name="definition_role"]')).each(function() {
        for (var key in conventional) {
          if (key == $(this).attr('name')) {
            $(this).dropdown('set selected', conventional[key]);
          }
        }
      });
      $('.conventional').find('.checkbox').each(function() {
        var value = $(this).find('input[name]').val();
        if (value && value !="false") $(this).checkbox('check');
      });
      $('.conventional input[name=ID]').val(node.id);
      $('.conventional input[name=name]').val(node.title);
      if (conventional.performer) {
        $('.conventional select[name="definition_role"]').dropdown('set text', conventional.participantID || '');
        $('.conventional .dropdown .text').attr('definition_id', conventional.performer);
      }
      //Monitoring Info - Temporary Monitor?
      $('.monitorinf select[name="isResponsibleTem"]').on('change', function() {
        var node = graph_active.state.selectedNode;
        node.monitorinf.isResponsibleTem = $(this).val();
      });
      //General - Participant Set
      $('.conventional .definition_field').on('click', function() {
        var participants = graph_active.participants;
        var options ='<option value="">Please select</option><option value="0">(Empty)</option>';
        participants.forEach(function(participant) {
          var rol = participant.conventional_definition_name ? participant.conventional_definition_name + "-rol" : participant.conventional_definition_id + "-rol";
          options += '<option value="' + htmlEsc(participant.conventional_definition_id) + '">' + htmlEsc(rol) + '</option>';
        });
        $('.conventional select[name="definition_role"]').empty().append(options);
      });
      //General - Participant Set - Dropdown
      $('.conventional .definition_field').on('click', '.item', function() {
        var definition_id = $(this).attr('data-value') != "0" ? $(this).attr('data-value') : '';
        $('.conventional select[name="definition_role"]').siblings('.text').attr('definition_id', definition_id);
      });
    },
    onHidden: function() {
      $('.prop_node .menu .item[data-tab="one"]').trigger('click');
      $('.monitorinf select[name="isResponsibleTem"]').off('change'); // popup closed; avoid firing events when clearing the form
      $(this).find('input, textarea').val('');
      $(this).find('.ui.dropdown').dropdown('clear');
      $(this).find('.ui.checkbox').checkbox('uncheck');
      $('.monitorinf tbody').empty(); // clear monitoring info 
      $('.timeout_limit tbody').empty(); // clear monitoring info
      $('.extended_attr tbody').empty(); // clear extended attribute set
      $('.post_condition .list').empty(); // clear post-conditions
      $('.post_condition .targetActivity').html('');
      $('.conventional select[name="definition_role"]').siblings('.text').removeAttr('definition_id');
    }
  }).modal('show');
  $('.prop_node>.menu a[data-tab*="two"]').addClass('hideitem');
  if (selectedNode.title == 'Normal Activity') {
    $('.prop_node>.menu a[data-tab="two_1"]').removeClass('hideitem');
  }
  if (selectedNode.title == 'Block Activity') {
    $('.prop_node>.menu a[data-tab="two_2"]').removeClass('hideitem');
  }
  if (selectedNode.title == 'Sub-Activity') {
    $('.prop_node>.menu a[data-tab="two_3"]').removeClass('hideitem');
  }
}

function handleEdgeMenuProp() {
  var graph_active = graphPool.getGraphByActiveEdit();
  var selectedEdge = graph_active.state.selectedEdge;
  $('.prop_edge .targetActivity').html($('#transition_tpl').html());
  $('.prop_edge .targetActivity .menu .item').tab();
  $(".targetActivity .transferInf_extended_attr .postCondi_extendedAttr").mCustomScrollbar();
  $('.targetActivity .conditionList,.conditionList2').mCustomScrollbar();
  $('.ui.modal.prop_edge').modal({
    autofocus: false,
    closable: false,
    onApprove: function() {
      //Update - Transition properties
      graph_active.updatePostCondi('.prop_edge');
    },
    onShow: function() {
      var edge = graph_active.state.selectedEdge;
      //Show - Post-conditions
      graph_active.showTransition('.prop_edge', edge);
    },
    onHidden: function() {
      $('.prop_edge .targetActivity').html('');
    }
  }).modal('show');
}

function handleRightMenu() {
  var graph_active = graphPool.getGraphByActiveEdit();
  var item = $(this).attr('name');
  var selectedNode = graph_active.state.selectedNode,
  selectedEdge = graph_active.state.selectedEdge;
  switch (item) {
    case 'removeMenu':
      handleDeleteNode();
      break;
    case 'toFront':
      alert('Pre');
      break;
    case 'editMenu':
      handleMenuEdit();
      break;
    case 'propMenu':
      if (selectedNode) {
        handleNodeMenuProp();
      } else if (selectedEdge) {
        handleEdgeMenuProp();
      }
      break;
  }
  $('#rMenu').hide();
}

/**
 * edge link to the connected node objects
 * @param  {Object} jsonObj data object
 * @return {Object}         data object after linking nodes
 */
function edgeAssociateNode(jsonObj) {
  jsonObj.edges.map(function(edge) { // re-link node object by edge.source.id
    var source = jsonObj.nodes.find(function(node) {
      return node.id === edge.source.id;
    });
    var target = jsonObj.nodes.find(function(node) {
      return node.id === edge.target.id;
    });
    edge.source = source;
    edge.target = target;
    return edge;
  });
  return jsonObj;
}



/**
 * Toolbar - Open XPDL
 */
function handleOpenXpdl() {
  var input = document.getElementById('xpdl-file-input');
  input.value = '';
  input.click();
}

function openXpdlFile(file) {
  if (!file) return;
  readTextFile(file, function(err, text) {
    if (err) {
      layer.alert('Could not read the file: ' + htmlEsc(err.message), {icon: 2, title: 'Open XPDL'});
      return;
    }
    var pkg;
    try {
      pkg = XpdlImport.read(text);
    } catch (e) {
      layer.alert('<b>' + htmlEsc(file.name) + '</b> could not be opened.<br><br>' + htmlEsc(e.message), {icon: 2, title: 'Open XPDL'});
      return;
    }
    chooseXpdlProcess(pkg, file.name, function(index) {
      confirmReplaceDiagram(function() {
        xpdlFileName = file.name;
        xpdlSaveHandle = null;
        loadXpdlProcess(pkg, index);
      });
    });
  });
}

function readTextFile(file, callback) {
  var reader = new FileReader();
  var useDecoder = typeof TextDecoder !== 'undefined';
  reader.onload = function() {
    try {
      callback(null, useDecoder ? XpdlImport.decode(reader.result) : reader.result);
    } catch (e) {
      callback(e);
    }
  };
  reader.onerror = function() {
    callback(reader.error || new Error('read error'));
  };
  if (useDecoder) {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file);
  }
}

function chooseXpdlProcess(pkg, fileName, done) {
  var procs = pkg.processes;
  if (procs.length === 1) {
    done(0);
    return;
  }
  var best = 0;
  procs.forEach(function(p, i) {
    if (p.activityCount > procs[best].activityCount) best = i;
  });
  var html = '<div class="xpdl-chooser"><p><b>' + htmlEsc(fileName) + '</b> contains ' + procs.length +
    ' processes. Choose the one to open:</p>';
  procs.forEach(function(p, i) {
    var label = p.name + (p.poolName && p.poolName !== p.name ? ' (' + p.poolName + ')' : '');
    html += '<label class="xpdl-choice">' +
      '<input type="radio" name="xpdl-process" value="' + i + '"' + (i === best ? ' checked' : '') + '>' +
      '<span class="xpdl-choice-name">' + htmlEsc(label) + '</span>' +
      '<span class="xpdl-choice-count">' + p.activityCount + (p.activityCount === 1 ? ' activity' : ' activities') + '</span>' +
      '</label>';
  });
  html += '</div>';
  layer.open({
    type: 1,
    title: 'Open XPDL',
    area: '480px',
    offset: '120px',
    content: html,
    btn: ['Open', 'Cancel'],
    yes: function(index, layero) {
      var value = layero.find('input[name="xpdl-process"]:checked').val();
      layer.close(index);
      done(parseInt(value, 10) || 0);
    }
  });
}

function confirmReplaceDiagram(proceed) {
  var hasContent = graphPool.pools.some(function(graph) {
    return graph.nodes && graph.nodes.length;
  });
  if (!hasContent) {
    proceed();
    return;
  }
  layer.confirm('Opening this file replaces the current diagram. Continue?', {
    icon: 0,
    title: 'Open XPDL',
    btn: ['Open', 'Cancel'],
    offset: '180px'
  }, function(index) {
    layer.close(index);
    proceed();
  });
}

function loadXpdlProcess(pkg, index) {
  var result;
  try {
    result = XpdlImport.build(pkg, index);
  } catch (e) {
    layer.alert('The process could not be imported.<br><br>' + htmlEsc(e.message), {icon: 2, title: 'Open XPDL'});
    return;
  }

  // close block-activity tabs and drop their graphs
  $('.full-right>.menu>.item').not('[data-tab="tab_main"]').remove();
  $('.full-right>.tab').not('[data-tab="tab_main"]').remove();
  graphPool.pools = graphPool.pools.filter(function(graph) {
    return graph.containerId === 'tab_main';
  });
  $('.full-right>.menu>.item[data-tab="tab_main"]').trigger('click');
  graphPool.updateGraphActiveById('tab_main');
  $('[data-tab="tab_main"] .full-right-btn .item[data-tab="first"]').trigger('click');

  graph_main.nodes = result.nodes;
  graph_main.edges = result.edges;
  graph_main.participants = result.participants;
  graph_main.state.selectedNode = null;
  graph_main.state.selectedEdge = null;
  graph_main.updateGraph();

  applyXpdlGlobals(result);
  fitGraphToView(graph_main);

  var s = result.stats;
  var summary = 'Opened "' + htmlEsc(result.processName) + '": ' + s.activities + ' activities, ' +
    s.transitions + ' transitions' + (s.blocks ? ', ' + s.blocks + ' block activities' : '') + '.';
  if (result.warnings.length) {
    layer.alert(summary + '<ul class="xpdl-warnings"><li>' + result.warnings.map(htmlEsc).join('</li><li>') + '</li></ul>', {
      icon: 0,
      title: 'Open XPDL',
      area: '480px'
    });
  } else {
    layer.msg(summary, {icon: 1, offset: '180px', time: 2500});
  }
}

// make the imported process the current one (ids, names, id sequences)
function applyXpdlGlobals(result) {
  var safe = function(s) {
    return String(s || '').replace(/[^A-Za-z0-9_-]/g, '_');
  };
  if (result.processId) workflow_id = safe(result.processId);
  if (result.processName) workflow_name = result.processName;
  if (result.packageId) package_id = safe(result.packageId);
  if (result.packageName) package_name = result.packageName;

  seqer_nodeID.set_prefix(workflow_id + '_Act');
  seqer_edgeID.set_prefix(workflow_id + '_Tra');
  seqer_participantID.set_prefix(workflow_id + '_Par');
  seqer_blockId.set_prefix(workflow_id + '_Ase');

  // continue numbering after the highest id already in the file
  var max = {Act: 0, Tra: 0, Ase: 0, Par: 0};
  var note = function(id) {
    var m = /_(Act|Tra|Ase|Par)([0-9]+)$/.exec(String(id || ''));
    if (m) max[m[1]] = Math.max(max[m[1]], parseInt(m[2], 10));
  };
  (function walk(graph, depth) {
    if (!graph || depth > 50) return;
    (graph.nodes || []).forEach(function(node) {
      note(node.id);
      if (node.activitySet) {
        note(node.activitySet.activitySetId);
        walk(node.activitySet.graphCreator, depth + 1);
      }
    });
    (graph.edges || []).forEach(function(edge) {
      note(edge.edgeId);
    });
  })(result, 0);
  (result.participants || []).forEach(function(p) {
    note(p.conventional_definition_id);
  });
  seqer_nodeID.set_seq(max.Act + 1);
  seqer_edgeID.set_seq(max.Tra + 1);
  seqer_blockId.set_seq(max.Ase + 1);
  seqer_participantID.set_seq(max.Par + 1);

  // labels
  if (typeof $ !== 'undefined' && $('.full-right').length) {
    $('.full-right>.menu>.item[data-tab="tab_main"]').html('<i class="remove red icon"></i>' + htmlEsc(workflow_name));
    $('[data-tab="tab_main"] .component-name span').text(workflow_name);
    $('[data-tab="tab_main"] .component-prop').html(
      '<div>' +
      '  <div name="id" class="prop-value"><span>id:</span><span>' + htmlEsc(workflow_id) + '</span></div>' +
      '  <div name="name" class="prop-value"><span>Name:</span><span>' + htmlEsc(workflow_name) + '</span></div>' +
      '</div>' +
      '<div class="clearfix"></div>');
  }
}

// zoom out (never in) so the whole diagram is visible
function fitGraphToView(graph) {
  var svgEl = graph.svg.node();
  var rect = svgEl.getBoundingClientRect();
  var width = rect.width || svgEl.clientWidth || 1000,
    height = rect.height || svgEl.clientHeight || 500;
  var maxX = 0,
    maxY = 0;
  graph.nodes.forEach(function(n) {
    var geo = nodeGeometry(n);
    maxX = Math.max(maxX, n.x + geo.w / 2 + 30);
    maxY = Math.max(maxY, n.y + geo.h / 2 + 30);
  });
  var extent = graph.dragSvg.scaleExtent();
  var scale = Math.min(1, maxX ? width / maxX : 1, maxY ? height / maxY : 1);
  scale = Math.max(scale, extent[0]);
  graph.dragSvg.scale(scale).translate([0, 0]);
  graph.svgG.attr('transform', 'translate(0,0) scale(' + scale + ')');
}
