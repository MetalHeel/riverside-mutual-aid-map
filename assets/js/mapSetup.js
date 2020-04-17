var infoWindows = [];

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
	xmlHttp.open("GET", "https://spreadsheets.google.com/feeds/cells/1V4F02LbP8feQXTKX_l1ES9kv4udM09l59KPWr4r4J9w/1/public/full?alt=json", true);
	xmlHttp.send(null);
}

function setupMap(entries) {
	var map = new google.maps.Map(document.getElementById('map'), {
		zoom: 15,
		center: {
			lat: 51.486, 
			lng: -3.199
		}
	});
	createMarkers(map, entries);
}

function createMarkers(map, entries) {
	var postalCodes = [];
	var markerData = {};
	var rowIndex = 8;
	while (true) {
		if (entries[rowIndex].content["$t"] === "Grand Total") {
			break;
		}
		var postalCode = entries[rowIndex + 3].content["$t"];
		postalCode = postalCode.replace(/\s+/g, '');
		postalCode = postalCode.toLowerCase();
		if (!postalCodes.includes(postalCode)) {
			postalCodes.push(postalCode);
		}
		if (!markerData.hasOwnProperty(postalCode)) {
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
			var postalCode = entry.result.postcode;
			postalCode = postalCode.replace(/\s+/g, '');
			postalCode = postalCode.toLowerCase();
			var infoWindowContent = generateVolunteerDataContent(markerData[postalCode]);
			var infoWindow = new google.maps.InfoWindow({
				content: infoWindowContent
			});
			var marker = new google.maps.Marker({
				position: {
					lat: entry.result.latitude,
					lng: entry.result.longitude
				},
				map: map
			});
			marker.addListener('click', function() {
				if (isInfoWindowOpen(infoWindow)) {
					infoWindow.close();
					return;
				}
				closeAllInfoWindows();
				infoWindow.open(map, marker);
			});
			infoWindows.push(infoWindow);
		});
	}
	xmlHttp.open("POST", "https://api.postcodes.io/postcodes");
	xmlHttp.setRequestHeader("Content-Type", "application/json");
	xmlHttp.send(JSON.stringify({"postcodes" : postalCodes}));
}

function generateVolunteerDataContent(data) {
	var content = "";
	for (var i = 0; i < data.volunteers.length; i++) {
		content += "<h3 style=\"text-align: center;\">" + data.volunteers[i] + "</h3>" +
			"<ul>" +
				"<li>Training Date: " + data.trainingDates[i] + "</li>" +
				"<li>Street Champion: " + data.streetChampion[i] + "</li>" +
				"<li>Trained: " + data.trained[i] + "</li>" +
				"<li>Interested in Being Street Champion: " + data.interestedInChampion[i] + "</li>" +
			"</ul>";
	}
	return content;
}

function isInfoWindowOpen(infoWindow) {
	var map = infoWindow.getMap();
	return map !== null && typeof map !== "undefined";
}

function closeAllInfoWindows() {
	infoWindows.forEach(infoWindow => infoWindow.close());
}