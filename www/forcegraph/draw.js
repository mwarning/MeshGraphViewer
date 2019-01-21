
function createDraw() {
	var self = {};

	var ctx;
	var width;
	var height;

	var transform;

	var selectedNodes = [];
	var selectedLinks = [];

	var highlightedNodes = [];
	var highlightedLinks = [];

	var clientColor = '#e6324b';
	var selectColor = 'rgba(255, 255, 255, 0.2)';
	var highlightColor = 'rgba(0, 0, 255, 0.2)';
	var linkScale = d3.interpolate('#F02311', '#04C714');
	var bandwidthWidthScale = d3.interpolateNumber(1.0, 3.0);
	var bandwidthAlphaScale = d3.interpolateNumber(0.1, 0.8);

	var NODE_RADIUS = 15;
	var LINE_RADIUS = 12;

	function drawDetailNode(d) {
		if (transform.k > 1) {
			if ('clients' in d.o) {
				ctx.beginPath();
				ctx.fillStyle = clientColor;
				positionClients(ctx, d, Math.PI, d.o.clients, 15);
				ctx.fill();
			}

			if ('name' in d.o) {
				ctx.beginPath();
				ctx.textAlign = 'center';
				ctx.fillStyle = '#fff';
				ctx.fillText(d.o.name, d.x, d.y + 20);
			}

			if ('label' in d.o) {
				ctx.beginPath();
				ctx.textAlign = 'center';
				ctx.fillStyle = 'black';
				ctx.fillText(d.o.label, d.x, d.y + 3.5);
			}
		}
	}

	function drawHighlightNode(d) {
		if (highlightedNodes.includes(d)) {
			ctx.arc(d.x, d.y, NODE_RADIUS * 1.5, 0, 2 * Math.PI);
			ctx.fillStyle = highlightColor;
			ctx.fill();
			ctx.beginPath();
		}
	}

	function drawSelectedNode(d) {
		if (selectedNodes.includes(d)) {
			ctx.arc(d.x, d.y, NODE_RADIUS * 1.5, 0, 2 * Math.PI);
			ctx.fillStyle = selectColor;
			ctx.fill();
			ctx.beginPath();
		}
	}

	function drawHighlightLink(d, to) {
		if (highlightedLinks.includes(d)) {
			ctx.lineTo(to[0], to[1]);
			ctx.strokeStyle = highlightColor;
			ctx.lineWidth = LINE_RADIUS * 2;
			ctx.lineCap = 'round';
			ctx.stroke();
			to = [d.source.x, d.source.y];
		}
		return to;
	}

	function drawSelectLink(d, to) {
		if (selectedLinks.includes(d)) {
			ctx.lineTo(to[0], to[1]);
			ctx.strokeStyle = selectColor;
			ctx.lineWidth = LINE_RADIUS * 2;
			ctx.lineCap = 'round';
			ctx.stroke();
			to = [d.source.x, d.source.y];
		}
		return to;
	}

	self.drawNode = function (d) {
		if (d.x < transform.invertX(0) || d.y < transform.invertY(0) || transform.invertX(width) < d.x || transform.invertY(height) < d.y) {
			return;
		}
		ctx.beginPath();

		drawSelectedNode(d);
		drawHighlightNode(d);

		if ('ring_color' in d.o) {
			ctx.arc(d.x, d.y, 8, 0, 2 * Math.PI);
			ctx.fillStyle = d.o.ring_color;
			ctx.fill();
			ctx.beginPath();
		}

		if ('body_color' in d.o) {
			ctx.arc(d.x, d.y, 7, 0, 2 * Math.PI);
			ctx.fillStyle = d.o.body_color;
			ctx.fill();
		} else {
			ctx.arc(d.x, d.y, 7, 0, 2 * Math.PI);
			ctx.fillStyle = '#fff';
			ctx.fill();
		}

		drawDetailNode(d);
	};

	self.drawLink = function (d) {
		var zero = transform.invert([0, 0]);
		var area = transform.invert([width, height]);
		if (d.source.x < zero[0] && d.target.x < zero[0] || d.source.y < zero[1] && d.target.y < zero[1] ||
				d.source.x > area[0] && d.target.x > area[0] || d.source.y > area[1] && d.target.y > area[1]) {
			return;
		}
		ctx.beginPath();
		ctx.moveTo(d.source.x, d.source.y);
		var to = [d.target.x, d.target.y];

		to = drawSelectLink(d, to);
		to = drawHighlightLink(d, to);

		var grd = ctx.createLinearGradient(d.source.x, d.source.y, d.target.x, d.target.y);
		grd.addColorStop(0.45, linkScale(d.o.source_tq)); //source_tq));
		grd.addColorStop(0.55, linkScale(d.o.target_tq)); //target_tq));

		ctx.lineTo(to[0], to[1]);
		ctx.strokeStyle = grd;
		//ctx.strokeStyle = linkScale(d.o.quality / 100);
		ctx.lineWidth = bandwidthWidthScale(1.0);
		ctx.globalAlpha = bandwidthAlphaScale(1.0);

		ctx.stroke();
		ctx.globalAlpha = 0.8;
		ctx.lineWidth = 2.5;

		if ('label' in d.o) {
			ctx.beginPath();
			ctx.textAlign = 'center';
			ctx.fillStyle = 'black';
			ctx.fillText(d.o.label, (d.source.x + to[0]) / 2, (d.source.y + to[1]) / 2 + 3);
		}
	};

	self.setCTX = function setCTX(newValue) {
		ctx = newValue;
	};

	self.getSelectedIntNodes = function () {
		return selectedNodes;
	};

	self.getSelectedIntLinks = function () {
		return selectedLinks;
	};

	self.clearSelection = function () {
		selectedNodes = [];
		selectedLinks = [];
	};

	self.setSelection = function (nodes, links) {
		selectedNodes = nodes;
		selectedLinks = links;
	};

	self.setHighlight = function (nodes, links) {
		highlightedNodes = nodes;
		highlightedLinks = links;
	};

	self.clearHighlight = function () {
		highlightedNodes = [];
		highlightedLinks = [];
	};

	// Remove selected/highlighted nodes/links that were deleted
	self.filterSelections = function (intNodes, intLinks) {
		var highlightedNodes_count = highlightedNodes.length;
		var highlightedLinks_count = highlightedLinks.length;
		var selectedNodes_count = selectedNodes.length;
		var selectedLinks_count = selectedLinks.length;
/*
	 	//check if removing stuff really removed selected items
		console.log("beg removed selected items: "
			+ (highlightedNodes_count) + " "
			+ (highlightedLinks_count) + " "
			+ (selectedNodes_count) + " "
			+ (selectedLinks_count)
		);
*/
		highlightedNodes = highlightedNodes.filter(function(e) {
			return (intNodes.indexOf(e) !== -1);
		});

		highlightedLinks = highlightedLinks.filter(function(e) {
			return (intLinks.indexOf(e) !== -1);
		});

		selectedNodes = selectedNodes.filter(function(e) {
			return (intNodes.indexOf(e) !== -1);
		});

		selectedLinks = selectedLinks.filter(function(e) {
			return (intLinks.indexOf(e) !== -1);
		});
/*
		console.log("end removed selected items: "
			+ (highlightedNodes_count - highlightedNodes.length) + " "
			+ (highlightedLinks_count - highlightedLinks.length) + " "
			+ (selectedNodes_count - selectedNodes.length) + " "
			+ (selectedLinks_count - selectedLinks.length)
		);
*/
	}

	self.selectNode = function (node) {
		if (d3.event && (d3.event.ctrlKey || d3.event.metaKey)) {
			var i = selectedNodes.indexOf(node);
			if (i < 0) {
				selectedNodes.push(node);
			} else {
				selectedNodes.splice(i, 1);
			}
		} else {
			selectedNodes = [node];
			selectedLinks = [];
		}
	};

	self.selectLink = function (link) {
		if (d3.event && (d3.event.ctrlKey || d3.event.metaKey)) {
			var i = selectedLinks.indexOf(link);
			if (i < 0) {
				selectedLinks.push(link);
			} else {
				selectedLinks.splice(i, 1);
			}
		} else {
			selectedNodes = [];
			selectedLinks = [link];
		}
	};

	self.setTransform = function (newValue) {
		transform = newValue;
	};

	self.setMaxArea = function (newWidth, newHeight) {
		width = newWidth;
		height = newHeight;
	};

	return self;
}
