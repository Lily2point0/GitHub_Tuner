const path = require('path');
const graph = require('./graphToSound');

const express = require('express');
const app = express();

app.use('/output', express.static(path.resolve(path.join(__dirname + '/output'))));
app.use('/nexmo', express.static(path.resolve(path.join(__dirname + '/nexmo'))));

app.get('/sms', (req, res) => {
	const params = req.query;
	graph.process(params);
	res.status(200).json("200 OK");
});

app.post('/voice', (req, res) => {
	res.status(200).json("200 OK");
});

app.listen(2017);
