
function $(selector) {
	return document.querySelector(selector);
}

function positionClients(ctx, p, startAngle, clients, startDistance) {
	if (clients === 0) {
		return;
	}

	var radius = 3;
	var a = 1.2;

	for (var orbit = 0, i = 0; i < clients; orbit++) {
		var distance = startDistance + orbit * 2 * radius * a;
		var n = Math.floor((Math.PI * distance) / (a * radius));
		var delta = clients - i;

		for (var j = 0; j < Math.min(delta, n); i++, j++) {
			var angle = 2 * Math.PI / n * j;
			var x = p.x + distance * Math.cos(angle + startAngle);
			var y = p.y + distance * Math.sin(angle + startAngle);

			ctx.moveTo(x, y);
			ctx.arc(x, y, radius, 0, 2 * Math.PI);
		}
	}
}

function try_get(obj, key, default) {
	var v = obj[key];
	if (v !== undefined) {
		return v;
	} else {
		return default;
	}
}

function append(parent, name, content) {
  var e = document.createElement(name);
  if ((typeof content === 'string') || (typeof content === 'number')) {
    var text = document.createTextNode(content.toString());
    e.appendChild(text);
  }
  parent.appendChild(e);
  return e;
}

function limitFloat(value, min, max) {
	if (value < min || isNaN(value)) {
		return min;
	}
	if (value > max) {
		return max;
	}
	return value;
}

function params(obj) {
	var str = '';
	for (var key in obj) {
		if (str.length) str += '&';
		else str += '?';
		str += encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]);
	}
	return str.replace(/%20/g, '+');
}

function send(url, obj, func) {
	url += params(obj);
	jx.load(url, func, 'text');
}

function toggleFullscreen(btn) {
	if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement) {
		var fel = document.firstElementChild;
		var func = fel.requestFullscreen
			|| fel.webkitRequestFullScreen
			|| fel.mozRequestFullScreen;
		func.call(fel);
		btn.classList.remove('ion-full-enter');
		btn.classList.add('ion-full-exit');
	} else {
		func = document.exitFullscreen
			|| document.webkitExitFullscreen
			|| document.mozCancelFullScreen;
		if (func) {
			func.call(document);
			btn.classList.remove('ion-full-exit');
			btn.classList.add('ion-full-enter');
		}
	}
}

//from jx_compressed.js
jx={getHTTPObject:function(){var A=false;if (typeof ActiveXObject!='undefined'){try{A=new ActiveXObject('Msxml2.XMLHTTP')}catch(C){try{A=new ActiveXObject('Microsoft.XMLHTTP')}catch(B){A=false}}}else{if (window.XMLHttpRequest){try{A=new XMLHttpRequest()}catch(C){A=false}}}return A},load:function(url,callback,format){var http=this.init();if (!http||!url){return }if (!format){var format='text'}format=format.toLowerCase();var now='uid='+new Date().getTime();url+=(url.indexOf('?')+1)?'&':'?';url+=now;http.open('GET',url,true);http.onreadystatechange=function(){if (http.readyState==4){if (http.status==200){var result='';if (http.responseText){result=http.responseText}if (format.charAt(0)=='j'){result=result.replace(/[\n\r]/g,'');result=eval('('+result+')')}if (callback){callback(result)}}else{alert("Connection Lost")}}};http.send(null)},init:function(){return this.getHTTPObject()}}
