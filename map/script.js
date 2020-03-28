
window.onload = function() {

	/*------------------------------------------------
	-------------- Initialize variables --------------
	------------------------------------------------*/

	var mapboxAccessToken = 'pk.eyJ1IjoiYnJpZW5uYWtoIiwiYSI6ImNqbXRsNjN0aTAxZXAzbG13bmh0dGFjNm0ifQ.98TAXgq4Rg1LpM2Oq1rlWw';

	var stateData = getUSData();
	var coronavirusStateData = getCoronavirusStateData();
	getReData();
	console.log(coronavirusStateData);

	/*------------------------------------------------------------------
	-------------- Define functions to get data ------------------------
	------------------------------------------------------------------*/

	// Creates and executes XHR request, taking in URL and an event listener to handle response
	function doXHR(url, eventHandler) {
		var xhr = new XMLHttpRequest();
		xhr.addEventListener('load', eventHandler);
		xhr.open('GET', url, false);
		xhr.send();
	}

	// Formats CSV into JSON (with states being keys)
	function formatResponse2(csv) {
		var lines = csv.split('\n');
		var results = {};
		var headers = lines[0].split(',');
		for (var i = 1; i < lines.length; i++) {
      		var obj = {};
      		var currentline = lines[i].split(',');
      		state = currentline[1];
      		if (!(state in results)) {
      			results[state] = [];
      		}
      		for(var j = 0; j < headers.length; j++){
      			if (j== 1) { // if on the state field, skip
      				continue;
      			}
          		obj[headers[j]] = currentline[j];
      		}
      		results[state].push(obj);
  		}
  		return results;
	}

	// Formats CSV into JSON (with dates being keys)
	function formatResponse(csv) {
		var lines = csv.split('\n');
		var results = {};
		var headers = lines[0].split(',');
		for (var i = 1; i < lines.length; i++) {
			var obj = {};
			var currentline = lines[i].split(',');
			var date = currentline[0];
			var state = currentline[1];
			if (!(date in results)) {
				results[date] = {};
			}
			for (var j = 2; j < headers.length; j++) {
				obj[headers[j]] = currentline[j];
			}
			results[date][state] = obj;
		}
		return results;
	}

	// Formats response, adding Re data to coronavirus state data
	function formatReResponse(csv) {
		var lines = csv.split('\n');
		var headers = lines[0].split(',');
		for (var i = 1; i < lines.length - 1; i++) {
			var currentline = lines[i].split(',');
			var date = currentline[0];
			
			// Add to coronavirusStateData
			for (var j = 1; j < headers.length; j++) {
				var state = headers[j];
				if (state in coronavirusStateData[date]) {
					coronavirusStateData[date][state]['re'] = currentline[j];
				}
			}
		}
	}

	function getReData() {
		var url = 'https://raw.githubusercontent.com/briennakh/covid-19/master/map/data/Re.csv';
		var data;
		function handleResponse() {
			formatReResponse(this.response);
		}
		doXHR(url, handleResponse);
	}

	// Get geometries for U.S. states
	function getUSData() {
		var url = 'http://briennakh.me/accessibility-maps/data/us_states_edited.json?v=' + new Date().getTime()
		var data;
		function handleResponse() {
			data = JSON.parse(this.response);
		}
		doXHR(url, handleResponse);
		return data;
	}

	// Get coronavirus data from New York Times' GitHub (updated every day at noon ET)
	function getCoronavirusStateData() {
		var url = 'https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-states.csv';
		var data;
		function handleResponse() {
			data = formatResponse(this.response); 
		}
		doXHR(url, handleResponse);
		return data;
	}


	/*------------------------------------------------
	-------------- Create map ------------------------
	------------------------------------------------*/

	// Create basemap 
	var basemap = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
	    id: 'mapbox/dark-v10',
	    attribution: '',
	    tileSize: 512,
	    zoomOffset: -1,
	    maxZoom: 18,
	    minZoom: 2,
	    accessToken: mapboxAccessToken
	});

	// Create map 
	var map = L.map('map', {
		center: new L.LatLng(37.8, -96),
		zoom: 4,
		layers: [basemap],
		preferCanvas: true,
		maxBounds: [[-90,-Infinity], [90,Infinity]],
		maxBoundsViscosity: 1.0, 
		worldCopyJump: true 
	});
	
	/*-----------------------------------------------------------------
	-------------- Create state layer  --------------------------------
	------------------------------------------------------------------*/

	function highlightFeature(e) {
		e.target.setStyle({
			dashArray: '',
			fillOpacity: 0.8
		});
	}

	function getStateColor(d) {
		return d > 10000 ? '#800026' :
		       d > 5000  ? '#BD0026' :
		       d > 1000  ? '#E31A1C' :
		       d > 750  ? '#FC4E2A' :
		       d > 500   ? '#FD8D3C' :
		       d > 200   ? '#FEB24C' :
		       d > 100   ? '#FED976' :
		                  '#FFEDA0';
	}

	function onEachState(feature, layer) {
		layer.on({
			mouseover: function(e) {
				highlightFeature(e);
				info.update('Re: ', feature.properties.name, parseFloat(coronavirusStateData["2020-03-25"][feature.properties.name].re).toFixed(2));
			},
			mouseout: function(e) {
				stateLayer.resetStyle(e.target);
			},
			click: function(e) {
				map.fitBounds(e.target.getBounds());
			}
		});
	}

	stateLayer = L.geoJson(stateData, {
		style: function(feature) { // Style each feature
			return {
				fillColor: getStateColor(coronavirusStateData["2020-03-25"][feature.properties.name].re),
				weight: 2,
				opacity: 0.5,
				color: 'white',
				dashArray: '1',
				fillOpacity: 0.5
			};
		},
		onEachFeature: onEachState
	}).addTo(map);

	/*--------------------------------------------------------
	-------------- INFO DIV --------------------------------
	--------------------------------------------------------*/

	var info = L.control();

	info.onAdd = function(map) {
		this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
		this.update();
		return this._div;
	};

	// update the control based on feature properties passed
	info.update = function(title, name, data) {
	    this._div.innerHTML = ((title && name && data) ?
	        '<h4>' + title + '</h4><b>' + name + '</b><br />' + data 
	        : 'Hover over or click a state');
	};

	info.addTo(map);


	/* https://github.com/dwilhelm89/LeafletSlider
	var sliderControl = L.control.sliderControl({position: "topright", layer: stateLayer});
	$('#slider-timestamp').html(options.markers[ui.value].feature.properties.time.substr(0, 19));

	//Make sure to add the slider to the map ;-)
	map.addControl(sliderControl);

	//And initialize the slider
	sliderControl.startSlider();*/

}