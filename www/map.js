"use strict"

class Map {
	savedView
	nodeBounds
	map
	sidebar
	options
	nodeDict
	linkDict
	clientLayer
	labelLayer
	button
	linkScale
	el

	constructor(parent, selection, linkScale, sidebar, buttons) {
		var baseLayers = {};
		this.sidebar = sidebar;
		this.linkScale = linkScale;

		// add html
		this.el = document.createElement('div');
		this.el.classList.add('map');
		this.el.setAttribute('id', 'map');
		parent.appendChild(this.el);

		this.options = {
			worldCopyJump: true,
			zoomControl: true,
			minZoom: 0
		};

		this.map = L.map(this.el, this.options);
		this.mapActiveArea();

		var now = new Date();
		config.mapLayers.forEach(function (item, i) {
			if ((typeof item.config.start === 'number' && item.config.start <= now.getHours()) || (typeof item.config.end === 'number' && item.config.end > now.getHours())) {
				item.config.order = item.config.start * -1;
			} else {
				item.config.order = i;
			}
		});

		config.mapLayers = config.mapLayers.sort(function (a, b) {
			return a.config.order - b.config.order;
		});

		var layers = config.mapLayers.map(function (d) {
			return {
				'name': d.name,
				'layer': L.tileLayer(d.url.replace('{retina}', L.Browser.retina ? '@2x' : ''), d.config)
			};
		});

		this.map.addLayer(layers[0].layer);

		layers.forEach(function (d) {
			baseLayers[d.name] = d.layer;
		});

		this.button = new Button()(this.map, buttons);

		this.map.on('locationfound', this.button.locationFound);
		this.map.on('locationerror', this.button.locationError);
		this.map.on('dragend', this.saveView);
		this.map.on('contextmenu', Map.contextMenuOpenLayerMenu);

		if (config.geo) {
			[].forEach.call(config.geo, function (geo) {
				geo.json().then(function (result) {
					if (result) {
						L.geoJSON(result, geo.option).addTo(map);
					}
				});
			});
		}

		this.button.init();

		var layerControl = L.control.layers(baseLayers, [], { position: 'bottomright' });
		layerControl.addTo(this.map);

		this.map.zoomControl.setPosition('topright');

		var tmp1 = createClientLayer();
		this.clientLayer = new tmp1({ minZoom: config.clientZoom });
		this.clientLayer.addTo(this.map);
		this.clientLayer.setZIndex(5);

		var tmp2 = createLabelLayer();
		this.labelLayer = new tmp2({ minZoom: config.clientZoom });
		this.labelLayer.addTo(this.map);
		this.labelLayer.setZIndex(6);

		var sidebar_button = document.getElementsByClassName('sidebarhandle')[0];
		/*sidebar.button*/ sidebar_button.addEventListener('visibility', this.setActiveArea);

		var self = this;
		this.map.on('zoom', function () {
			self.clientLayer.redraw();
			self.labelLayer.redraw();
		});

		this.map.on('baselayerchange', function (e) {
			self.map.options.maxZoom = e.layer.options.maxZoom;
			self.clientLayer.options.maxZoom = self.map.options.maxZoom;
			self.labelLayer.options.maxZoom = self.map.options.maxZoom;
			if (self.map.getZoom() > self.map.options.maxZoom) {
				self.map.setZoom(self.map.options.maxZoom);
			}
		});

		this.map.on('load', function () {
			var inputs = document.querySelectorAll('.leaflet-control-layers-selector');
			[].forEach.call(inputs, function (input) {
				input.setAttribute('role', 'radiogroup');
				input.setAttribute('title', input.nextSibling.innerHTML.trim());
			});
		});

		this.nodeDict = {};
		this.linkDict = {};
	}

	saveView() {
		var self = this;
		savedView = {
			center: self.map.getCenter(),
			zoom: self.map.getZoom()
		};
	}

	static contextMenuOpenLayerMenu() {
		document.querySelector('.leaflet-control-layers').classList.add('leaflet-control-layers-expanded');
	}

	mapActiveArea() {
		this.map.setActiveArea({
			position: 'absolute',
			left: this.sidebar.getWidth() + 'px',
			right: 0,
			top: 0,
			bottom: 0
		});
	}

	setActiveArea() {
		setTimeout(this.mapActiveArea, 300);
	}

	resetMarkerStyles() {
		Object.keys(this.nodeDict).forEach(function (id) {
			if (selection.isSelectedNode(id)) {
				this.nodeDict[id].setStyle(config.map_selectedNode);
			} else {
				this.nodeDict[id].resetStyle();
			}
		});

		Object.keys(this.linkDict).forEach(function (id) {
			if (selection.isSelectedLink(id.replace("-", ","))) {
				linkDict[id].setStyle(config.map_selectedLink);
			} else {
				linkDict[id].resetStyle();
			}
		});
	}

	setView(bounds, zoom) {
		this.map.fitBounds(bounds, { maxZoom: (zoom ? zoom : config.nodeZoom) });
	}

	goto(m) {
		var bounds;

		if ('getBounds' in m) {
			bounds = m.getBounds();
		} else {
			bounds = L.latLngBounds([m.getLatLng()]);
		}

		setView(bounds);

		return m;
	}

	static getNodeBounds(nodes) {
		var min_x = Number.POSITIVE_INFINITY;
		var max_x = Number.NEGATIVE_INFINITY;
		var min_y = Number.POSITIVE_INFINITY;
		var max_y = Number.NEGATIVE_INFINITY;

		nodes.forEach(function (d) {
			if (d.x < min_x) {
				min_x = d.x;
			}
			if (d.x > max_x) {
				max_x = d.x;
			}
			if (d.y < min_y) {
				min_y = d.y;
			}
			if (d.y > max_y) {
				max_y = d.y;
			}
		});

		if (nodes.length) {
			return [[min_x, min_y], [max_x, max_y]];
		} else {
			return [[5.0, 5.0], [0.0, 0.0]];
		}
	}

	updateView(nopanzoom) {
		this.resetMarkerStyles();

		/*
		if (highlight !== undefined) {
			if (highlight.type === 'node' && nodeDict[highlight.o.node_id]) {
				m = nodeDict[highlight.o.node_id];
				m.setStyle(config.map.highlightNode);
			} else if (highlight.type === 'link' && linkDict[highlight.o.id]) {
				m = linkDict[highlight.o.id];
				m.setStyle(config.map.highlightLink);
			}
		}
		*/

		if (!nopanzoom) {
			if (this.savedView) {
				this.map.setView(this.savedView.center, this.savedView.zoom);
			} else if (this.nodeBounds) {
				this.setView(this.nodeBounds);
			} else {
				this.setView([[5.0, 5.0], [0.0, 0.0]]);
			}
		}
	}

	setData(data) {
		{
			// some preprocessing
			var nodes = [];
			var links = [];
			this.nodeDict = {};
			var self = this;

			data.nodes.forEach(function (d) {
				if (Math.abs(d.x) < 90 && Math.abs(d.y) < 180) {
					if (config.useIdsAsName && !('name' in d)) {
						d.name = '' + d.id;
					}
					var node = {o: d, x: d.x, y: d.y};
					self.nodeDict['' + d.id] = node;
					nodes.push(node);
				}
			});

			data.links.forEach(function (d) {
				var source = self.nodeDict['' + d.source];
				var target = self.nodeDict['' + d.target];
				if (source && target) {
					var link = {o: d, source: source, target: target};
					link.id = [link.source.o.id, link.target.o.id].join('-');
					links.push(link);
				}
			});

			data = {nodes: nodes, links: links};
		}

		this.nodeDict = {};
		this.linkDict = {};

		this.nodeBounds = Map.getNodeBounds(nodes);
		this.clientLayer.setData(data);
		this.labelLayer.setData(data, this.map, this.linkScale);

		this.updateView(true);
	}

	resetView() {
		this.updateView();
	}

	gotoLocation(d) {
		this.map.setView([d.lat, d.lng], d.zoom);
	}

	destroy() {
		this.button.clearButtons();
		var sidebar_button = document.getElementsByClassName('sidebarhandle')[0];
		/*sidebar.button*/sidebar_button.removeEventListener('visibility', this.setActiveArea);
		this.map.remove();

		if (this.el.parentNode) {
			this.el.parentNode.removeChild(this.el);
		}
	}

	render(d) {
		d.appendChild(this.el);
		this.map.invalidateSize();
	}
}
