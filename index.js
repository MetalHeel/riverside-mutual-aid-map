var express = require('express');
var app = express();
var port = process.env.PORT || 6969;

app.use(express.static('public'));

app.listen(port);