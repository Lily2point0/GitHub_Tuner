require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const nexmo = require('./nexmo');

function generateJSON(callParams, fileName) {
	const content = [
		{
	        "action": "talk",
	        "voiceName": "Emma",
	        "text": "Please hold the line while we fetch your GitHub tune."
	    },
		{
		    "action": "stream",
		    "streamUrl": [`${process.env.LOCAL_URL}/output/${fileName}`]
		}
	];

	fs.writeFile(path.resolve(path.join(`${__dirname}/nexmo/${callParams.text}_output.json`)), JSON.stringify(content), err => {
		if(err) {
			console.log(err);
			return;
		}
		console.log('OK');

		cleanupTempFiles(callParams.text);
		setTimeout(() => {nexmo.call(callParams, `${callParams.text}_output.json`)}, 500);
	});
}


function cleanupTempFiles(user) {
	fs.readdir(path.resolve(path.join(__dirname + '/temp/')), (err, files) => {
		if(err) console.log(err);

		for(let i = 0; i < files.length; ++i) {
			if(files[i].startsWith(`${user}_row`)) {
				fs.remove(path.resolve(path.join(`${__dirname}/temp/${files[i]}`)), err => {
					if(err) return console.log(err);
					
					console.log(`${files[i]} removed successfully`);
				});
			}
		}
	});
}

module.exports = {
	generateJSON: generateJSON
}