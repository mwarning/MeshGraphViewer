
function createDraw(selection) {
    var self = {};

    var ctx;
    var width;
    var height;

    var transform;

    var selectedNodes = [];
    var selectedLinks = [];

    var linkScale = d3.interpolate('#F02311', '#04C714');
    var bandwidthWidthScale = d3.interpolateNumber(1.0, 3.0);
    var bandwidthAlphaScale = d3.interpolateNumber(0.1, 0.8);

    var NODE_RADIUS = 15;
    var LINE_RADIUS = 12;

    function drawDetailNode(d) {
        if (transform.k > 1) {
            const clients = getNodeClients(d.o);
            if (clients !== undefined) {
                ctx.beginPath();
                ctx.fillStyle = config.graph_clientColor;
                positionClients(ctx, d, Math.PI, clients, 15);
                ctx.fill();
            }

            const name = getNodeName(d.o);
            if (name !== undefined) {
                ctx.beginPath();
                ctx.textAlign = 'center';
                ctx.fillStyle = config.graph_defaultNodeColor
                ctx.fillText(name, d.x, d.y + 20);
            }

            const label = getNodeLabel(d.o);
            if (label !== undefined) {
                ctx.beginPath();
                ctx.textAlign = 'center';
                ctx.fillStyle = 'black';
                ctx.fillText(d.o.label, d.x, d.y + 3.5);
            }
        }
    }

    function drawSelectedNode(d) {
        const id = getNodeId(d.o);
        if (selection.isNodeSelected(id)) {
            ctx.arc(d.x, d.y, NODE_RADIUS * 1.5, 0, 2 * Math.PI);
            ctx.fillStyle = config.graph_selectColor;
            ctx.fill();
            ctx.beginPath();
        }
    }

    function drawSelectedLink(d, to) {
        const source_id = getNodeId(d.source.o);
        const target_id = getNodeId(d.target.o);
        if (selection.isLinkSelected(source_id, target_id)) {
            ctx.lineTo(to[0], to[1]);
            ctx.strokeStyle = config.graph_selectColor;
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

        const color = try_get(d.o, 'color', config.graph_defaultNodeColor);
        const radius = try_get(d.o, 'radius', 7);

        ctx.arc(d.x, d.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        drawDetailNode(d);
    };

    self.drawLink = function (d) {
        const zero = transform.invert([0, 0]);
        const area = transform.invert([width, height]);
        if (d.source.x < zero[0] && d.target.x < zero[0] || d.source.y < zero[1] && d.target.y < zero[1] ||
                d.source.x > area[0] && d.target.x > area[0] || d.source.y > area[1] && d.target.y > area[1]) {
            return;
        }
        ctx.beginPath();
        ctx.moveTo(d.source.x, d.source.y);

        const to = drawSelectedLink(d, [d.target.x, d.target.y]);

        ctx.lineCap = 'round';
        if ('color' in d.o) {
            ctx.strokeStyle = d.o.color;
        } else {
            // show link quality color gradient
            var grd = ctx.createLinearGradient(d.source.x, d.source.y, d.target.x, d.target.y);
            grd.addColorStop(0.45, linkScale(try_get(d.o, 'source_tq', 1.0)));
            grd.addColorStop(0.55, linkScale(try_get(d.o, 'target_tq', 1.0)));
            ctx.strokeStyle = grd;
        }

        ctx.lineTo(to[0], to[1]);
        ctx.lineWidth = bandwidthWidthScale(1.0);
        ctx.globalAlpha = bandwidthAlphaScale(1.0);

        ctx.stroke();
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 2.5;

        const label = getLinkLabel(d.o);
        if (label !== undefined) {
            ctx.beginPath();
            ctx.textAlign = 'center';
            ctx.fillStyle = 'black';
            ctx.fillText(label, (d.source.x + to[0]) / 2, (d.source.y + to[1]) / 2 + 3);
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
