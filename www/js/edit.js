
function createEdit(graph) {
	var self = {};
/*
	self.addNodes = function (count) {
		send('/cmd/call', {cmd: "add_nodes", count: count}, globalUpdate);
	}

	self.addLine = function (count, close) {
		send('/cmd/add_line', {count: count, close: close}, globalUpdate);
	}

	self.addStar = function (count) {
		send('/cmd/add_star', {count: count}, globalUpdate);
	}

	// Add lattice with horizontal and vertical neighbors
	self.addLattice4 = function (x_count, y_count) {
		send('/cmd/add_lattice4', {x_count: x_count, y_count: y_count}, globalUpdate);
	}

	// Add lattice with horizontal, vertical and diagonal neighbors
	self.addLattice8 = function (x_count, y_count) {
		send('/cmd/add_lattice8', {x_count: x_count, y_count: y_count}, globalUpdate);
	}

	// Add randomized tree network with extra connections
	self.addTree = function (count, intra = 0) {
		send('/cmd/add_tree', {count: count, intra: intra}, globalUpdate);
	}
*/


	self.removeUnconnected = function () {
		send('/cmd/remove_unconnected', {}, globalUpdate);
	}

	self.setLinkParameters = function (bandwidth_id, quality_id, quality_generation_id, channel_id) {
		var intLinks = graph.getSelectedIntLinks();
		var quality_generation = getText(quality_generation_id);
		var quality = getFloat(quality_id);
		var bandwidth = getFloat(bandwidth_id);
		var channel = getInt(channel_id);

		intLinks.forEach(function(e) {
			if (quality_generation == 'random') {
				e.o.quality = Math.random();
			} else {
				e.o.quality = quality;
			}
			e.o.bandwidth = bandwidth;
			e.o.channel = channel;
		});

		graph.redraw();
	}

	self.getLinkParameters = function (bandwidth_id, quality_id, channel_id) {
		var intLinks = graph.getSelectedIntLinks();

		if (intLinks.length > 0) {
			var link = intLinks[intLinks.length - 1].o;
			$(bandwidth_id).value = link.bandwidth;
			$(quality_id).value = link.quality;
			$(quality_id).value = link.channel;
		} else {
			alert('Select at least one link.');
		}
	}


	self.connectInRange = function (range) {
		send('/cmd/connect_in_range', {range: range}, globalUpdate);
	}

	self.randomizePositions = function (range) {
		send('/cmd/randomize_positions', {range: range}, globalUpdate);
	}

	return self;
}
