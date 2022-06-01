const os = require("os");
const https = require("https");
const fs = require("fs");
const unzipper = require("unzipper");

function loadQueue(runRequest) {
	let _SRXDQueue = [];

	if(fs.existsSync("./SRXDQueue.json")) {
		let logger = runRequest.modules.logger;

		let queueRaw = fs.readFileSync("./SRXDQueue.json");
		_SRXDQueue = JSON.parse(queueRaw);

		logger.info("vvvv LOADED vvvv");
		logger.info(_SRXDQueue);
		logger.info("^^^^ LOADED ^^^^");
	}

	return _SRXDQueue;
}

// roles: broadcaster, mod, vip, sub

function addToQueue(runRequest, data) {
	let _SRXDQueue = loadQueue(runRequest);

	let logger = runRequest.modules.logger;
	logger.info("vvvv QUEUE vvvv"); 
	logger.info(_SRXDQueue);
	logger.info("^^^^ QUEUE ^^^^");

	const meta = runRequest.trigger.metadata;

	const username = meta.username;
	const msgData = meta.chatMessage;

	const userAllowedAmount = runRequest.parameters.queueLimitUser;
	const modBonus = runRequest.parameters.ModeratorBonus;
	const vipBonus = runRequest.parameters.VIPBonus;
	const subBonus = runRequest.parameters.SubscriberBonus;

	let allowedAmount = userAllowedAmount;
	if(msgData.isMod) { allowedAmount += modBonus; }
	if(msgData.isSubscriber) { allowedAmount += subBonus; }
	if(msgData.isVip) { allowedAmount += vipBonus; }

	let out = {
		attempt: {
			success: false,
			reason: "no reason (this should not happen)",
			position: 0
		}
	};

	if(runRequest.parameters.QueueLimit) {
		if(_SRXDQueue.length >= runRequest.parameters.QueueLimit) {
			out.attempt.success = false;
			out.attempt.reason = `the queue is full! (Limit: ${runRequest.parameters.QueueLimit} songs)`;
			return out;
		}
	}

	var hasRequestedAmount = 0;
	for(let idx = 0; idx < _SRXDQueue.length; idx++) {
		let curRow = _SRXDQueue[idx];

		if(curRow.requester === username) {
			hasRequestedAmount++;
		}

		if(curRow.data.id === data.id) {
			out.attempt.success = false;
			out.attempt.reason = `this song is already in queue at position #${idx+1}!`;
			return out;
		}
	}

	if(userAllowedAmount) {
		if(hasRequestedAmount >= allowedAmount) {
			out.attempt.success = false;
			out.attempt.reason = `you have already requested a maximum of ${allowedAmount} song(s)!`;
		}
		return out;
	}

	let row = {
		requester: username,
		data: data
	}

	_SRXDQueue.push(row);
	out.attempt.success = true;
	out.attempt.position = _SRXDQueue.length;

	fs.writeFileSync("./SRXDQueue.json", JSON.stringify(_SRXDQueue));

	return out;
}

function getAPIOpts(path) {
	return {
		hostname: "spinsha.re",
		port: 443,
		path: `/api/${path}`,
		method: 'GET'
	};
}

function doChat(runRequest, message) {
	let logger = runRequest.modules.logger;
	logger.info("vvvv IS THIS BEING CALLED vvvv"); 
	logger.info(`${runRequest.parameters.useBotAccount}`);
	logger.info("^^^^ IS THIS BEING CALLED ^^^^");

	const chatter = (runRequest.parameters.useBotAccount ? "Bot" : "Streamer");

	logger.info("vvvv LITERALLY WHAT THE FUCK IS GOING ON vvvv"); 
	logger.info(`${message}`);
	logger.info("^^^^ LITERALLY WHAT THE FUCK IS GOING ON ^^^^");

	let response = {
		success: true,
		effects: [
			{
				type: "firebot:chat",
				message: `! ${message}`,
				chatter: chatter
			}
		]
	};

	return response;
}

function run(runRequest) {
	let logger = runRequest.modules.logger;
	logger.info(runRequest.trigger);

	const meta = runRequest.trigger.metadata;
	logger.info(meta);

	const chatter = (runRequest.parameters.useBotAccount ? "Bot" : "Streamer");

	const username = meta.username;
	const args = meta.userCommand.args;
	const trigger = meta.userCommand.trigger;

	logger.info("got here 3");

	let response = {success: true};
	if(!args.length) {
		return new Promise((resolve, reject) => { resolve(doChat(runRequest, `Use https://spinsha.re to find custom charts, then use "${trigger} ID#" in a chat message to request it! (the number at the end of the song URL)`)) });
	}

	let xdID = args[0];
	//xdID = parseInt(xdID.replace("https://spinsha.re/song/", ""));

	if(isNaN(xdID)) {
		if(xdID === "skip") {
			if(!(meta.chatMessage.isMod || meta.chatMessage.isBroadcaster)) {
				return new Promise((resolve, reject) => { resolve(); });
			}

			let queue = loadQueue(runRequest);

			if(!queue.length) {
				return new Promise((resolve, reject) => { resolve(doChat(runRequest, "Nothing is in queue!")) });
			}

			let nextRow = queue.pop(0);
			let songData = nextRow.data;

			fs.writeFileSync("./SRXDQueue.json", JSON.stringify(queue));

			return new Promise((resolve, reject) => { resolve(doChat(runRequest, `Skipped ${songData.artist} - ${songData.title} (${songData.charter})`)) });
		} else if(xdID === "next") {
			if(!meta.chatMessage.isBroadcaster) {
				return new Promise((resolve, reject) => { resolve(); });
			}

			let queue = loadQueue(runRequest);

			if(!queue.length) {
				return new Promise((resolve, reject) => { resolve(doChat(runRequest, "Nothing is in queue!")) });
			}

			let nextRow = queue.splice(0, 1)[0];
			let songData = nextRow.data;

			fs.writeFileSync("./SRXDQueue.json", JSON.stringify(queue));

			let SRXDFolder = runRequest.parameters.SRXDCustomsFolder;
			logger.info(`CHECK ${SRXDFolder}/${songData.fileReference}.srtb`);
			if(!fs.existsSync(`${SRXDFolder}/${songData.fileReference}.srtb`)) {
				return new Promise((resolve, reject) => {
					let opts = getAPIOpts(`song/${songData.id}/download`);

					fs.unlink("./temp.zip", (err) => {
						if (err) throw err;
					});
					let ws = fs.createWriteStream("./temp.zip");

					const r = https.request(opts, res => {
						res.pipe(ws);
					});
					r.end();

					ws.on("finish", function() {
						logger.info("DONE DONE IM DONE HI HEY");
						ws.close();

						fs.createReadStream('./temp.zip').pipe(unzipper.Extract({ path: SRXDFolder }));
					})

					resolve(doChat(runRequest, `Up next: ${songData.artist} - ${songData.title} (${songData.charter}) requested by @${nextRow.requester}`));
				});
			} else {
				return new Promise((resolve, reject) => { resolve(doChat(runRequest, `Up next: ${songData.artist} - ${songData.title} (${songData.charter}) requested by @${nextRow.requester}`)) });
			}
		} else {
			return new Promise((resolve, reject) => { resolve(doChat(runRequest, "SpinShare ID must be numeric.")) });
		}
	} else {
		let opts = getAPIOpts(`song/${xdID}`);
		logger.info(opts);

		return new Promise((resolve) => {
			const r = https.request(opts, res => {
				console.log("got here");

				res.on('data', d => {
					logger.info(`statusCode: ${res.statusCode}`);
					
					let parsed = JSON.parse(d);
					logger.info(parsed);

					let songData = parsed.data;
					
					if(parsed.status === 200) {
						logger.info("yep it gets here");

						let queueData = addToQueue(runRequest, songData);
						if(queueData.attempt.success) {
							resolve(doChat(runRequest, `Queued ${songData.artist} - ${songData.title} (${songData.charter}) [${songData.id}] successfully at position #${queueData.attempt.position}.`));
						} else {
							resolve(doChat(runRequest, `Could not queue ID ${songData.id}, ${queueData.attempt.reason}.`));
						}
					} else {
						resolve(doChat(runRequest, `Could not queue ID ${xdID}, API status not 200.`));
					}
				});
			});
			r.end();
		})
	}

	//return new Promise((resolve, reject) => { resolve(response) });
}

function getScriptManifest() {
	return {
		name: "Spin Rhythm XD Request Manager",
		description: "Allows some control over chat requests (an in-game request manager would work MUCH better, but this will do in the meantime).",
		author: "TheBlackParrot",
		version: "0.1",
		website: "https://twitch.tv/theblackparrot",
		startupOnly: false,
		firebotVersion: "5"
	}
}

function getDefaultParameters() {
	return new Promise((resolve, reject) => {
		resolve({
			SRXDCustomsFolder: {
				type: "filepath",
				description: "Spin Rhythm XD custom songs directory",
				secondaryDescription: "(double check this location if you're setting this up for the first time!)",
				fileOptions: {
					"directoryOnly": true
				},
				default: `C:/Users/${os.userInfo().username}/AppData/LocalLow/Super Spin Digital/Spin Rhythm XD/Custom`
			},
			useBotAccount: {
				type: "boolean",
				description: "Use the linked Bot account in Firebot to send responses",
				default: true,
			},

			QueueLimit: {
				type: "number",
				description: "Limit the overall queue size",
				secondaryDescription: "(0 to disable)",
				default: 25,
				showBottomHr: true
			},

			QueueLimitUser: {
				type: "number",
				description: "Limit the amount of songs the user can queue",
				secondaryDescription: "(0 to disable)",
				default: 1
			},
			ModeratorBonus: {
				type: "number",
				description: "How many extra songs can moderators add?",
				secondaryDescription: "(0 to disable)",
				default: 1
			},
			VIPBonus: {
				type: "number",
				description: "How many extra songs can VIPs add?",
				secondaryDescription: "(0 to disable)",
				default: 1
			},
			SubscriberBonus: {
				type: "number",
				description: "How many extra songs can subscribers add?",
				secondaryDescription: "(0 to disable)",
				default: 1
			}
		});
	});
}

exports.getScriptManifest = getScriptManifest;
exports.getDefaultParameters = getDefaultParameters;
exports.run = run;