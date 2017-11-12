const fetch = require('node-fetch');
const fs = require('fs-extra');
const path = require('path');
const SoxCommand = require('sox-audio');
const puppeteer = require('puppeteer');

const nexmo = require('./nexmo');
const fileUtil = require('./fileUtil');

const GHCOLOURS = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'];
let graphSize = 0;

function processQuery(params) {
	fetch(`https://github.com/users/${params.text}/contributions`)
	.then(res => {
		return res.status;
	})
	.then(status => {
		let message;
		if(status === 200) {
			message = `Thank you, we are now generating a soundgraph for ${params.text}.`;
			getContributions(params);
		} else {
			message = `Oh no, ${params.text} is not a valid GitHub user.`;
		}

		nexmo.instance.message.sendSms(params.to, params.msisdn, message, err => {
			console.log('message sent', err);
		});
	})
	.catch(err => {
		console.log('ERROR', err);
	});
}

async function getContributions(data) {
	const user = data.text;
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	await page.goto(`https://github.com/users/${user}/contributions`);
	const getMusicData = await page.evaluate(() => {
		const userData = [];
		const lines = document.querySelectorAll('.js-calendar-graph-svg > g g');

		Array.from(lines).forEach(line => {
			const notes = line.querySelectorAll('rect');
			const userRow = [];
			Array.from(notes).forEach(note => {
				userRow.push(note.getAttribute("fill"));
			});
			userData.push(userRow.reverse());
		});
		return userData;
	});

	graphSize = await page.evaluate(() => {
		const lines = document.querySelectorAll('.js-calendar-graph-svg > g g');
		return lines.length;
	});

	makeMusic(getMusicData, data);
	browser.close();
}

async function makeMusic(data, callParams) {
	const output = [];
	for(let i = 0; i < data.length; ++i) {
		const row = [];
		for(let j = 0; j < data[i].length; ++j) {
			const contrib = data[i][j];
			if(contrib !== GHCOLOURS[0]) {
				let prefix = 'P';

				if(contrib === GHCOLOURS[1]) {
					prefix = 'P';
				} else if(contrib === GHCOLOURS[2]) {
					prefix = 'S';
				} else if(contrib === GHCOLOURS[3]) {
					prefix = 'W';
				} else {
					prefix = 'D';
				}
				row.push(`${prefix}${j + 1}.wav`);
			}
		}

		if(row.length > 1) {
			output.push(await combineRow(row, i, callParams.text));
		} else if(row.length === 1) {
			output.push(await exportRow(row, i, callParams.text));
		} else {
			output.push(await getSilence(row,i, callParams.text));
		}
	}
	
	await concatRows(callParams);
	return;
}

function getSilence(row, index, user) {
	const outputRow = new SoxCommand();

	outputRow.input(path.resolve(path.join(__dirname + '/sounds/silence.wav')));
	const writeIndex = (index < 10)?`0${index}`:index;
	outputRow.output(path.resolve(path.join(`${__dirname}/temp/${user}_row${writeIndex}.wav`)));
	outputRow.run();

	soxObserver(outputRow, 'getSilence');
}

function exportRow(row, index, user) {
	const outputRow = new SoxCommand();

	outputRow.input(path.resolve(path.join(__dirname + '/sounds/' + row[0])));
	const writeIndex = (index < 10)?`0${index}`:index;
	outputRow.output(path.resolve(path.join(`${__dirname}/temp/${user}_row${writeIndex}.wav`)));
	outputRow.run();

	soxObserver(outputRow, 'exportRow');
}

function combineRow(row, index, user) {
	const outputRow = new SoxCommand();

	for(let i = 0; i < row.length; ++i){
		outputRow.input(path.resolve(path.join(__dirname + '/sounds/' + row[i])));
	}
	const writeIndex = (index < 10)?`0${index}`:index;
	outputRow.output(path.resolve(path.join(`${__dirname}/temp/${user}_row${writeIndex}.wav`))).combine('mix');
	outputRow.run();

	soxObserver(outputRow, 'combineRow');
}

function concatRows(callParams) {
	fs.readdir(path.resolve(path.join(__dirname + '/temp/')), (err, files) => {
		if(files.indexOf('.DS_Store') > -1) {
			files.splice(files.indexOf('.DS_Store'), 1);
		}
		
		const currentUserMatch = `${callParams.text}_row`;
		const userFiles = [];
		for(let k = 0; k < files.length; ++k) {
			if(files[k].startsWith(currentUserMatch)) {
				userFiles.push(files[k]);
			}
		}

		if(userFiles.length !== graphSize) return setTimeout(() => {concatRows(callParams)}, 100);

		const outputPiece = new SoxCommand();
		for(let i = 0; i < userFiles.length; ++i){
			outputPiece.input(path.resolve(path.join(__dirname + '/temp/' + userFiles[i])));	
		}

		outputPiece.output(path.resolve(path.join(`${__dirname}/output/${callParams.text}_output.wav`))).outputSampleRate(16000).combine('concatenate');
		outputPiece.run();
		
		soxObserver(outputPiece, 'concatRows', () => {
			fileUtil.generateJSON(callParams, `${callParams.text}_output.wav`);
		});
	});
}

async function soxObserver(instance, invoke, callback = null) {
	instance.on('start', data => {
		console.log('starter:::', invoke, ':::', data);
	});

	instance.on('progress', progress => {
	    console.log('Processing progress: ', progress);
	});

	instance.on('error', (err, stdout, stderr) => {
		console.log('Error in:::', invoke);
	    console.log('Cannot process audio: ' + err.message);
	    console.log('Sox Command Stdout: ', stdout);
	    console.log('Sox Command Stderr: ', stderr)
	});

	instance.on('end', () => {
		console.log('ENDED:', invoke);
		if(callback !== null) callback();
		return 'OK';
	});
}

module.exports = {
	process: processQuery
}