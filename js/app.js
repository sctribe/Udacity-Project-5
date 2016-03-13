// markers class contains information of map markers for searching.
var markers = function(marker, name, category, position) {
  this.marker = marker,
  this.name = name,
  this.category = category,
  this.position = position
};

// View Model of the app.
function viewModel() {
  var self = this;
  var map;    
  var LatLngBounds;
  var neighborhoodArea = "Los Angeles";
  var neighborhoodLoc;  
  var infoWindow;
  var venueMarkers = [];

  self.topPlaces = ko.observableArray([]); //top places in Los Angeles from Foursquare
  self.searchResults = ko.observableArray(self.topPlaces()); //list of places after filtering based on user search word
  self.searchWord = ko.observable(''); // search word entered by user
  self.listOn = ko.observable(true); // toggle list on/off. page loads with list open

  //size map to fit window
  self.mapSize = ko.computed(function() {
    $("#map").height($(window).height());
  });

  //update map size when window is resized
  window.addEventListener('resize', function(e) {
    map.fitBounds(LatLngBounds);
    $("#map").height($(window).height());
  });

  function initializeMap() {
    var mapOptions = {
     
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      streetViewControl:true
    };
    map = new google.maps.Map(document.querySelector('#map'), mapOptions);
    infoWindow = new google.maps.InfoWindow();
  };

  //initialize map
  initializeMap();

  //request neighborhood location data from PlaceService
  function getNeighborhood(neighborhood) {
    var request = {
      query: neighborhood
    };
    neighborhoodLoc = new google.maps.places.PlacesService(map);
    neighborhoodLoc.textSearch(request, callback);
  }

  //callback method for neighborhood location
  function callback(results, status) {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      getNeighborhoodInformation(results[0])
    }
  }

//Get top 50 places in neighborhood from foursquare
  function getNeighborhoodInformation(neighborhoodInfo) {
    var lat = neighborhoodInfo.geometry.location.lat();
    var lng = neighborhoodInfo.geometry.location.lng();
    var LatLng = lat + ", " + lng;
    
    var foursquareURL = "https://api.foursquare.com/v2/venues/explore?ll=";   
    var foursquareQuery = "&limit=50&section=topPicks&day=any&time=any&locale=en&oauth_token=UZ2IRM32RA0P43NK1W3IBBLEH14CU3YNEJKPZV1KRQMNBATF&v=20160214";

    foursquareGet = foursquareURL + LatLng + foursquareQuery;

    $.getJSON(foursquareGet, function(data) {
      self.topPlaces(data.response.groups[0].items);
      for (var i in self.topPlaces()) {
        setMarkers(self.topPlaces()[i].venue);
      }

      //changes zoom based on foursquare response
      var bounds = data.response.suggestedBounds;
      if (bounds != undefined) {
        LatLngBounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(bounds.sw.lat, bounds.sw.lng),
          new google.maps.LatLng(bounds.ne.lat, bounds.ne.lng));
        map.fitBounds(LatLngBounds);
      }
    }).fail(function (e){
        $('#no-result').text("Foursquare API Could Not Be Loaded");
    });
  }
 
  getNeighborhood(neighborhoodArea);

  //set markers on locations provided by foursquare
  function setMarkers(venue) {
    var lat = venue.location.lat;
    var lng = venue.location.lng;
    var position = new google.maps.LatLng(lat, lng);

    var name = venue.name;
    var category = venue.categories[0].name;
    var address = venue.location.formattedAddress;
    var contact = venue.contact.formattedPhone;
    var foursquarePageUrl = "https://foursquare.com/v/" + venue.id;
    var rating = venue.rating;
    var checkins = venue.stats.checkinsCount;
    var url = venue.url;
    //fix url to display correctly in infowindow
    var formattedUrl;
    if (url && url.slice(0, 7) === 'http://') {
      formattedUrl = url.slice(7);
    } else if (url && url.slice(0, 8) === 'https://') {
      formattedUrl = url.slice(8);
    } else {
      formattedUrl = url;
    }

    //put marker on one of the popular places
    var marker = new google.maps.Marker({
      map: map,
      position: position,
      title: name
    });

    //push popular place in to an array. Used in searching
    venueMarkers.push(new markers(marker, name.toLowerCase(), category.toLowerCase(), position));

    function toggleBounce(){
      if (marker.getAnimation() !== null) {
        marker.setAnimation(null);
      } else {
        marker.setAnimation(google.maps.Animation.BOUNCE);
      }
    }


    //HTML for the infowindow
    var infoWindowDisplay = '<div class="infoWindow"><p><span class="venueName">' + name +
      '</span></p><p class="venueCat"><span>' + category + 
      '</span></p><p class="venueRating"><span><strong>Rating: </strong>' + rating + '</span></p><p class="venueAddress"><span>' + address+ 
      '</span></p><p><span class="venueContact">' + contact + 
      '</span></p><p><a href="' + url + '" class="venueWebsite" target="_blank">' + formattedUrl + '</a></p>' + '<p> <span class="venueCheckins">Check-Ins: ' + checkins + '</span></p></div><a href="' + foursquarePageUrl + '" target="_blank"><img class="foursquareIcon" src="img/Foursquare-icon.png"></a>';

    //set markers on map and move map center to marker on infowindow open
    google.maps.event.addListener(marker, 'click', function() {
      infoWindow.setContent(infoWindowDisplay);
      infoWindow.open(map, this);
      map.panTo(position);
      
    });

    marker.addListener('click', toggleBounce);
  }

   //list toggle method. open/close the list view
  self.listOpenClose = function() {
    if (self.listOn() === true) {
      self.listOn(false);
    } else {
      self.listOn(true);
    }
  };

  //open info window when place in the list view is clicked
  self.clickListItem = function(venueFromList) {
    var venueName = venueFromList.venue.name.toLowerCase();
    for (var i in venueMarkers) {
      if (venueMarkers[i].name === venueName) {
        google.maps.event.trigger(venueMarkers[i].marker, 'click');
        map.panTo(venueMarkers[i].position);
        toggleBounce();
      }
    }
  };

  //update list view based on search
  self.searchDisplay = ko.computed(function() {
    var venue;
    var list = [];
    var searchWord = self.searchWord().toLowerCase();
    for (var i in self.topPlaces()) {
      venue = self.topPlaces()[i].venue;
      if (venue.name.toLowerCase().indexOf(searchWord) != -1 ||
        venue.categories[0].name.toLowerCase().indexOf(searchWord) != -1) {
        list.push(self.topPlaces()[i]);
      }
    }
    self.searchResults(list);
  });

  //filtering displayed markers based on search
  function searchMarkers(searchWord) {
    for (var i in venueMarkers) {
      if (venueMarkers[i].marker.map === null) {
        venueMarkers[i].marker.setMap(map);
      }
      if (venueMarkers[i].name.indexOf(searchWord) === -1 &&
        venueMarkers[i].category.indexOf(searchWord) === -1) {
        venueMarkers[i].marker.setMap(null);
      }
    }
  }

  //update map markers based on search
  self.displayMarkers = ko.computed(function() {
    searchMarkers(self.searchWord().toLowerCase());
  });

}

//initialize view model binding
$(function() {
  ko.applyBindings(new viewModel());
});




