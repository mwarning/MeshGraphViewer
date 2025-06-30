
function createDraw(selection) {
    var self = {};

    var ctx;
    var width;
    var height;

    var transform;

    var selectedNodes = [];
    var selectedLinks = [];

    var linkScale = d3.interpolate('#F02311', '#04C714');

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
                ctx.fillStyle = 'white';
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

    self.drawLink = function (link) {
        let zero = transform.invert([0, 0]);
        let area = transform.invert([width, height]);
        if (
          (link.source.x < zero[0] && link.target.x < zero[0]) ||
          (link.source.y < zero[1] && link.target.y < zero[1]) ||
          (link.source.x > area[0] && link.target.x > area[0]) ||
          (link.source.y > area[1] && link.target.y > area[1])
        ) {
          return;
        }
        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        let to = [link.target.x, link.target.y];

        to = drawSelectedLink(link, to);

        ctx.lineCap = 'round';
        if ('color' in link.o) {
            ctx.strokeStyle = link.o.color;
        } else {
            // show link quality color gradient
            var grd = ctx.createLinearGradient(link.source.x, link.source.y, link.target.x, link.target.y);
            grd.addColorStop(0.45, linkScale(try_get(link.o, 'source_tq', 1.0)));
            grd.addColorStop(0.55, linkScale(try_get(link.o, 'target_tq', 1.0)));
            ctx.strokeStyle = grd;
        }

        ctx.lineTo(to[0], to[1]);
        ctx.strokeStyle = grd;

        /*
        if (link.o.type.indexOf("vpn") === 0) {
          ctx.globalAlpha = 0.2;
          ctx.lineWidth = 1.5;
        } else {
        */
          ctx.globalAlpha = 0.8;
          ctx.lineWidth = 2.5;
        //}

        ctx.stroke();
        ctx.globalAlpha = 1;

        const label = getLinkLabel(link.o);
        if (label !== undefined) {
            ctx.beginPath();
            ctx.textAlign = 'center';
            ctx.fillStyle = 'black';
            ctx.fillText(label, (link.source.x + to[0]) / 2, (link.source.y + to[1]) / 2 + 3);
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
