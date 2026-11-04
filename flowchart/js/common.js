/**
 * jquery function extensions
 */
$.fn.extend({
	trimForm: function(){
		$(this).find("input, textarea").each(function(){
			$(this).val($.trim($(this).val())); 
		});
		return $(this);
	}
});

/**
 * jquery function extensions
 */
$.extend({
	/**
	 * Show pagination info
	 * @param options custom options, same rules as the original plugin
	 * @param select JS function that queries data; two params: current page, page size
	 * @param size items per page, defaults to 10
	 */
	pages: function(options, select, size) {
		//page size defaults to 10
		size = !size || size < 1 ? 10 : size;
		var pages = options.count % size == 0 ? options.count / size : Math.ceil(options.count/size);
		//default pagination config
		var settings = {
		    cont: 'pageDiv', // container. Accepts an id, native DOM object, or jQuery object. [e.g. container is]:<div id="pageDiv"></div>
		    pages: pages, // total pages from backend
		    skin: '#3B5998', // load built-in skin, or assign a hex color directly, e.g.:#c00
		    curr: options.curr, // current page
		    skip: true, // enable page jump
		    groups: 3, // number of consecutive page links shown
		    jump: function(obj, first) {// callback after page change
				// add total page count
				if (obj.count > size) {
					$("#" + this.cont + '>div').append("<span class='pageCount'>Total: " + obj.count + " items</span>");
				}
				if (!first) {
					select(obj.curr, size);
				}
			}	
		};
		// merge pagination config
		$.extend(settings, options);
		// show pagination
		laypage(settings);
	}

});

 /**
 * Date extension: format a Date as a String * month(M), day(d), 12-hour(h), 24-hour(H), minute(m), second(s), weekday(E), quarter(q)
 * can use 1-2 placeholders * year(y) can use 1-4 placeholders, millisecond(S) only 1 placeholder (a 1-3 digit number) * eg: * (new
 * Date()).pattern("yyyy-MM-dd hh:mm:ss.S")==> 2006-07-02 08:09:04.423      
 * (new Date()).pattern("yyyy-MM-dd E HH:mm:ss") ==> 2009-03-10 Tue 20:09:04      
 * (new Date()).pattern("yyyy-MM-dd EE hh:mm:ss") ==> 2009-03-10 Tue 08:09:04      
 * (new Date()).pattern("yyyy-MM-dd EEE hh:mm:ss") ==> 2009-03-10 Tuesday 08:09:04      
 * (new Date()).pattern("yyyy-M-d h:m:s.S") ==> 2006-7-2 8:9:4.18      
 */     
Date.prototype.pattern = function(fmt) {         
    var o = {         
	    "M+" : this.getMonth() + 1, //month         
	    "d+" : this.getDate(), //day         
	    "h+" : this.getHours() % 12 == 0 ? 12 : this.getHours() % 12, //hour         
	    "H+" : this.getHours(), //hour         
	    "m+" : this.getMinutes(), //minute         
	    "s+" : this.getSeconds(), //second         
	    "q+" : Math.floor((this.getMonth() + 3) / 3), //quarter         
	    "S" : this.getMilliseconds() //millisecond         
    };         
    var week = {         
	    "0" : "/u65e5",         
	    "1" : "/u4e00",         
	    "2" : "/u4e8c",         
	    "3" : "/u4e09",         
	    "4" : "/u56db",         
	    "5" : "/u4e94",         
	    "6" : "/u516d"        
    };         
    if (/(y+)/.test(fmt)) {         
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));         
    }         
    if (/(E+)/.test(fmt)) {         
        fmt = fmt.replace(RegExp.$1, ((RegExp.$1.length > 1) ? (RegExp.$1.length>2 ? "/u661f/u671f" : "/u5468") : "") + week[this.getDay()+""]);         
    }         
    for (var k in o) {         
        if (new RegExp("("+ k +")").test(fmt)) {         
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));         
        }         
    }         
    return fmt;         
};     

// Extend the default Number object with a formatMoney() method:
// usage: someVar.formatMoney(decimalPlaces, symbol, thousandsSeparator, decimalSeparator)
// defaults: (2, "$", ",", ".")
// var price = 4999.99;
// alert(price.formatMoney(2, "€", ".", ",")); // €4.999,99
Number.prototype.formatMoney = function (places, symbol, thousand, decimal) {
	places = !isNaN(places = Math.abs(places)) ? places : 2;
	symbol = symbol !== undefined ? symbol : "$";
	thousand = thousand || ",";
	decimal = decimal || ".";
	var number = this,
		negative = number < 0 ? "-" : "",
		i = parseInt(number = Math.abs(+number || 0).toFixed(places), 10) + "",
		j = (j = i.length) > 3 ? j % 3 : 0;
	return symbol + negative + (j ? i.substr(0, j) + thousand : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + thousand) + (places ? decimal + Math.abs(number - i).toFixed(places).slice(2) : "");
};

//Format number
function cc(obj) {
	if (obj) {
		return obj.toFixed(2);
	} else {
		return "0.00";
	}
}

//Format currency amount
function ccMoney(obj) {
	if (obj) {
		return obj.formatMoney();
	} else {
		return "$ 0.00";
	}
}

// Format json
// json_obj('{"name":"zhang","sex":"male"}');
// return '{\"name\":\"zhang\",\"sex\":\"male\"}' 
function json_obj(str) {
	str = str.replace(new RegExp('(["\"])', 'g'), "\\\"");
	var pattern = new RegExp("'([\r\n])[\s]+'") ; //create a regex object containing \n
	var result = "";  //define an empty string
	for(var i = 0;i < str.length; i++) {
		result = result + str.substr(i, 1).replace(pattern, '');//scan char by char; replace \n with empty;
	}
	return result; //return the converted json string
}

//Random number below n
function getRandom(n) {
	return Math.floor(Math.random() * n + 1);
}

/** 
 * randomWord generate a random alphanumeric string of any length
 * randomFlag-whether length is arbitrary; min - minimum length [fixed length]; max - maximum length
 * xuanfeng 2014-08-28
 */
function randomWord(randomFlag, min, max) {
    var str = "",
        range = min,
        arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 
        	   /*'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 
        	   'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 
        	   'u', 'v', 'w', 'x', 'y', 'z', */
        	   'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 
        	   'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 
        	   'U', 'V', 'W', 'X', 'Y', 'Z'];
    if (randomFlag) {
        range = Math.round(Math.random() * (max - min)) + min;
    }
    for (var i = 0; i < range; i++) {
        pos = Math.round(Math.random() * (arr.length - 1));
        str += arr[pos];
    }
    return str;
}

/**
 * [generateUUID return a sequence code]
 * @return {String} [uuid]
 */
function generateUUID() {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
}

/**
 * Generate unique sequence numbers
 */
var serial_marker = function() {
	var prefix = '';
	var seq = 1;
	return {
	    set_prefix: function(p) {
	        prefix = String(p);
	    },
	    set_seq: function(s) {
	        seq = s;
	    },
	    gensym: function() {
	        var result = prefix + seq;
	        seq += 1;
	        return result;
	    }
	};
};

/**
 * Get the node object from nodes by id
 */
function getNodeById(id, nodes) {
	if (!nodes.length) return false;
	nodes.forEach(function(node) {
		if (node.id == id) {
			return node;
		}
	});
	return false;
}

//this helper is mainly for numeric arrays
function maxArr(arr) {
    return Math.max.apply(null, arr);
}
function minArr(arr) {
    return Math.min.apply(null, arr);
}

var is_array = function(value) {
	return Object.prototype.toString.apply(value) === '[object Array]';
};

var is_number = function(value) {
	return typeof value === 'number' && isFinite(value);
};

/**
 * Holds all GraphCreator objects and methods 
 */
var graphPool = {
	pools: [],
	updateGraphActiveById: function(containerId) {
	  this.pools.forEach(function(graph) {
	    if (graph.containerId === containerId) {
	      	graph.state.activeEdit = true;
	    } else {
	      	graph.state.activeEdit = false;
	    }
	  });
	},
	getGraphByActiveEdit: function() {
	  	var graph_active = this.pools.find(function(graph) {
	    	return graph.state.activeEdit;
	  	});
	  	return graph_active;
	},
	removeGraphFromPools: function(containerId) {
		var pools = this.pools;
		for (var i = 0; i < pools.length; i++) {
			if (pools[i].containerId === containerId) {
				pools.splice(i, 1);
			}
		}

	}
};

/**
 * Letter case conversion
 * @param  {[type]} str  string to convert	
 * @param  {[type]} type 1: capitalize first 2: lowercase first 3: swap case 4: all upper 5: all lower
 * @return {[type]}      converted string
 * changeCase('asdasd', 1) --> Asdasd
 */
function changeCase(str, type) {
	if (!str) return '';
    function ToggleCase(str) {
        var itemText = "";
        str.split("").forEach(
            function (item) {
                if (/^([a-z]+)/.test(item)) {
                    itemText += item.toUpperCase();
                }
                else if (/^([A-Z]+)/.test(item)) {
                    itemText += item.toLowerCase();
                }
                else{
                    itemText += item;
                }
            });
        return itemText;
    }
    switch (type) {
        case 1:
            return str.replace(/^(\w)(\w+)/, function (v, v1, v2) {
                return v1.toUpperCase() + v2;
            });
        case 2:
            return str.replace(/^(\w)(\w+)/, function (v, v1, v2) {
                return v1.toLowerCase() + v2;
            });
        case 3:
            return ToggleCase(str);
        case 4:
            return str.toUpperCase();
        case 5:
            return str.toLowerCase();
        default:
            return str;
    }
}
/*
if (!String.prototype.includes) {
  String.prototype.includes = function(search, start) {
    'use strict';
    if (typeof start !== 'number') {
      start = 0;
    }
    
    if (start + search.length > this.length) {
      return false;
    } else {
      return this.indexOf(search, start) !== -1;
    }
  };
}*/
