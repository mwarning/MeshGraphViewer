
function createDraw(selection) {
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

	function drawHighlightedNode(d) {
		if (selection.isHighlightedNode(d.o.id)) {
			ctx.arc(d.x, d.y, NODE_RADIUS * 1.5, 0, 2 * Math.PI);
			ctx.fillStyle = highlightColor;
			ctx.fill();
			ctx.beginPath();
		}
	}

	function drawSelectedNode(d) {
		if (selection.isSelectedNode(d.o.id)) {
			ctx.arc(d.x, d.y, NODE_RADIUS * 1.5, 0, 2 * Math.PI);
			ctx.fillStyle = selectColor;
			ctx.fill();
			ctx.beginPath();
		}
	}

	function drawHighlightedLink(d, to) {
		if (selection.isHighlightedLink(d.source.o.id + "," + d.target.o.id)) {
			ctx.lineTo(to[0], to[1]);
			ctx.strokeStyle = highlightColor;
			ctx.lineWidth = LINE_RADIUS * 2;
			ctx.lineCap = 'round';
			ctx.stroke();
			to = [d.source.x, d.source.y];
		}
		return to;
	}

	function drawSelectedLink(d, to) {
		if (selection.isSelectedLink(d.source.o.id + "," + d.target.o.id)) {
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
		drawHighlightedNode(d);

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

		to = drawSelectedLink(d, to);
		to = drawHighlightedLink(d, to);

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

	self.setTransform = function (newValue) {
		transform = newValue;
	};

	self.setMaxArea = function (newWidth, newHeight) {
		width = newWidth;
		height = newHeight;
	};

	return self;
}
