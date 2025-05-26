function createSidebar() {
	return function () {
		var self = this;

		// Needed to avoid render blocking
		var gridBreakpoints = {
			lg: [992, 446],
			xl: [1200, 560]
		};

		self.onClick = function onClick() {
			let sidebar = document.getElementsByClassName('sidebar')[0];
			var visibility = new CustomEvent('visibility');
			self.button.dispatchEvent(visibility);
			sidebar.classList.toggle('sidebar_hidden');
			self.container.classList.toggle('hidden');
		}

		self.getWidth = function getWidth() {
			let sidebar = document.getElementsByClassName('sidebar')[0];
			if (gridBreakpoints.lg[0] > window.innerWidth || sidebar.classList.contains('sidebar_hidden')) {
				return 0;
			} else if (gridBreakpoints.xl[0] > window.innerWidth) {
				return gridBreakpoints.lg[1];
			}
			return gridBreakpoints.xl[1];
		};

		self.sidebar = document.getElementsByClassName('sidebar')[0];
		self.button = document.getElementsByClassName('sidebarhandle')[0];
		self.container = document.getElementsByClassName('container')[0];

		return self;
	};
}
