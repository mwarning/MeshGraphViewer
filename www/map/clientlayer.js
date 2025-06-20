
function createClientLayer() {
    function getTileBBox(s, map, tileSize, margin) {
        const tl = map.unproject([s.x - margin, s.y - margin]);
        const br = map.unproject([s.x + margin + tileSize, s.y + margin + tileSize]);

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
            const rtreeOnlineAll = rbush(9);

            this.data = rtreeOnlineAll.load(data.nodes.map(this.mapRTree));

            // pre-calculate start angles
            //this.data.all().forEach(function (n) {
            //    n.startAngle = (parseInt(n.node.id.substr(10, 2), 16) / 255) * 2 * Math.PI;
            //});
            this.redraw();
        },
        createTile: function (tilePoint) {
            const tile = L.DomUtil.create('canvas', 'leaflet-tile');

            const tileSize = this.options.tileSize;
            tile.width = tileSize;
            tile.height = tileSize;

            if (!this.data) {
                return tile;
            }

            const ctx = tile.getContext('2d');
            const s = tilePoint.multiplyBy(tileSize);
            const map = this._map;

            const margin = 50;
            const bbox = getTileBBox(s, map, tileSize, margin);

            //TODO: let's try this to remove rbush.js dependency
            //var nodes = this.data.nodes.filter(function(d) {
            //    d.x >= bbox.minX && d.x <= bbox.maxX &&
            //    d.y >= bbox.minY && d.y <= bbox.maxY;
            //});

            let nodes = this.data.search(bbox);

            if (nodes.length === 0) {
                return tile;
            }

            const startDistance = 15;

            nodes.forEach(function (d) {
                var p = map.project([d.node.x, d.node.y]);

                p.x -= s.x;
                p.y -= s.y;

                if (('clients' in d.node.o) && d.node.o.clients > 0) {
                    ctx.beginPath();
                    ctx.fillStyle = "#dc0067";
                    positionClients(ctx, p, Math.PI, d.node.o.clients, startDistance);
                    ctx.fill();
                }
            });

            return tile;
        }
    });
}
