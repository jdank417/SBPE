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

/**
 * Escape text for use inside XML attribute values / element content
 */
function xmlEsc(str) {
	if (str === undefined || str === null) return '';
	return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Escape text before inserting it into HTML
 */
function htmlEsc(str) {
	if (str === undefined || str === null) return '';
	return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------------ */
/* Node geometry: activities are rounded rectangles sized to their     */
/* label, start/end are small circles. Shared by the renderer and the  */
/* XPDL importer (which needs the sizes to space imported diagrams).   */
/* ------------------------------------------------------------------ */
var NODE_STYLE = {
	font: '12px Arial, Helvetica, sans-serif',
	letterSpacing: 0.5,
	lineHeight: 15,
	padX: 12,
	padY: 9,
	minW: 96,
	minH: 44,
	maxTextW: 150,
	maxLines: 5,
	cornerRadius: 10,
	eventRadius: 22
};

var _labelCtx = null;
function measureLabel(text) {
	text = String(text);
	if (_labelCtx === null) {
		try {
			_labelCtx = document.createElement('canvas').getContext('2d');
			_labelCtx.font = NODE_STYLE.font;
		} catch (e) {
			_labelCtx = false;
		}
	}
	var w = _labelCtx ? _labelCtx.measureText(text).width : text.length * 6.5;
	return w + text.length * NODE_STYLE.letterSpacing;
}

// wrap a label into lines no wider than maxWidth; long words are broken at
// camelCase / punctuation boundaries, and as a last resort by characters
function wrapLabel(text, maxWidth) {
	maxWidth = maxWidth || NODE_STYLE.maxTextW;
	var tokens = [];
	String(text || '').trim().split(/\s+/).forEach(function(word) {
		if (!word) return;
		if (measureLabel(word) <= maxWidth) {
			tokens.push({t: word, glue: false});
			return;
		}
		var parts = word.replace(/([a-z0-9])([A-Z])/g, '$1\u0001$2').replace(/([_\-.\/])/g, '$1\u0001').split('\u0001');
		parts.forEach(function(part, i) {
			if (measureLabel(part) <= maxWidth) {
				tokens.push({t: part, glue: i > 0});
				return;
			}
			// first chunk joins the previous part like a normal part, the rest always glue
			var chunk = '',
				first = true;
			for (var c = 0; c < part.length; c++) {
				if (chunk && measureLabel(chunk + part[c]) > maxWidth) {
					tokens.push({t: chunk, glue: first ? i > 0 : true});
					first = false;
					chunk = '';
				}
				chunk += part[c];
			}
			if (chunk) tokens.push({t: chunk, glue: first ? i > 0 : true});
		});
	});
	var lines = [],
		line = '';
	tokens.forEach(function(tok) {
		var candidate = line ? line + (tok.glue ? '' : ' ') + tok.t : tok.t;
		if (!line || measureLabel(candidate) <= maxWidth) {
			line = candidate;
		} else {
			lines.push(line);
			line = tok.t;
		}
	});
	if (line) lines.push(line);
	if (lines.length > NODE_STYLE.maxLines) {
		lines = lines.slice(0, NODE_STYLE.maxLines);
		var last = lines[lines.length - 1];
		while (last.length > 1 && measureLabel(last + '…') > maxWidth) last = last.slice(0, -1);
		lines[lines.length - 1] = last + '…';
	}
	return lines.length ? lines : [''];
}

// {shape, w, h, r?, lines?} for a node, cached until its title changes
function nodeGeometry(node) {
	var key = node.type + '|' + node.title;
	if (node._geo && node._geo.key === key) return node._geo;
	var geo;
	if (node.type === 'start' || node.type === 'end') {
		var r = NODE_STYLE.eventRadius;
		geo = {shape: 'circle', r: r, w: r * 2, h: r * 2, lines: [node.title || '']};
	} else {
		var lines = wrapLabel(node.title);
		var textW = 0;
		lines.forEach(function(l) {
			textW = Math.max(textW, measureLabel(l));
		});
		geo = {
			shape: 'rect',
			w: Math.ceil(Math.max(NODE_STYLE.minW, textW + NODE_STYLE.padX * 2)),
			h: Math.ceil(Math.max(NODE_STYLE.minH, lines.length * NODE_STYLE.lineHeight + NODE_STYLE.padY * 2)),
			lines: lines
		};
	}
	geo.key = key;
	// non-enumerable so it never ends up in exported JSON
	try {
		Object.defineProperty(node, '_geo', {value: geo, writable: true, configurable: true, enumerable: false});
	} catch (e) {
		node._geo = geo;
	}
	return geo;
}

/* ------------------------------------------------------------------ */
/* Colours                                                             */
/* ------------------------------------------------------------------ */
var _colorCtx = null;

// Parse the colour formats found in XPDL files into "#rrggbb" (null if
// missing, unparseable or fully transparent):
//   "220,220,220" / "220;220;220"  (JaWE/TWE)
//   "-16553830" / "16777215"       (.NET signed ARGB ints, e.g. Bizagi)
//   "#FF9999", "#AARRGGBB", "#abc", CSS names ("light blue"), rgb(...)
function parseXpdlColor(value) {
	if (value === undefined || value === null) return null;
	var s = String(value).trim();
	if (!s) return null;
	var r, g, b, a = 255, m;
	if ((m = /^(\d{1,3})\s*[,;]\s*(\d{1,3})\s*[,;]\s*(\d{1,3})(?:\s*[,;]\s*(\d{1,3}))?$/.exec(s))) {
		r = +m[1]; g = +m[2]; b = +m[3];
		if (m[4] !== undefined) a = +m[4];
	} else if (/^-?\d+$/.test(s)) {
		var n = parseInt(s, 10);
		var u = n >>> 0;
		r = (u >>> 16) & 255; g = (u >>> 8) & 255; b = u & 255;
		a = n >= 0 && n <= 0xFFFFFF ? 255 : (u >>> 24) & 255;
	} else if ((m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s))) { // .NET style #AARRGGBB
		a = parseInt(m[1], 16); r = parseInt(m[2], 16); g = parseInt(m[3], 16); b = parseInt(m[4], 16);
	} else if ((m = /^#?([0-9a-f]{6})$/i.exec(s))) {
		var v = parseInt(m[1], 16);
		r = (v >> 16) & 255; g = (v >> 8) & 255; b = v & 255;
	} else {
		// let the browser parse names, #abc, rgb(), hsl()...
		if (_colorCtx === null) {
			try {
				_colorCtx = document.createElement('canvas').getContext('2d');
			} catch (e) {
				_colorCtx = false;
			}
		}
		if (!_colorCtx) return null;
		var probe = s.replace(/\s+/g, '').toLowerCase();
		_colorCtx.fillStyle = '#010203';
		_colorCtx.fillStyle = probe;
		var out = _colorCtx.fillStyle;
		if (out === '#010203' && probe !== '#010203') return null;
		if ((m = /^#([0-9a-f]{6})$/i.exec(out))) return '#' + m[1].toLowerCase();
		if ((m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(out))) {
			r = +m[1]; g = +m[2]; b = +m[3];
			if (m[4] !== undefined) a = Math.round(parseFloat(m[4]) * 255);
		} else {
			return null;
		}
	}
	if (a === 0 || r > 255 || g > 255 || b > 255) return null;
	return '#' + [r, g, b].map(function(x) {
		return ('0' + x.toString(16)).slice(-2);
	}).join('');
}

// readable label colour for a fill: white on dark fills, otherwise default
function contrastTextColor(hex) {
	var m = /^#([0-9a-f]{6})$/i.exec(hex || '');
	if (!m) return null;
	var v = parseInt(m[1], 16);
	var lum = (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
	return lum < 0.5 ? '#ffffff' : '#1b1f3b';
}
