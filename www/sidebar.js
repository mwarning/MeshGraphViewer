function createSidebar() {
  return function (/*el*/) {
    var self = this;

    // Needed to avoid render blocking
    var gridBreakpoints = {
      lg: [992, 446],
      xl: [1200, 560]
    };

    self.onClick = function onClick() {
      var visibility = new CustomEvent('visibility');
      self.button.dispatchEvent(visibility);
      self.container.classList.toggle('hidden');
    }

    self.getWidth = function getWidth() {
      if (gridBreakpoints.lg[0] > window.innerWidth || self.container.classList.contains('hidden')) {
        return 0;
      } else if (gridBreakpoints.xl[0] > window.innerWidth) {
        return gridBreakpoints.lg[1];
      }
      return gridBreakpoints.xl[1];
    };

    self.container = document.getElementsByClassName('sidebar')[0];
    self.button = document.getElementsByClassName('sidebarhandle')[0];

    return self;
  };
}
