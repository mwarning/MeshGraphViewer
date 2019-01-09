
function createWS(graph) {
	var self = {};

	var conn = null;
	function log(msg) {
		console.log(msg);
		//var control = $('#log');
	 // control.html(control.html() + msg + '<br/>');
		//control.scrollTop(control.scrollTop() + 1000);
	}

	self.connect = function () {
		self.disconnect();
		var wsUri = (window.location.protocol=='https:'&&'wss://'||'ws://')+window.location.host + '/ws/';
		conn = new WebSocket(wsUri);
		log('Connecting...');
		conn.onopen = function() {
			log('Connected. Fetch graph.');
			self.send("graph");
		};
		conn.onmessage = function(e) {
			var json = JSON.parse(e.data);
			if (json && json.command == "graph") {
				graph.addElements(data.nodes, data.links);
			}
			log('Received data for ' + e.data);
		};
		conn.onclose = function() {
			log('Disconnected.');
			conn = null;
		};
	}

	self.disconnect = function () {
		if (conn != null) {
			log('Disconnecting...');
			conn.close();
			conn = null;
		}
	}

	self.send = function (data) {
		if (conn != null) {
			console.log("send: " + data);
			conn.send(data);
		} else {
			console.log("conn is null!");
		}
	}

	return self;
}
