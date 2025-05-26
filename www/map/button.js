
function Button() {
    var self = {};

    var ButtonBase = L.Control.extend({
      options: {
        position: 'bottomright'
      },

      active: false,
      button: undefined,

      initialize: function (f, o) {
        L.Util.setOptions(this, o);
        this.f = f;
      },

      update: function () {
        this.button.classList.toggle('ion-locate-active', this.active);
      },

      set: function (v) {
        this.active = v;
        this.update();
      }
    });

    var CoordsPickerButton = ButtonBase.extend({
      doInit: function () {
        this.button = document.getElementsByClassName("ion-locate")[0];

        // Click propagation isn't disabled as this causes problems with the
        // location picking mode; instead propagation is stopped in onClick().
        L.DomEvent.disableClickPropagation(this.button);
        L.DomEvent.addListener(this.button, 'click', this.onClick, this);

      },

      onClick: function (e) {
        L.DomEvent.stopPropagation(e);
        this.f(!this.active);
      }
    });

    return function (map) {
      var userLocation;

      var showCoordsPickerButton = new CoordsPickerButton(function (d) {
        console.log("CoordsPickerButton " + d);
        if (d) {
          enableCoords();
        } else {
          disableCoords();
        }
      });

      function addButton() {
        showCoordsPickerButton.doInit();
        //showCoordsPickerButton.button.classList.remove("hidden");
      }

      self.clearButtons = function clearButtons() {
        //showCoordsPickerButton.button.classList.add("hidden");
      };

      function enableCoords() {
        map.getContainer().classList.add('pick-coordinates');
        map.on('click', showCoordinates);
        showCoordsPickerButton.set(true);
      }

      function disableCoords() {
        map.getContainer().classList.remove('pick-coordinates');
        map.off('click', showCoordinates);
        showCoordsPickerButton.set(false);
      }

      function showCoordinates(e) {
        alert(e.latlng.lat + ", " + e.latlng.lng);
        disableCoords();
      }

      self.locationFound = function locationFound(e) {
        if (!userLocation) {
          userLocation = new LocationMarker(e.latlng).addTo(map);
        }

        userLocation.setLatLng(e.latlng);
        userLocation.setAccuracy(e.accuracy);
      };

      self.locationError = function locationError() {
        if (userLocation) {
          map.removeLayer(userLocation);
          userLocation = null;
        }
      };

      self.init = function init() {
        addButton();
      };

      return self;
    };
}
