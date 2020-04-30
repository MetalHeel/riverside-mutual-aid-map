var map = null;
var markerData = {};
var temporaryMarker = null;

var showTrained = true;
var showUntrained = false;
var showStreetChampions = true;

const Filtertype = {
	TRAINED: 1,
	UNTRAINED: 2,
	STREET_CHAMPIONS: 3
};

$(document).ready(function() {
	// Allow "Enter" button to be hit to search for postal codes.
	var search = document.getElementById("searchInput");
	search.addEventListener("keyup", function(event) {
		if (event.keyCode === 13) {
			document.getElementById("searchButton").click();
		}
	});
	// Initial filter UI configuration.
	document.getElementById("trainedInput").checked = showTrained;
	if (!showTrained) {
		document.getElementById("trainedFilter").firstElementChild.style.display = "none";
	}
	document.getElementById("untrainedInput").checked = showUntrained;
	if (!showUntrained) {
		document.getElementById("untrainedFilter").firstElementChild.style.display = "none";
	}
	document.getElementById("streetChampionsInput").checked = showStreetChampions;
	if (!showStreetChampions) {
		document.getElementById("streetChampionsFilter").firstElementChild.style.display = "none";
	}
});

function initMap() {
	var xmlHttp = new XMLHttpRequest();
	xmlHttp.onreadystatechange = function() {
		if (xmlHttp.readyState != 4) {
			return;
		}
		if (!xmlHttp.response) {
			return;
		}
		var volunteerData = JSON.parse(xmlHttp.response);
		setupMap(volunteerData.feed.entry);
	}
	xmlHttp.open("GET", "https://spreadsheets.google.com/feeds/cells/1V4F02LbP8feQXTKX_l1ES9kv4udM09l59KPWr4r4J9w/1/public/full?alt=json");
	xmlHttp.send();
}

function setupMap(entries) {
	map = new google.maps.Map(document.getElementById('map'), {
		zoom: 15,
		center: {
			lat: 51.486, 
			lng: -3.199
		}
	});
	map.addListener('click', function() {
		closeAllInfoWindows();
	});
	createAreas();
	createMarkers(entries);
}

function createAreas() {
	var legend = document.getElementById('legend');
	Object.keys(areas).forEach(function (key) {
		// Create the polygon.
		var area = new google.maps.Polygon({
			paths: areas[key].vertices,
			strokeColor: areas[key].lineColor,
			strokeOpacity: 1.0,
			strokeWeight: 1.8,
			fillColor: areas[key].fillColor,
			fillOpacity: 0.5
		});
		area.setMap(map);
		// Create the hover label.
		var infoWindow = new google.maps.InfoWindow({
			content: '<h3>' + key + '</h3>',
			disableAutoPan: true,
			zIndex: 1
		});
		area.addListener('click', function() {
			closeAllInfoWindows();
		});
		area.addListener('mouseover', function() {
			infoWindow.setPosition(getHighestLatitudeCoordinates(areas[key].vertices));
			infoWindow.open(map);
		});
		area.addListener('mouseout', function() {
			infoWindow.close();
		});
		//Add to the legend.
		var div = document.createElement('div');
		div.innerHTML = '<svg width="20" height="13">' +
				'<rect width="20" height="13" style="fill:' + areas[key].fillColor + '; stroke-width:1.8; stroke:' + areas[key].lineColor + '" />' +
			'</svg>' + 
			'<span class="areaLabel">' + key + '</span>';
		legend.appendChild(div);
	});
	map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(legend);
}

function createMarkers(entries) {
	var rowIndex = 8;
	while (true) {
		if (!entries[rowIndex]) {
			break;
		}
		if (!validateVolunteerData(entries, rowIndex)) {
			break;
		}
		var postalCode = homogenizePostalCode(entries[rowIndex + 3].content["$t"]);
		if (!(postalCode in markerData)) {
			markerData[postalCode] = {
				"volunteers": [],
				"trainingDates": [],
				"streetChampion": [],
				"trained": [],
				"interestedInChampion": []
			};
		}
		markerData[postalCode].volunteers.push(entries[rowIndex + 1].content["$t"]);
		markerData[postalCode].trainingDates.push(entries[rowIndex + 4].content["$t"]);
		markerData[postalCode].streetChampion.push(entries[rowIndex + 5].content["$t"]);
		markerData[postalCode].trained.push(entries[rowIndex + 6].content["$t"]);
		markerData[postalCode].interestedInChampion.push(entries[rowIndex + 7].content["$t"]);
		rowIndex += 8;
	}
	var xmlHttp = new XMLHttpRequest();
	xmlHttp.onreadystatechange = function() {
		if (xmlHttp.readyState != 4) {
			return;
		}
		if (!xmlHttp.response) {
			return;
		}
		var locationData = JSON.parse(xmlHttp.response);
		locationData.result.forEach(entry => {
			var postalCode = homogenizePostalCode(entry.result.postcode);
			var infoWindow = new google.maps.InfoWindow({ zIndex: 2 });
			var marker = new google.maps.Marker({
				position: {
					lat: entry.result.latitude,
					lng: entry.result.longitude
				}
			});
			marker.addListener('click', function() {
				closeAllInfoWindows();
				infoWindow.open(map, marker);
			});
			markerData[postalCode].marker = marker;
			markerData[postalCode].infoWindow = infoWindow;
		});
		filterAndDisplayData();
	}
	xmlHttp.open("POST", "https://api.postcodes.io/postcodes");
	xmlHttp.setRequestHeader("Content-Type", "application/json");
	xmlHttp.send(JSON.stringify({"postcodes": Object.keys(markerData)}));
}

function validateVolunteerData(entries, startingIndex) {
	var namePattern = /^(?!(yes|no))[a-z]+(( |-)?[a-z]+)?\s*$/gi;
	var postalCodePattern = /^\w{4} ?\w{3}$/gi;
	var datePattern = /^(\d{1,2}-[a-z]{3}-\d{4}|NA)$/gi;
	var yesNoPattern = /^(yes|no)$/gi;
	if (!entries[startingIndex + 1].content["$t"].trim().match(namePattern)) {
		console.error("Invalid perferred name found at row " + ((startingIndex / 8) + 1) + ".");
		return false;
	}
	if (!entries[startingIndex + 3].content["$t"].trim().match(postalCodePattern)) {
		console.error("Invalid postal code found at row " + ((startingIndex / 8) + 1) + ".");
		return false;
	}
	if (!entries[startingIndex + 4].content["$t"].trim().match(datePattern)) {
		console.error("Invalid training date found at row " + ((startingIndex / 8) + 1) + ".");
		return false;
	}
	if (!entries[startingIndex + 5].content["$t"].trim().match(yesNoPattern)) {
		console.error("Invalid street champion response found at row " + ((startingIndex / 8) + 1) + ".");
		return false;
	}
	if (!entries[startingIndex + 6].content["$t"].trim().match(yesNoPattern)) {
		console.error("Invalid trained response found at row " + ((startingIndex / 8) + 1) + ".");
		return false;
	}
	if (!entries[startingIndex + 7].content["$t"].trim().match(yesNoPattern)) {
		console.error("Invalid interested in street champion response found at row " + ((startingIndex / 8) + 1) + ".");
		return false;
	}
	return true;
}

function generateVolunteerDataContent(volunteers, trainingDates, isStreetChampionList, isTrainedList, isInterestedList, postalCode) {
	var content = "<span style=\"font-weight:bold;\">" + normalizePostalCode(postalCode) + "</span>";
	for (var i = 0; i < volunteers.length; i++) {
		content +=  "<h3 style=\"text-align: center;\">" + volunteers[i] + "</h3>" +
			"<ul>" +
				"<li>Training Date: " + trainingDates[i] + "</li>" +
				"<li>Street Champion: " + isStreetChampionList[i] + "</li>" +
				"<li>Trained: " + isTrainedList[i] + "</li>" +
				"<li>Interested in Being Street Champion: " + isInterestedList[i] + "</li>" +
			"</ul>";
	}
	return content;
}

function searchForPostalCode(postalCode) {
	if (!postalCode) {
		return;
	}
	var homogenizedPostalCode = homogenizePostalCode(postalCode);
	if (!(homogenizedPostalCode in markerData)) {
		var xmlHttp = new XMLHttpRequest();
		xmlHttp.onreadystatechange = function() {
			if (xmlHttp.readyState != 4) {
				return;
			}
			if (!xmlHttp.response) {
				return;
			}
			var locationData = JSON.parse(xmlHttp.response);
			if (locationData.status == 404) {
				return;
			}
			if (!temporaryMarker) {
				temporaryMarker = new google.maps.Marker({
					map: map,
					position: {
						lat: locationData.result.latitude,
						lng: locationData.result.longitude
					},
					icon: {
						path: google.maps.SymbolPath.CIRCLE,
						fillColor: '#32a852',
						fillOpacity: 1.0,
						strokeColor: '#ffffff',
						strokeOpacity: 1.0,
						strokeWeight: 1,
						scale: 10
					}
				});
			} else {
				temporaryMarker.setPosition({
					lat: locationData.result.latitude,
					lng: locationData.result.longitude
				});
			}
			map.setCenter({
				lat: locationData.result.latitude,
				lng: locationData.result.longitude
			});
			map.setZoom(17);
		}
		xmlHttp.open("GET", "https://api.postcodes.io/postcodes/" + postalCode);
		xmlHttp.send();
		return;
	}
	map.setCenter(markerData[homogenizedPostalCode].marker.position);
	map.setZoom(17);
	google.maps.event.trigger(markerData[homogenizedPostalCode].marker, 'click');
}

function isInfoWindowOpen(infoWindow) {
	var map = infoWindow.getMap();
	return map !== null && typeof map !== "undefined";
}

function closeAllInfoWindows() {
	Object.keys(markerData).forEach(key => markerData[key].infoWindow.close());
}

function getHighestLatitudeCoordinates(pairs) {
	var highest = null;
	pairs.forEach(function (pair) {
		if (!highest || pair.lat > highest.lat) {
			highest = pair;
		}
	});
	return highest;
}

function homogenizePostalCode(originalText) {
	var homogenizedText = originalText.replace(/\s+/g, '');
	homogenizedText = homogenizedText.toLowerCase();
	return homogenizedText;
}

function normalizePostalCode(originalText) {
	var normalizedText = originalText.toUpperCase();
	normalizedText = normalizedText.substring(0, 4) + " " + normalizedText.substring(4);
	return normalizedText;
}

function toggleCheckbox(input, checkbox, filterType) {
	input.checked = !input.checked;
	if (input.checked) {
		checkbox.firstElementChild.style.display = "inline-block";
	} else {
		checkbox.firstElementChild.style.display = "none";
	}
	if (filterType == Filtertype.TRAINED) {
		showTrained = input.checked;
	} else if (filterType == Filtertype.UNTRAINED) {
		showUntrained = input.checked;
	} else if (filterType == Filtertype.STREET_CHAMPIONS) {
		showStreetChampions = input.checked;
	}
}

function filterAndDisplayData() {
	closeAllInfoWindows();
	Object.keys(markerData).forEach(function (key) {
		var volunteers = [];
		var trainingDates = [];
		var streetChampion = [];
		var trained = [];
		var interestedInChampion = [];
		var data = markerData[key];
		for (var i = 0; i < data.volunteers.length; i++) {
			if (!showUntrained && data.trained[i].toLowerCase() === "no") {
				continue;
			}
			if (!showTrained && data.trained[i].toLowerCase() === "yes") {
				continue;
			}
			if (!showStreetChampions && data.streetChampion[i].toLowerCase() === "yes") {
				continue;
			}
			volunteers.push(data.volunteers[i]);
			trainingDates.push(data.trainingDates[i]);
			streetChampion.push(data.streetChampion[i]);
			trained.push(data.trained[i]);
			interestedInChampion.push(data.interestedInChampion[i]);
		}
		if (volunteers.length == 0) {
			data.marker.setMap(null);
			continue;
		}
		data.marker.setLabel(volunteers.length.toString(10))
		data.marker.setMap(map);
		data.infoWindow.setContent(generateVolunteerDataContent(volunteers, trainingDates, streetChampion, trained, interestedInChampion, key));
	});
}