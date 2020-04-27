
function createGraph(parent, selection, sidebar) {
	var draw = createDraw(selection);
	var d3Interpolate = d3;
	var d3Zoom = d3;
	var d3Force = d3;
	var d3Drag = d3;
	var d3Selection = d3;
	var d3Timer = d3;
	var d3Ease = d3;
	var animationEnabled = true;

	// add html
	var el = document.createElement('div');
	el.classList.add('graph');
	el.setAttribute('id', 'graph');
	parent.appendChild(el);

	var self = this;
	var lastClick = [0, 0];
	var canvas;
	var ctx;
	var force;
	var forceLink;

	var transform = d3Zoom.zoomIdentity;
	var intNodes = [];
	var intLinks = [];
	var movetoTimer;

	var NODE_RADIUS_DRAG = 10;
	var NODE_RADIUS_SELECT = 15;
	var LINK_RADIUS_SELECT = 12;
	var ZOOM_ANIMATE_DURATION = 350;

	var ZOOM_MIN = 1 / 8;
	var ZOOM_MAX = 3;

	var FORCE_ALPHA = 0.3;

	draw.setTransform(transform);

	function distanceLink(p, a, b) {
		function distance(a, b) {
			return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
		};

		function distancePoint(a, b) {
			return Math.sqrt(distance(a, b));
		};

		/* http://stackoverflow.com/questions/849211 */
		var l2 = distance(a, b);
		if (l2 === 0) {
			return distance(p, a);
		}
		var t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
		if (t < 0) {
			return distance(p, a);
		} else if (t > 1) {
			return distance(p, b);
		}
		return distancePoint(p, {
			x: a.x + t * (b.x - a.x),
			y: a.y + t * (b.y - a.y)
		});
	};

	function resizeCanvas() {
		canvas.width = el.offsetWidth;
		canvas.height = el.offsetHeight;
		draw.setMaxArea(canvas.width, canvas.height);
	}

	function transformPosition(p) {
		transform.x = p.x;
		transform.y = p.y;
		transform.k = p.k;
	}

	function moveTo(pos, forceMove) {
		clearTimeout(movetoTimer);
		if (!forceMove && force.alpha() > 0.3) {
			movetoTimer = setTimeout(function timerOfMoveTo() {
				moveTo(pos);
			}, 300);
			return;
		}

		var x = pos[0];
		var y = pos[1];
		var k = pos[2];
		var end = { k: k };

		end.x = (canvas.width + sidebar.getWidth()) / 2 - x * k;
		end.y = canvas.height / 2 - y * k;

		var start = { x: transform.x, y: transform.y, k: transform.k };
		var interpolate = d3Interpolate.interpolateObject(start, end);

		var timer = d3Timer.timer(function (t) {
			if (t >= ZOOM_ANIMATE_DURATION) {
				timer.stop();
				return;
			}

			var v = interpolate(d3Ease.easeQuadInOut(t / ZOOM_ANIMATE_DURATION));
			transformPosition(v);
			window.requestAnimationFrame(redraw);
		});
	}

	function onClick() {
		if (d3Selection.event.defaultPrevented) {
			return;
		}

		var e = transform.invert(d3.mouse(this));
		var n = force.find(e[0], e[1], NODE_RADIUS_SELECT);

		// Remember last click position
		lastClick = e;

		if (n !== undefined) {
			selectNode(n);
			return;
		}

		e = { x: e[0], y: e[1] };

		var closedLink;
		var radius = LINK_RADIUS_SELECT;
		intLinks.forEach(function (d) {
			var distance = distanceLink(e, d.source, d.target);
			if (distance < radius) {
				closedLink = d;
				radius = distance;
			}
		});

		if (closedLink !== undefined) {
			selectLink(closedLink);
		}
	}

	self.redraw = function () {
		ctx.save();
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.translate(transform.x, transform.y);
		ctx.scale(transform.k, transform.k);

		intLinks.forEach(draw.drawLink);
		intNodes.forEach(draw.drawNode);

		ctx.restore();
	}

	forceLink = d3Force.forceLink()
		.distance(function (d) {
			if (d.target_tr > 0.5) {
				return 0;
			}
			return 75;
		})
		.strength(function (d) {
			if (d.target_tr > 0.5) {
				return 0.02;
			}

			return limitFloat(1 / d.target_tq, 0.5, 1);
		});

	var zoom = d3Zoom.zoom()
		.scaleExtent([ZOOM_MIN, ZOOM_MAX])
		.on('zoom', function () {
			transform = d3Selection.event.transform;
			draw.setTransform(transform);
			redraw();
		});

	force = d3Force.forceSimulation()
		.force('link', forceLink)
		.force('charge', d3Force.forceManyBody())
		.force('x', d3Force.forceX().strength(0.02))
		.force('y', d3Force.forceY().strength(0.02))
		.force('collide', d3Force.forceCollide())
		.on('tick', redraw)
		.alphaDecay(0.015);

	var drag = d3Drag.drag()
		.subject(function () {
			var e = transform.invert([d3Selection.event.x, d3Selection.event.y]);
			var n = force.find(e[0], e[1], NODE_RADIUS_DRAG);

			if (n !== undefined) {
				n.x = d3Selection.event.x;
				n.y = d3Selection.event.y;
				return n;
			}
			return undefined;
		})
		.on('start', function () {
			if (!d3Selection.event.active) {
				force.alphaTarget(FORCE_ALPHA).restart();
			}
			d3Selection.event.subject.fx = transform.invertX(d3Selection.event.subject.x);
			d3Selection.event.subject.fy = transform.invertY(d3Selection.event.subject.y);
		})
		.on('drag', function () {
			d3Selection.event.subject.fx = transform.invertX(d3Selection.event.x);
			d3Selection.event.subject.fy = transform.invertY(d3Selection.event.y);
		})
		.on('end', function () {
			if (!d3Selection.event.active) {
				force.alphaTarget(0);
			}
			d3Selection.event.subject.fx = null;
			d3Selection.event.subject.fy = null;
		});

	canvas = d3Selection.select(el)
		.append('canvas')
		.on('click', onClick)
		.call(drag)
		.call(zoom)
		.node();

	ctx = canvas.getContext('2d');
	draw.setCTX(ctx);

	window.addEventListener('resize', function () {
		resizeCanvas();
		redraw();
	});

	// Create a bidirectional link identifier
	function linkId(source, target) {
		var sid = '' + source.id;
		var tid = '' + target.id;
		return (sid > tid) ? (tid + '=>' + sid) : (sid + '=>' + tid);
	}

	function nodeId(n) {
		return '' + n.o.id;
	}

	/* Update graph
	* d3.js uses memebers x, y and index for own purposes.
	* x and y may initialized with starting positions.
	*/
	self.setData = function (data, is_update = false) {
		// For fast node/link lookup
		var nodeDict = {};
		var linkDict = {};

		if (is_update) {
			// Keep existing data
			var dnodes = {};
			data.nodes.forEach(function (e) {
				dnodes['' + e.id] = e;
			});
			intNodes.forEach(function (e) {
				if (nodeId(e) in dnodes) {
					nodeDict[nodeId(e)] = e;
				}
			});
		}

		intNodes = [];
		intLinks = [];

		// New nodes center
		var mx = data.nodes.reduce(function(acc, e) { return acc + e.x; }, 0) / data.nodes.length;
		var my = data.nodes.reduce(function(acc, e) { return acc + e.y; }, 0) / data.nodes.length;

		// Center new nodes at last click location
		var px = lastClick[0] - mx;
		var py = lastClick[1] - my;

		function addNode(node) {
			var id = '' + node.id;
			if (id in nodeDict) {
				var n = nodeDict[id];
				// Update existing node (keep position)
				n.o = node;
				intNodes.push(n);
				return n;
			} else {
				var n = {};
				nodeDict[id] = n;
				// intialize node position with center offset + geo position
				n.x = node.x + px;
				n.y = node.y + py;
				n.o = node;
				intNodes.push(n);
				return n;
			}
		}

		function addLink(link) {
			var sid = '' + link.source;
			var tid = '' + link.target;

			if (!(sid in nodeDict)) {
				addNode({'id': sid});
			}

			if (!(tid in nodeDict)) {
				addNode({'id': tid});
			}

			var source = nodeDict[sid];
			var target = nodeDict[tid];
			var id = linkId(source.o, target.o);

			if (id in linkDict) {
				var l = linkDict[id];
				// Update existing link
				l.o = link;
				intLinks.push(l);
			} else {
				var l = {};
				linkDict[id] = l;
				l.source = source;
				l.target = target;
				l.o = link;
				intLinks.push(l);
			}
		}

		data.nodes.map(addNode);
		data.links.map(addLink);

		force.nodes(intNodes);
		forceLink.links(intLinks);

		force.alpha(1).restart();
		redraw();
	}

	self.toggleAnimation = function toggleAnimation() {
		// Note: Animation will restart on drag/click etc.
		if (animationEnabled) {
			force.stop();
		} else {
			force.alpha(1).restart();
		}
		animationEnabled = !animationEnabled;
	}

	self.resetView = function () {
		moveTo([0, 0, (ZOOM_MIN + 1) / 2], true);
	};

	function selectNode (node) {
		// Focus node if no ctrl key pressed
		selection.selectNode(node.o);

		if (!selection.isMetaPressed()) {
			moveTo([node.x, node.y, (ZOOM_MAX + 1) / 2]);
		}
	};

	function selectLink (link) {
		// Focus link if no ctrl key pressed
		selection.selectLink(link.o);

		if (!selection.isMetaPressed()) {
			moveTo([(link.source.x + link.target.x) / 2, (link.source.y + link.target.y) / 2, (ZOOM_MAX / 2) + ZOOM_MIN]);
		}
	};

	self.destroy = function destroy() {
		force.stop();
		canvas.parentNode.removeChild(canvas);
		force = null;

		if (el.parentNode) {
			el.parentNode.removeChild(el);
		}
	};

	resizeCanvas();
	resetView();

	return self;
}
