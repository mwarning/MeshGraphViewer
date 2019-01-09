
function createChart(chart_id) {
	var self = this;
	var el = document.getElementById(chart_id);
	var data = [];




var counter = 0;
function addPoint2() {
	counter += 1;
	data.push({
		x: counter + 1,
		// generate a random value between 40 and 60
		y: d3.randomUniform(40, 60)(),
		// generate a random interval between 1 and 5
		e: d3.randomUniform(1, 5)()
	});
}

// init data
d3.range(40).map(function(i) {
	addPoint2();
});

	console.log('el.offsetwidth: ' + el.offsetWidth + ', el.offsetHeight: '+ el.offsetHeight);

	// Set the dimensions of the canvas / graph
	var margin = {top: 5, right: 0, bottom: 30, left: 30};
	var width = 300 - margin.left - margin.right;
	var height = 300 - margin.top - margin.bottom;

	var svg = d3.select(el).append('svg').attr('width', width).attr('height', height);
	var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

	svg.onresize = function() {
		console.log('resize: el.offsetwidth: ' + el.offsetWidth + ', el.offsetHeight: '+ el.offsetHeight);
	}

	var xScale = d3.scaleLinear()
		.range([0, width])
		.domain(d3.extent(data, function(d) { return d.x; }));

	var yScale = d3.scaleLinear()
		.range([height, 0])
		.domain([0, d3.max(data, function(d) { return d.y; })]);

	// Define the line
	var valueline = d3.line()
		.x(function(d) { return xScale(d.x); })
		.y(function(d) { return yScale(d.y); });

	// Define the axes
	var xAxis = d3.axisBottom().scale(xScale)
		.ticks(5);

	var yAxis = d3.axisLeft().scale(yScale)
		.ticks(5);

	// Add the X Axis
	g.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + height + ")")
		.call(xAxis);

	// Add the Y Axis
	g.append("g")
		.attr("class", "y axis")
		.call(yAxis);

	self.update = function () {
		//console.log('update: ' + data.length);

		xScale.domain(d3.extent(data, function(d) { return d.x; }));
		yScale.domain([0, d3.max(data, function(d) { return d.y; })]);

		var points = g.selectAll('path.line')
			.data(data);

		points.enter()
			.append("path")
			.attr("class", "line")
		.merge( points )
			.attr("d", valueline(data));

		points.exit().remove();

		var lines = g.selectAll('line.error-line')
			.data(data);

		lines.enter()
			.append('line')
			.attr('class', 'error-line')
		.merge(lines)
			.attr('x1', function(d) { return xScale(d.x); })
			.attr('x2', function(d) { return xScale(d.x); })
			.attr('y1', function(d) { return yScale(d.y + d.e); })
			.attr('y2', function(d) { return yScale(d.y - d.e); });

		lines.exit().remove();

		// Add Error Top Cap
		var topcap = g.selectAll('line.error-cap-top')
			.data(data.filter(d => typeof(d.e) === 'number' && !isNaN(d.e)));

		topcap.enter()
			.append('line')
			.attr('class', 'error-cap-top')
		.merge(topcap)
			.attr("x1", function(d) { return xScale(d.x) - 4; })
			.attr("y1", function(d) { return yScale(d.y + d.e); })
			.attr("x2", function(d) { return xScale(d.x) + 4; })
			.attr("y2", function(d) { return yScale(d.y + d.e); });

		topcap.exit().remove();

		// Add Error Bottom Cap
		var bottomcap = g.selectAll('line.error-cap-bottom')
			.data(data.filter(d => typeof(d.e) === 'number' && !isNaN(d.e)));

		bottomcap.enter()
			.append('line')
			.attr('class', 'error-cap-bottom')
		.merge(bottomcap)
			.attr("x1", function(d) { return xScale(d.x) - 4; })
			.attr("y1", function(d) { return yScale(d.y - d.e); })
			.attr("x2", function(d) { return xScale(d.x) + 4; })
			.attr("y2", function(d) { return yScale(d.y - d.e); });

		bottomcap.exit().remove();

		// Change X Axis
		g.select(".x.axis")
			.call(xAxis);

		// Change Y Axis
		g.select(".y.axis")
			.call(yAxis);
	};

	self.clear = function () {
		data = [];
		self.update();
	};

	self.addDataPoint = function(x, y, error) {
		data.push({x: x, y: y, e: (error ? error : null)});
		self.update();
	};

	// Export chart data
	d3.select(el)
		.on('click', function () {
console.log('el.offsetwidth: ' + el.offsetWidth + ', el.offsetHeight: '+ el.offsetHeight);
return;
			var has_error = data.length && (typeof data[0] === 'number');
			var header = has_error ? 'x\ty\terror\n' : 'x\ty\n';
			var content = data.reduce((s, e) => s + '\n' + Object.values(e).join('\t'), header);

			var a = document.createElement('a');
			a.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
			a.setAttribute('download', "data.tsv");

			a.style.display = 'none';
			document.body.appendChild(a);

			a.click();
			document.body.removeChild(a);
		}
	);

	// Init chart
	self.update();

	return self;
}
