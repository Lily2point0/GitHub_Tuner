require('dotenv').config();
const Nexmo = require('nexmo');

const nexmo = new Nexmo({
    apiKey: process.env.NEXMO_API_KEY,
    apiSecret: process.env.NEXMO_API_SECRET,
    applicationId: process.env.NEXMO_APP_ID,
    privateKey: process.env.NEXMO_PRIVATE_KEY
});

function callUser(callParams, fileName) {
	nexmo.calls.create({
	    to: [{
	      type: 'phone',
	      number: callParams.msisdn
	    }],
	    from: {
	      type: 'phone',
	      number: process.env.NEXMO_NUMBER
	    },
	    answer_url: [`${process.env.LOCAL_URL}/nexmo/${fileName}`]
	}, err => {
	  	console.log(err);
	});
}

module.exports = {
	instance: nexmo,
	call: callUser
}