
function createClientLayer() {
	function hasLocation(d) {
		return Math.abs(d.x) < 90 &&
			Math.abs(d.y) < 180;
	}

	function getTileBBox(s, map, tileSize, margin) {
		var tl = map.unproject([s.x - margin, s.y - margin]);
		var br = map.unproject([s.x + margin + tileSize, s.y + margin + tileSize]);

		return { minX: br.lat, minY: tl.lng, maxX: tl.lat, maxY: br.lng };
	}

	return L.GridLayer.extend({
		mapRTree: function mapRTree(d) {
			return {
				minX: d.x, minY: d.y,
				maxX: d.x, maxY: d.y,
				node: d
			};
		},
		setData: function (data) {
			var rtreeOnlineAll = rbush(9);

			this.data = rtreeOnlineAll.load(data.nodes.filter(/*helper.*/hasLocation).map(this.mapRTree));

			// pre-calculate start angles
			//this.data.all().forEach(function (n) {
			//	n.startAngle = (parseInt(n.node.id.substr(10, 2), 16) / 255) * 2 * Math.PI;
			//});
			this.redraw();
		},
		createTile: function (tilePoint) {
			var tile = L.DomUtil.create('canvas', 'leaflet-tile');

			var tileSize = this.options.tileSize;
			tile.width = tileSize;
			tile.height = tileSize;

			if (!this.data) {
				return tile;
			}

			var ctx = tile.getContext('2d');
			var s = tilePoint.multiplyBy(tileSize);
			var map = this._map;

			var margin = 50;
			var bbox = /*helper.*/ getTileBBox(s, map, tileSize, margin);

			//TODO: let's try this to remove rbush.js dependency
			//var nodes = this.data.nodes.filter(function(d) {
			//	d.x >= bbox.minX && d.x <= bbox.maxX &&
			//	d.y >= bbox.minY && d.y <= bbox.maxY;
			//});

			var nodes = this.data.search(bbox);

			if (nodes.length === 0) {
				return tile;
			}

			var startDistance = 10;

			nodes.forEach(function (d) {
				var p = map.project([d.node.x, d.node.y]);

				p.x -= s.x;
				p.y -= s.y;

				if (('clients' in d.node.o) && d.node.o.clients > 0) {
					ctx.beginPath();
					ctx.fillStyle = "#dc0067";
					positionClients(ctx, p, Math.random() * 2 * Math.PI, d.node.o.clients, startDistance);
					ctx.fill();
				}
			});

			return tile;
		}
	});
}