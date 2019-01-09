
function createSim(graph, chart) {
	var self = {};

	// Keep track of setTimeout id
	self.timerId = null;

	self.reset = function() {
		send("/cmd/reset", {}, function() {
			self.updateStats();
			globalUpdateNodes();
		});
	}

	function waitForFinish(wait, again) {
		send("/cmd/state", {}, function(data) {
			var json = JSON.parse(data);
			if (json.state == "Waiting") {
				self.updateStats();
				globalUpdateNodes();
			} else if (again) {
				// increase waiting time
				if (wait < 5000) {
					wait *= 2;
				}
				setTimeout(waitForFinish, wait, wait, again);
			}
		});
	}

	function run(steps, delay) {
		if (steps > 0) {
			send("/cmd/start", {steps: steps}, function() {
				waitForFinish(10, !delay);
			});

			if (delay) {
				self.timerId = setTimeout(steps - 1, delay);
			}
		}
	}

	self.toggleRun = function (steps, delay) {
		// Toggle simulation Start/Stop button label
		//function set_toggle_label(value) {
		//	$('sim_toggle').value = value;
		//}
console.log("toggleRun(" + steps + ", " + delay + ")");

		if (self.timerId) {
			console.log("timerId was set");
			clearTimeout(self.timerId);
			self.timerId = null;
			return;
		}

		run(steps, delay);
	}

	self.setAlgorithm = function(algorithm) {
		send('/cmd/set_algorithm', {name: algorithm}, function(data) {
			globalUpdate();
		});
	}

	self.getAlgorithm = function() {
		send('/cmd/get_algorithm', {}, function(data) {
			var json = JSON.parse(data);
			$$('algo_name').nodeValue = json.name;
			$$('algo_description').nodeValue = json.description;
			$('algorithm').value = json.id;
		});
	}

	self.updateStats = function () {
		graph.clear();

		$$('test_num').nodeValue = "-"
		$$('test_packet_costs').nodeValue = "-";
		$$('comm_packet_costs').nodeValue = "-";
		$$('deployed_test_packets').nodeValue = "-";
		$$('received_test_packets').nodeValue = "-";
		$$('stepnums').nodeValue = "-";
		$$('test_count').nodeValue = "-";


		send('/cmd/stats', {}, function(data) {
			console.log(data);
			var json = JSON.parse(data);
			var results = json.results;
			var tests = json.tests;

			function num(v, suffix = '') {
				if (isNaN(v)) return '-';
				if (v === 100) return "100" + suffix;
				return (v.toFixed(1) + suffix);
			}

			$$('sim_steps_total').nodeValue = json.steps;
			$$('sim_duration_total').nodeValue = json.duration + " ms";
			console.log("steps: " + json.steps);

			if (tests && tests.length) {
				if (tests.length) {
					var test = tests[tests.length - 1];
					//how to handle multiple results?
					$$('test_num').nodeValue = test.num;
					$$('test_packet_costs').nodeValue = num(test.test_packet_costs / test.deployed_test_packets, ' / packet');
					$$('comm_packet_costs').nodeValue = test.comm_packet_costs;
					$$('deployed_test_packets').nodeValue = test.deployed_test_packets;
					$$('received_test_packets').nodeValue = test.received_test_packets + " (" + num(100 * test.received_test_packets / test.deployed_test_packets, '%)');
					$$('stepnums').nodeValue = test.stepnums;
				}
				$$('test_count').nodeValue = tests.length;
			}

			chart.clear();
			if (results) {
				for (var i in results) {
					var r = results[i];
					//console.log("add data point " + r.v + " " + r.e);
					graph.addDataPoint(r.i, r.v, r.e);
				}
			}
		});
	}

	return self;
}
