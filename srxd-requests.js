const os = require("os");
const https = require("https");
const fs = require("fs");
const unzipper = require("unzipper");

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];

function loadQueue(runRequest) {
	let _SRXDQueue = [];

	if(fs.existsSync("./SRXDQueue.json")) {
		//let logger = runRequest.modules.logger;

		let queueRaw = fs.readFileSync("./SRXDQueue.json");
		_SRXDQueue = JSON.parse(queueRaw);
	}

	return _SRXDQueue;
}

function loadCurrentSong(runRequest) {
	let currentSong = {};

	if(fs.existsSync("./CurrentSRXDSong.json")) {
		//let logger = runRequest.modules.logger;

		let csRaw = fs.readFileSync("./CurrentSRXDSong.json");
		currentSong = JSON.parse(csRaw);
	}

	return currentSong;
}

// roles: broadcaster, mod, vip, sub

function addToQueue(runRequest, data, suggestDiff) {
	let _SRXDQueue = loadQueue(runRequest);

	//let logger = runRequest.modules.logger;

	const meta = runRequest.trigger.metadata;

	const username = meta.username;
	const msgData = meta.chatMessage;

	const userAllowedAmount = runRequest.parameters.queueLimitUser;
	const modBonus = runRequest.parameters.ModeratorBonus;
	const vipBonus = runRequest.parameters.VIPBonus;
	const subBonus = runRequest.parameters.SubscriberBonus;

	const diffMin = runRequest.parameters.DifficultyMinimum;
	const diffMax = runRequest.parameters.DifficultyMaximum;

	const ageMin = runRequest.parameters.AgeMinimum;

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

	if(ageMin !== "0") {
		let songTimestamp = Date.parse(data.uploadDate.date);
		if(data.updateDate != null) {
			songTimestamp = Date.parse(data.updateDate);
		}

		let filterTimestamp = Date.parse(ageMin);

		if(songTimestamp < filterTimestamp) {
			out.attempt.success = false;
			out.attempt.reason = `this chart was uploaded or last updated before ${ageMin}!`;
			return out;
		}
	}

	if(diffMin || diffMax) {
		let diffResult = checkDifficulty(runRequest, data);
		if(!diffResult.allow) {
			out.attempt.success = false;
			out.attempt.reason = diffResult.reason;
			return out;
		}
	}

	let row = {
		requester: username,
		suggestDiff: suggestDiff,
		data: data
	}

	_SRXDQueue.push(row);
	out.attempt.success = true;
	out.attempt.position = _SRXDQueue.length;

	fs.writeFileSync("./SRXDQueue.json", JSON.stringify(_SRXDQueue));

	return out;
}

function checkDifficulty(runRequest, data) {
	const diffMin = runRequest.parameters.DifficultyMinimum;
	const diffMax = runRequest.parameters.DifficultyMaximum;

	if(diffMin || diffMax) {
		let minPass = false;
		let maxPass = false;

		if(data.easyDifficulty != null) {
			if(data.easyDifficulty >= diffMin) { minPass = true; }
			if(data.easyDifficulty <= diffMax) { maxPass = true; }
		}
		if(data.normalDifficulty != null) {
			if(data.normalDifficulty >= diffMin) { minPass = true; }
			if(data.normalDifficulty <= diffMax) { maxPass = true; }
		}
		if(data.hardDifficulty != null) {
			if(data.hardDifficulty >= diffMin) { minPass = true; }
			if(data.hardDifficulty <= diffMax) { maxPass = true; }
		}
		if(data.expertDifficulty != null) {
			if(data.expertDifficulty >= diffMin) { minPass = true; }
			if(data.expertDifficulty <= diffMax) { maxPass = true; }
		}
		if(data.XDDifficulty != null) {
			if(data.XDDifficulty >= diffMin) { minPass = true; }
			if(data.XDDifficulty <= diffMax) { maxPass = true; }
		}

		if(!minPass && diffMin) {
			return {
				allow: false,
				reason: `requested song does not have a minimum difficulty rating of ${diffMin} in any charted difficulties`
			};
		}

		if(!maxPass && diffMax) {
			return {
				allow: false,
				reason: `requested song does not have a maximum difficulty rating of ${diffMax} in any charted difficulties`
			};
		}
	}

	return {
		allow: true,
		reason: ""
	};
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
	//let logger = runRequest.modules.logger;

	const chatter = (runRequest.parameters.useBotAccount ? "Bot" : "Streamer");

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

function normalizeDiffName(diff) {
	diff = diff.toLowerCase();

	switch(diff) {
		case "e":
		case "es":
		case "ez":
		case "eas":
		case "easy":
			return "Easy";
			break;

		case "n":
		case "no":
		case "nor":
		case "norm":
		case "norma":
		case "normal":
			return "Normal";
			break;

		case "h":
		case "ha":
		case "har":
		case "hard":
			return "Hard";
			break;

		case "ex":
		case "exp":
		case "expe":
		case "exper":
		case "expert":
		case "x":
			return "Expert";
			break;

		case "xd":
		case "x+":
		case "ex+":
		case "expert+":
			return "XD";
			break;
	}

	return null;
}

function run(runRequest) {
	//let logger = runRequest.modules.logger;

	const meta = runRequest.trigger.metadata;

	const chatter = (runRequest.parameters.useBotAccount ? "Bot" : "Streamer");

	const username = meta.username;
	const args = meta.userCommand.args;
	const trigger = meta.userCommand.trigger;

	const mention = (runRequest.parameters.MentionUsers ? `@${username} ` : "");

	let response = {success: true};
	if(!args.length) {
		return new Promise((resolve, reject) => { resolve(doChat(runRequest, `${mention}Use https://spinsha.re to find custom charts, then use "${trigger} ID#" in a chat message to request it! (the number at the end of the song URL)`)) });
	}

	let xdID = args[0];
	let suggestDiff = null;
	if(args.length >= 2) {
		suggestDiff = normalizeDiffName(args[1]);
	}

	let doSkip = function() {
		if(!(meta.chatMessage.isMod || meta.chatMessage.isBroadcaster)) {
			return new Promise((resolve, reject) => { resolve(); });
		}

		let queue = loadQueue(runRequest);

		if(!queue.length) {
			return new Promise((resolve, reject) => { resolve(doChat(runRequest, `${mention}Nothing is in queue!`)) });
		}

		let nextRow = queue.pop(0);
		let songData = nextRow.data;

		fs.writeFileSync("./SRXDQueue.json", JSON.stringify(queue));

		return new Promise((resolve, reject) => { resolve(doChat(runRequest, `${mention}Skipped ${songData.artist} - ${songData.title} (${songData.charter})`)) });
	}

	let doNext = function() {
		if(!meta.chatMessage.isBroadcaster) {
			return new Promise((resolve, reject) => { resolve(); });
		}

		let queue = loadQueue(runRequest);

		if(!queue.length) {
			fs.writeFileSync("./CurrentSRXDSong.json", "{}");
			return new Promise((resolve, reject) => { resolve(doChat(runRequest, `${mention}Nothing is in queue!`)) });
		}

		let nextRow = queue.splice(0, 1)[0];
		let songData = nextRow.data;

		fs.writeFileSync("./SRXDQueue.json", JSON.stringify(queue));
		fs.writeFileSync("./CurrentSRXDSong.json", JSON.stringify(songData));

		let SRXDFolder = runRequest.parameters.SRXDCustomsFolder;
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
					ws.close();
					fs.createReadStream('./temp.zip').pipe(unzipper.Extract({ path: SRXDFolder }));
				})

				resolve(doChat(runRequest, `${mention}Up next: ${songData.artist} - ${songData.title} (${songData.charter}) requested by @${nextRow.requester}${nextRow.suggestDiff != null ? ` (suggests ${nextRow.suggestDiff})` : ""}`));
			});
		} else {
			return new Promise((resolve, reject) => { resolve(doChat(runRequest, `Up next: ${songData.artist} - ${songData.title} (${songData.charter}) [${songData.id}] requested by @${nextRow.requester}${nextRow.suggestDiff != null ? ` (suggests ${nextRow.suggestDiff})` : ""}`)) });
		}
	}

	let doQueue = function() {
		let queue = loadQueue(runRequest);
		let lines = [];

		let maxLines = runRequest.parameters.QueueCommandAmount;

		if(!queue.length) {
			return new Promise((resolve, reject) => { resolve(doChat(runRequest, `${mention}Nothing is in queue!`)) });
		}

		for(let idx = 0; idx < (queue.length > maxLines ? maxLines : queue.length); idx++) {
			let nextRow = queue[idx];
			let songData = nextRow.data;

			lines.push(`#${idx+1}. ${songData.artist} - ${songData.title}${nextRow.suggestDiff != null ? ` (${nextRow.suggestDiff})` : ""}`);
		}

		return new Promise((resolve, reject) => { resolve(doChat(runRequest, `${mention}${lines.join(", ")}${queue.length > maxLines ? `, and ${queue.length-maxLines} more...` : ""}`)) });
	}

	let doDefault = function(fixedXDID) {
		if(isNaN(fixedXDID)) {
			return new Promise((resolve, reject) => { resolve(doChat(runRequest, `${mention}SpinShare ID must be numeric.`)) });
		}

		let opts = getAPIOpts(`song/${fixedXDID}`);

		return new Promise((resolve) => {
			const r = https.request(opts, res => {
				console.log("got here");

				res.on('data', d => {
					let parsed = JSON.parse(d);

					let songData = parsed.data;
					
					if(parsed.status === 200) {
						let queueData = addToQueue(runRequest, songData, suggestDiff);
						if(queueData.attempt.success) {
							let pd = new Date(songData.updateDate == null ? songData.uploadDate.date : songData.updateDate);
							let parsedDate = `${monthNames[pd.getMonth()]} ${pd.getYear()+1900}`;

							resolve(doChat(runRequest, `${mention}Queued ${songData.artist} - ${songData.title} (${songData.charter}) [${songData.id}] (${parsedDate}) successfully at position #${queueData.attempt.position}.`));
						} else {
							resolve(doChat(runRequest, `${mention}Could not queue ID ${songData.id}, ${queueData.attempt.reason}.`));
						}
					} else {
						resolve(doChat(runRequest, `${mention}Could not queue ID ${fixedXDID}, API status not 200.`));
					}
				});
			});
			r.end();
		})
	}

	let doClear = function() {
		if(!(meta.chatMessage.isBroadcaster || meta.chatMessage.isMod)) {
			return new Promise((resolve, reject) => { resolve(); });
		}

		fs.writeFileSync("./SRXDQueue.json", "[]");

		return new Promise((resolve, reject) => { resolve(doChat(runRequest, `${mention}The queue has been cleared!`)) });
	}

	let doLink = function() {
		let currentSong = loadCurrentSong(runRequest);

		if(!Object.keys(currentSong).length) {
			return new Promise((resolve, reject) => { resolve(doChat(runRequest, `${mention}Current song being played was not queued!`)) });
		}

		return new Promise((resolve, reject) => { resolve(doChat(runRequest, `${mention}Current song is ${currentSong.artist} - ${currentSong.title} (https://spinsha.re/song/${currentSong.id})`)) });
	}

	switch(xdID) {
		case "skip":
			return doSkip();
			break;

		case "next":
			return doNext();
			break;

		case "queue":
			return doQueue();
			break;

		case "clear":
			return doClear();
			break;

		case "link":
			return doLink();
			break;

		default:
			let parts = xdID.split("/");
			return doDefault(parts[parts.length-1]);
			break;
	}
}

function getScriptManifest() {
	return {
		name: "Spin Rhythm XD Request Manager",
		description: "Allows some control over chat requests (an in-game request manager would work MUCH better, but this will do in the meantime).",
		author: "TheBlackParrot",
		version: "0.2",
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
			MentionUsers: {
				type: "boolean",
				description: "Mention the user that triggered a command",
				default: false,
			},

			QueueLimit: {
				type: "number",
				description: "Limit the overall queue size",
				secondaryDescription: "(0 to disable)",
				default: 25
			},
			QueueLimitUser: {
				type: "number",
				description: "Limit the amount of songs the user can queue",
				secondaryDescription: "(0 to disable)",
				default: 1,
				showBottomHr: true
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
				default: 1,
				showBottomHr: true
			},

			DifficultyMinimum: {
				type: "number",
				description: "A difficulty rating of at least this number has to be charted",
				secondaryDescription: "(0 to disable)",
				default: 0
			},
			DifficultyMaximum: {
				type: "number",
				description: "A difficulty rating of at most this number has to be charted",
				secondaryDescription: "(0 to disable)",
				default: 0,
				showBottomHr: true
			},

			AgeMinimum: {
				type: "string",
				description: "Charts must be uploaded past this date",
				secondaryDescription: "(0 to disable, recommended to use a \"Month YYYY\" format [e.g. January 2020])",
				default: 0
			},

			QueueCommandAmount: {
				type: "number",
				description: "How many songs are allowed to appear in the queue subcommand?",
				default: 5
			},
		});
	});
}

exports.getScriptManifest = getScriptManifest;
exports.getDefaultParameters = getDefaultParameters;
exports.run = run;