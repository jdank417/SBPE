/* JS unrelated to node/edge js */
var package_id = '${param.processid}';
package_id = package_id.indexOf('Package_') !== -1 ? package_id : 'Package_'+randomWord(false, 8);
var workflow_name = 'Process';
var package_name = 'New Package';
var workflow_id = package_id+'_Wor1';
var create_time = new Date().pattern('yyyy-MM-dd HH:mm:ss');// should be read from xpdl
var create_type = '${param.kind}';
create_type = create_type.indexOf('param.kind') !== -1 ? create_type : 'create';// html prevent errors

// Define node id sequence generator
var seqer_nodeID = serial_marker();
seqer_nodeID.set_prefix(workflow_id + '_Act');

// Define edge id sequence generator
var seqer_edgeID = serial_marker();
seqer_edgeID.set_prefix(workflow_id + '_Tra');

// Define participant id sequence generator
var seqer_participantID = serial_marker();
seqer_participantID.set_prefix(workflow_id + '_Par');

// Define block activity blockId sequence generator
var seqer_blockId = serial_marker();
seqer_blockId.set_prefix(workflow_id + '_Ase');

$('.full-right>.menu').on('click', '.item', function() {
	var activitysetid = $(this).attr('activitysetid'); // edit block activity id
	if (activitysetid) {
		seqer_nodeID.set_prefix(activitysetid + '_Act');
	} else {
		seqer_nodeID.set_prefix(workflow_id + '_Act');
	}

	var containerId = $(this).attr('data-tab'); // graph.containerId
	graphPool.updateGraphActiveById(containerId);
});

$(function() {
	// Data table: click to select row
	$('.toolgrid,.extended_attr,.post_condition,.prop_edge,.role_manage').on('click', 'tbody tr', function() {
		$(this).addClass('active').siblings().removeClass('active');
		$(this).find('input:radio').prop('checked','checked');
	});	
	
	$('.monitorinf,.conventional_definition,.timeout_limit,.monitorinfAddDefinition tbody').on('click', 'tr', function() {
		$(this).addClass('active').siblings().removeClass('active');
	});	
	
	$('.front_condition .dropdown.convergeType').on('change', function(e) {
		var convergeType = $(this).val();
		if (convergeType == 0) { // Empty
			$('.otherOpt>div').addClass('hideDiv');
		}
		if (convergeType == 'AND') { // And
			$('.otherOpt>div').eq(0).removeClass('hideDiv');
			$('.otherOpt>div').eq(1).addClass('hideDiv');
		}
		if (convergeType == 'XOR') { // Xor
			$('.otherOpt>div').eq(0).addClass('hideDiv');
			$('.otherOpt>div').eq(1).removeClass('hideDiv');
		}
	});
/*
	// Edit tools (Save)
	$('.editor-toolbar .icon.save').on('click', function() {
		var dataTab = $('.full-right-btn .item.active').attr('data-tab');
		$('.tab[data-tab="tab_main"] .item').not($('.full-right-btn .item.active')).trigger('click');//trigger click to get xpdl and xml
		$('.full-right-btn .item[data-tab="'+dataTab+'"]').trigger('click');
		var xpdl = $('#xpdlContainer xmp').text();
		var xml = $('#xmlContainer xmp').text();
		var xpdl_top =
			'<?xml version="1.0" encoding="UTF-8" standalone="no"?>'+
		    '<Package xmlns="http://www.wfmc.org/2002/XPDL1.0" xmlns:xpdl="http://www.wfmc.org/2002/XPDL1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Id="'+package_id+'" Name="'+xmlEsc(package_name)+'" xsi:schemaLocation="http://www.wfmc.org/2002/XPDL1.0 http://wfmc.org/standards/dtd/TC-1025_schema_10_xpdl.xsd">'+
		    '    <PackageHeader>'+
		    '        <XPDLVersion>1.0</XPDLVersion>'+
		    '        <Vendor>GENTLESOFT</Vendor>'+
		    '        <Created>'+create_time+'</Created>'+
		    '    </PackageHeader>'+
		    '    <RedefinableHeader PublicationStatus="UNDER_TEST">'+
		    '        <Author>Administrator</Author>'+
		    '        <Version>1.0</Version>'+
		    '    </RedefinableHeader>'+
		    '    <ConformanceClass GraphConformance="NON_BLOCKED"/>'+
		    '    <Script Type="text/javascript"/>'+
		    '    <DataFields>'+
		    '        <DataField Id="sourceReferenceId" IsArray="FALSE" Name="sourceReferenceId">'+
		    '            <DataType>'+
		    '                <BasicType Type="STRING"/>'+
		    '            </DataType>'+
		    '            <InitialValue>null</InitialValue>'+
		    '        </DataField>'+
		    '        <DataField Id="formId" IsArray="FALSE" Name="formId">'+
		    '            <DataType>'+
		    '                <BasicType Type="STRING"/>'+
		    '            </DataType>'+
		    '            <InitialValue>null</InitialValue>'+
		    '        </DataField>'+
		    '        <DataField Id="nextActivityInfo" IsArray="FALSE" Name="nextActivityInfo">'+
		    '            <DataType>'+
		    '                <ExternalReference location="org.gentlesoft.wf.NextActivitiesParty"/>'+
		    '            </DataType>'+
		    '            <InitialValue>null</InitialValue>'+
		    '        </DataField>'+
		    '        <DataField Id="nextActivityName" IsArray="FALSE" Name="nextActivityName">'+
		    '            <DataType>'+
		    '                <ExternalReference location="java.util.ArrayList"/>'+
		    '            </DataType>'+
		    '            <InitialValue>null</InitialValue>'+
		    '        </DataField>'+
		    '        <DataField Id="formType" IsArray="FALSE" Name="formType">'+
		    '            <DataType>'+
		    '                <BasicType Type="STRING"/>'+
		    '            </DataType>'+
		    '            <InitialValue>null</InitialValue>'+
		    '        </DataField>'+
		    '    </DataFields>';
		var xpdl_end = 
			'    <ExtendedAttributes>'+
		    '        <ExtendedAttribute Name="MadeBy" Value="com.gentlesoft.tools.wfd"/>'+
		    '        <ExtendedAttribute Name="Version" Value="1.4.2"/>'+
		    '    </ExtendedAttributes>'+
		    '</Package>';
		var xml_top = '<?xml version="1.0" encoding="UTF-8"?><pkg-config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Id="'+package_id+'" Name="'+xmlEsc(package_name)+'" Version="" xsi:noNamespaceSchemaLocation="../dtd/flowactconfig.xsd">';
		var xml_end = '</pkg-config>';
		xpdl = vkbeautify.xml(xpdl_top + xpdl + xpdl_end);
		xml = vkbeautify.xml(xml_top + xml + xml_end);
		$('input[name="xpdlcontent"]').val(xpdl);
		$('input[name="xmlcontent"]').val(xpdl);
		$('#containerForm').submit();
	});*/
});
	    
/*  */
$(function() {
	var initProp = '<div>'+
				   '	<div name="id" class="prop-value"><span>id:</span><span>'+htmlEsc(workflow_id)+'</span></div>'+
				   '	<div name="name" class="prop-value"><span>Name:</span><span>'+htmlEsc(workflow_name)+'</span></div>'+
				   '</div>'+
				   '<div class="clearfix"></div>';
	$('.component-prop').append(initProp);
	$('.component-name span').text(workflow_name);
	$('.menu .item').tab();// tab display must come before updateScrollbar

	$('.menu .item').on('click', updateScrollbar);

	// Control property display
	$('.full-right').on('click', '.component-name', function() {
		var parent = $(this).parents('div[data-tab]');
		var ishidden = parent.find('.component-prop').is(':hidden');
		if (ishidden) {
			parent.find('.full-right-bottom ').css({height: '26%'});
			parent.find('.component-name').css({height: '28%'});
			parent.find('.view').css({height: '68%'});
			parent.find('.component-name .icon').removeClass('up').addClass('down');
			parent.find('.component-prop').toggle('slow');
		} else {
			parent.find('.full-right-bottom ').css({height: '8%'});
			parent.find('.component-name').css({height: '100%'});
			parent.find('.view').css({height: '86%'});
			parent.find('.component-name .icon').removeClass('down').addClass('up');
			parent.find('.component-prop').toggle();
		}
	});
});
		
$(function() {
	$('#rMenu').on('mouseleave', function() {
		$('#rMenu').hide();
		// $('#rMenu .item').off('click');
	});
	// semantic Init
	$('.pop-btn').popup();
	// jquery plugin scrollbar
	$(".content-div, .postCondi_extendedAttr, .conditionList, .conditionList2").mCustomScrollbar();

	// Activity properties semantic init
	$('.prop_node .menu .item').tab();
	/* Semantic UI has issues under IE11
	$('.prop_node>.menu .item').on('click', function() {
		var item = $(this).attr('data-tab');
		$('.prop_node [data-tab="'+item+'"]').find('.content-div').mCustomScrollbar("update");
		if (item == 'four') {
			$('.post_condition .postCondi_extendedAttr').mCustomScrollbar("update");
			$('.prop_node.modal').css({
				height: '745px'
			});
			$('.prop_node>.tab').css({
				height: '608px'
			});
		} else {
			$('.prop_node.modal').css({
				height: '577px'
			});
			$('.prop_node>.tab').css({
				height: '447px'
			});
		}
	});*/

	// under Post-conditions tab
	$('.targetActivity .menu .item').on('click', function() {// prevent scrollbar disappearing when switching tabs
		var item = $(this).attr('data-tab');
		if (item == 'four/b') {
			$('.conditionDiv .conditionList').mCustomScrollbar("update");
		}
		if (item == 'four/a') {
			$('.targetActivity .postCondi_extendedAttr').mCustomScrollbar("update");
		}
	});

	$('select.dropdown').dropdown();

	$('.ui.checkbox').checkbox({
		onChecked: function() {
			$(this).parents('.checkbox').find('input[name]').val(true);
		},
		onUnchecked: function() {
			$(this).parents('.checkbox').find('input[name]').val(false);
		}
	});

	// checkbox whether multi-person handling is sequential 
	$('.checkbox.assignmentsOrderDiv').checkbox({
    	onChecked: function() {
    		$(this).parents('.checkbox').find('input[name]').val(true);
			$('.checkbox.completeAllAssignmentsDiv').checkbox('check');
		},
		onUnchecked: function() {
			$(this).parents('.checkbox').find('input[name]').val(false);
		}
	});

	// checkbox Multi-person Handling?
	$('.checkbox.completeAllAssignmentsDiv').checkbox({
    	onChecked: function() {
    		$(this).parents('.checkbox').find('input[name]').val(true);
		},
		onUnchecked: function() {
			$('.checkbox.assignmentsOrderDiv').checkbox('uncheck');
			$(this).parents('.checkbox').find('input[name]').val(false);
		}
	});

	$('.front_condition .radio.checkbox').checkbox({
		onChecked: function() {
			$('.front_condition').find('input[name=isCreateNew]').val($(this).attr('tabindex'));
	    }
	});

	/* Activity properties - General - Define */
	$(document).on('click', '.conventional .definitionBtn', function() {
		$('.conventional_definition.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.prop_node').dimmer('hide');
	        	clearModal(this);
	        	$(this).find('tbody').empty();
	        	$('.conventional_definition .menu .item[data-tab="definition_1"]').trigger('click');
	        	$('.conventional_definition').find('.menu .item[data-tab="definition_2/processer"]').show();
	        	$('.conventional_definition').find('.menu .item[data-tab="definition_2/historyactselect"]').hide();
	        },
			onShow: function() {
	        	$('.modal.prop_node').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* Activity properties - Tools - Add */
	$(document).on('click', '.modal.prop_node .toolAddBtn', function() {
		$('.tool_add.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.prop_node').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.prop_node').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* Activity properties - Tools - Add - Add Extended Attribute */
	$(document).on('click', '.modal.tool_add .actualParametersAdd2', function() {
		$('.tool_extendAttr_add.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.tool_add').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.tool_add').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* Activity properties - Post-conditions - Extended Attributes - Add */
	$(document).on('click', '.post_condition .extendAttrAddBtn', function() {
		$('.postCondition_extendAttr_add.modal').modal({
			allowMultiple: true,
			autofocus: true,
			duration: {},
			onHidden: function() {
				$('.modal.prop_node').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.prop_node').dimmer({closable: false}).dimmer('show');
	        	$('.postCondition_extendAttr_add .green.button').data('event_source', '.post_condition');
	        }
		}).modal('show');
	});

	/* Link properties - Extended Attributes - Add */
	$(document).on('click', '.prop_edge .extendAttrAddBtn', function() {
		$('.postCondition_extendAttr_add.modal').modal({
			allowMultiple: true,
			autofocus: true,
			duration: {},
			onHidden: function() {
				$('.modal.prop_edge').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.prop_edge').dimmer({closable: false}).dimmer('show');
	        	$('.postCondition_extendAttr_add .green.button').data('event_source', '.prop_edge');
	        }
		}).modal('show');
	});

	/* Activity properties - Post-conditions - Condition Settings - Relation Settings */
	$(document).on('click', '.relationshipPlaBtn', function() {
		var num = $('.workflowbeanDiv tbody tr').length;
		if (num) {
			$('.relationshipPlacement.modal').modal({
				allowMultiple: true,
				autofocus: false,
				duration: {},
				onHidden: function() {
					$('.modal.prop_node, .modal.prop_edge').dimmer('hide');
		        	clearModal(this);
		        },
				onShow: function() {
		        	$('.modal.prop_node, .modal.prop_edge').dimmer({closable: false}).dimmer('show');
		        	$('.relationshipPlacement .condition_no').empty();
		        	for (var i = 0; i < num; i++) {
		        		$('.relationshipPlacement .condition_no').append(
		        			'<div class="inline field">'+
						   	'  	<div class="ui checkbox">'+
						   	'  	  	<input type="checkbox" tabindex="0" class="hidden">'+
						   	'  	  	<label>${'+(i+1)+'}</label>'+
						   	'  	  	<input type="hidden" name="${'+(i+1)+'}" value="">'+
						   	'  	</div>'+
						   	'</div>');
		        	}
		        	$('.relationshipPlacement .condition_no').find('.ui.checkbox').checkbox({
						onChecked: function() {
							$(this).parents('.checkbox').find('input[name]').val(true);
						},
						onUnchecked: function() {
							$(this).parents('.checkbox').find('input[name]').val(false);
						}
					});
		        }
			}).modal('show');
		} else {
			layer.msg('Please add a condition!', {time: 2000, icon:2});
		}
	});

	/* Activity properties - Extended Attributes - Add */
	$(document).on('click', '.extended_attr .extendAttrAddBtn', function() {
		$('.extendAttr_add.modal').modal({
			allowMultiple: true,
			autofocus: true,
			duration: {},
			onHidden: function() {
	        	$('.modal.prop_node').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.prop_node').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* Timeout Limits - Add */
	$(document).on('click', '.modal.prop_node .timeoutLimitAddBtn', function() {
		$('.timeoutLimit_add.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.prop_node').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.prop_node').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* Monitoring Info - Add */
	/*$('.monitorinf_add.modal').modal({
		allowMultiple: true,
		autofocus: false, 
		duration: {},
		onHidden: function() {
        	$('.modal.prop_node').dimmer('hide');
        	clearModal(this);
        },
		onShow: function() {
        	$('.modal.prop_node').dimmer({closable: false}).dimmer('show');
        }
	}).modal('attach events', '.modal.prop_node .monitorinfAddBtn'); //attach events has issues in Firefox*/

	$(document).on('click', '.modal.prop_node .monitorinfAddBtn', function() {
		$('.monitorinf_add.modal').modal({
			allowMultiple: true,
			autofocus: false, 
			duration: {},
			onHidden: function() {
	        	$('.modal.prop_node').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.prop_node').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* Monitoring Info - Add - Define */
	$(document).on('click', '.modal.monitorinf_add .definitionBtn', function() {
		$('.monitorinfAddDefinition.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.monitorinf_add').dimmer('hide');
	        	clearModal(this);
	        	$(this).find('tbody').empty();
	        },
			onShow: function() {
	        	$('.modal.monitorinf_add').dimmer({closable: false}).dimmer('show');
	        	$('.monitorinfAddDefinition select[name="definition_role"]').dropdown('set selected', 'responsible');
	        }
		}).modal('show');
	});

	/* Tools - Add - Define */
	$(document).on('click', '.modal.tool_add .definitionBtn', function() {
		$('.tooldefinition.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.tool_add').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.tool_add').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* Tools - Add - Define - Add */
	$(document).on('click', '.modal.tooldefinition .tooldefinitionAddBtn', function() {
		$('.tooldefinition_add.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.tooldefinition').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.tooldefinition').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* Tools - Add - Define - Add - Add */
	$(document).on('click', '.modal.tooldefinition_add .tooldefinitionAddAddBtn', function() {
		$('.tooldefinition_add_add.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.tooldefinition_add').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.tooldefinition_add').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* Tools - Add - Add */
	$(document).on('click', '.modal.tool_add .actualParametersAdd1', function() {
		$('.actualParametersDiv.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.tool_add').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.tool_add').dimmer({closable: false}).dimmer('show');
	        	//ajax request role data
	        }
		}).modal('show');
	});

	/* Tools - Add - Add - Define */
	$(document).on('click', '.modal.actualParametersDiv .definitionBtn', function() {
		$('.toolAddDefinition.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.actualParametersDiv').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.actualParametersDiv').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* Tools - Add - Add - Define - Add */
	$(document).on('click', '.modal.toolAddDefinition .toolAddDefinitionAddBtn', function() {
		$('.toolAddDefinitionAdd.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.toolAddDefinition').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.toolAddDefinition').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* General - Define - Advanced - General type onChange event */
	$('.def_common [data-tab$="/commonly"] select[name=definition_type]').on('change', function() {
		$(this).parents('[data-tab$="/commonly"]').find('input').val('');
	});

    /* Click to show tree structure div */
	$('input[name="def_name_show"]').on('click', function() {
		var def_type = $(this).parents('.modal').find('.tab[data-tab$="/commonly"] select[name=definition_type]').val();
		if (!def_type) {
			layer.msg('Select a type first!', {time: 2000, icon:0, offset: '180px'});
			return;
		}
		if (def_type.indexOf('role') != -1) {// type - role
			$('.role_manage.modal').modal({
				allowMultiple: true,
				autofocus: false,
				duration: {},
				onHidden: function() {
		        	$('.modal.conventional_definition,.modal.monitorinfAddDefinition').dimmer('hide');
		        	clearModal(this);
		        },
				onShow: function() {
		        	$('.modal.conventional_definition,.modal.monitorinfAddDefinition').dimmer({closable: false}).dimmer('show');
		        	selectInfo(1, 15);
		        }
			}).modal('show');
			return;
		}
		// By type, define url
		var url = '';
		if (def_type == 'human|Person') {
			url = 'platform/person/userTree.do?state=';
		} else if (def_type.indexOf('org') != -1) {
			url = 'platform/organise/organiseTree.do?state=';
		} else if (def_type == 'allParty|Everyone [Person]') {
			layer.msg('No need to fill in!', {time: 2000, icon:4});
			return;
		}

		var setting = {
			view: {
				dblClickExpand: false
			},
			check: {
				enable: true,
				chkStyle: "radio",
				radioType: "all"
			},
			callback: {
				onClick: OnClick,
				onAsyncSuccess: onsuccess 
			},
			async: {  
				autoParam: ["id=node", "value=parentId"], 
				otherParam: {}, 
				contentType: "application/x-www-form-urlencoded;charset=UTF-8",  
				enable: true,  
				type: "post",  
				url: url,
				dataFilter: ajaxDataFilter
			},
			data:{  
				simpleData: {
					enable: true,
					rootPId: "xnode-40"
				} 
			} 
		};

		treelayer = layer.open({
		  	type: 1,
		  	title: 'PersonTree',
		  	skin: 'layui-layer-rim', // border
		  	area: ['300px', '350px'], // width/height
		  	offset: ['167px', '587px'],
		  	content: '<div id="treeDemo_div" style="height:98%">'+
		  				'<ul id="treeDemo" class="ztree">'+
		  				'</ul>'+
		  				'<div class="buttons_bottom">'+
			  				'<div class="ui horizontal divider">'+
			  					'<button class="ui primary mini button">OK</button>'+
								'<button class="ui cancel mini button">Cancel</button>'+
							'</div>'+
						'</div>'+
					 '</div>'
		});
		/* ztree */
		$.fn.zTree.init($("#treeDemo"), setting);
		zTree = $.fn.zTree.getZTreeObj("treeDemo");
	});
	// Tree view - Cancel
	$(document).on('click', '#treeDemo_div .cancel', function() {
		layer.close(treelayer);
	});
	// Tree view - OK
	$(document).on('click', '#treeDemo_div .primary', function() {
		var nodes = zTree.getCheckedNodes(true);
		if (nodes.length) {
			if ($('.conventional_definition').is(':visible')) {
				$('.conventional_definition input[name=def_name_show]').val(nodes[0].name);
				$('.conventional_definition input[name=definition_name]').val(nodes[0].value + '|' + nodes[0].name);
			} else {
				$('.monitorinfAddDefinition input[name=def_name_show]').val(nodes[0].name);
				$('.monitorinfAddDefinition input[name=definition_name]').val(nodes[0].value + '|' + nodes[0].name);
			}
		} else {
			layer.msg('Please select an element!', {time: 2000, icon: 0, offset: ['270px','650px']});
			return;
		}
		layer.close(treelayer);
	});
	// Role management - Search
	$('.role_manage .search.icon').on('click', function() {
		selectInfo(1, 15);
	});
	// Role management - Reset
	$('.role_manage .resetBtn').on('click', function() {
		$(this).siblings('.role-search').find('input').val('');
		$('.role_manage .search.icon').trigger('click');
	});
	// Role management - OK
	$('.role_manage .okBtn').on('click', function() {
		var jsonstr = $(this).parents('#role-center').find('tr.active').attr('jsonstr');
		if (jsonstr) {
			var jsonobj = JSON.parse(jsonstr);
			if ($('.conventional_definition').is(':visible')) {
				$('.conventional_definition input[name=def_name_show]').val(jsonobj.ROLENAME);
				$('.conventional_definition input[name=definition_name]').val(jsonobj.ROLEID + '|' + jsonobj.ROLENAME);
			} else {
				$('.monitorinfAddDefinition input[name=def_name_show]').val(jsonobj.ROLENAME);
				$('.monitorinfAddDefinition input[name=definition_name]').val(jsonobj.ROLEID + '|' + jsonobj.ROLENAME);
			}
			$(this).parents('.modal').modal('hide');
		} else {
			layer.msg('Please select an element!', {time: 2000, icon: 0, offset: '180px'});
			return;
		}
	});

	
});

// Clear form
function clearModal(selector) {
	$(selector).find('input, textarea').val('');
   	$(selector).find('.ui.dropdown').dropdown('clear');
}

// Refresh scrollbars
function updateScrollbar() {
	var dataTab = $(this).attr('data-tab');
	if (dataTab == 'third') { //xml View
		$("#xmlContainer").mCustomScrollbar("update");
	}
	if (dataTab == 'second') { //xpdl View
		$("#xpdlContainer").mCustomScrollbar("update");
	}
}

// zTree data filter
function ajaxDataFilter(treeId, parentNode, responseData) {
    if (responseData) {
      for (var i = 0; i < responseData.length; i++) {
        responseData[i].name = responseData[i].text;
        responseData[i].open = responseData[i].expanded;
        responseData[i].isParent = !responseData[i].leaf;
        responseData[i].nocheck = responseData[i].checked == false ? false : true;
      }
    }
    return responseData;
}

// zTree click node
function OnClick(event, treeId, treeNode) {
	zTree.checkNode(treeNode, true, false);
}

// zTree onsuccess
function onsuccess(event, treeId, treeNode, msg) {
	try {
	    var dataJson = JSON.parse(msg);
		if (!dataJson.length) return;
		if (dataJson[0].id == 'root-root' && dataJson[0].expanded) {
			var node = zTree.getNodeByParam("id", dataJson[0].id);
			zTree.expandNode(node, true);
		}
	} catch (e) {
		layer.msg('platform not logged in!', {time: 2000, icon:2});
		console.error('platform not logged in!');
	    //window.location.href = "https://segmentfault.com/search?q=[js]+" + e.message;
	}
}

// Role management pagination
function selectInfo(offset, size) {
	if (offset) {
 		$(".role_manage #offset").val(offset);
 	}
 	if (size) {
 		$(".role_manage #size").val(size);
 	}
 	$("#searchForm").trimForm().ajaxSubmit({
	    url: "platform/role/query.do?hyper=false",
 		type: "post",
 		data: {
 			"start": (offset-1)*size,
        	"limit": size //backend uses default 15; passed value is ignored
        },
        dataType: "json",
	    success: function(result) {
	        $('.role_manage .content-tab').empty();
	        if (result.totalCount) {
	            $.pages({
	                count: result.totalCount, //total count
	                curr: offset, //initial current page
	            }, selectInfo, size);
	            //show data
				$('.role_manage .content-tab').html(juicer($('#role_manage_tpl').html(), result));
				$('.role_manage .content-tab').find('.ui.checkbox').checkbox();
	        } else {
				$('.role_manage .content-tab').html('<div class="no-info">No data...</div>');
			}
	    },
		error: function(data) {
			alert("Server busy, please try again later...");
		}
	});
}

/*-------------Init tab select start-------------*/
initSelect();
		
function initSelect() {
	$.ajax({
	    url: 'wfConf/WfDSystemConfig.xml',
	    dataType: 'xml',
	    success: function(data) {
	        //console.log(data);
	        window.wfdConfig = data;
	        //Dropdown list
	        $(data).find('selects select').each(function() {
	            var selectId = $(this).attr('id');
	            var select = {selectId: selectId, options: []};
	            $(this).find('selectOption').each(function() {
	            	var option = {
	            			value: $(this).attr('value'),
	            			show: $(this).text()
	            		};
	            	select.options.push(option);
		        });
	            $('.'+selectId).append(juicer($('#select_tpl').html(), select))
	            			   .find('.ui.dropdown').dropdown();
	            if (selectId == 'transitionEventType') {
	            	// Post-conditions - Condition Settings - Business Object
	            	select.bean = { opts: [] };
			        $(data).find('beanconditionsdefs beanconditionsdef').each(function() {
			        	var option = {
				        	name: $(this).attr('name'),
				        	value: $(this).attr('id')
			        	};
			        	select.bean.opts.push(option);
			        });
	            	$('#transition_tpl').html(juicer($('#transition_tpl').html(), select));
	            }
		    });
	        var participant = {
                selectItems: []
            };
	        $(data).find('participant-option select-item').each(function() {
	            var selectItem = {
                	key: $(this).attr('key'),
                	displayName: $(this).attr('display-name'),
                	selectTypes: []
	            };
	            $(this).find('select-type').each(function() {
	              	var selectType = {
                		key: $(this).attr('key'),
                		name: $(this).attr('name')
	              	};
	              	selectItem.selectTypes.push(selectType);
	            });
	            participant.selectItems.push(selectItem);
	        });
	        $('.conventional_definition').append(juicer($('#participant_tpl').html(), participant));
	        $('.conventional_definition').find('.menu .item').tab();
	        $('.conventional_definition').find('select.dropdown').dropdown();

	    }
	});
}
/*-------------Init tab select end-------------*/
