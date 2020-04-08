var express = require('express');
var app = express();
var port = process.env.PORT || 6969;

app.get('/', function (request, response) {
	response.send('Hello World!');
});

app.listen(port);