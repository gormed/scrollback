/* jshint browser: true */

var core, config, store, gcmTimeValidity = 7 * 24 * 60 * 60 * 1000,
	updateDevice = false,
	appUtils = require("../lib/app-utils.js");

module.exports = function(c, conf, st) {
	var LS = window.localStorage,
		lastGCMTime, device;
	core = c;
	config = conf;
	store = st;

	lastGCMTime = LS.getItem("lastGCMTime");
	lastGCMTime = lastGCMTime ? parseInt(lastGCMTime) : 0;

	core.on("boot", function(state, next) {
		console.log(state.context.env, lastGCMTime, (new Date().getTime() - gcmTimeValidity), lastGCMTime < (new Date().getTime() - gcmTimeValidity));
		if (state.context.env === "android" && lastGCMTime < (new Date().getTime() - gcmTimeValidity)) {

			if (window.Android && typeof window.Android.registerGCM === "function") {
				window.Android.registerGCM();
			}

			window.addEventListener("gcm_register", function(event) {
				console.log("got device details", event);
				device = event.detail;
				updateDevice = true;
				if (store.get("app", "connectionStatus") === "online") {
					saveUser();
				}
			});
		}
		next();
	}, 100);

	function saveUser() {
		var userObj = store.getUser(), uuid;

		if (!userObj.id || appUtils.isGuest(userObj.id)) return;

		if (!userObj.params) userObj.params = {};
		if (!userObj.params.pushNotifications) userObj.params.pushNotifications = {};
		if (!userObj.params.pushNotifications.devices || typeof userObj.params.pushNotifications.devices.length == "number") {
			userObj.params.pushNotifications.devices = {};
		}

		device.expiryTime = new Date().getTime() + gcmTimeValidity;
		uuid = device.uuid;

		device.platform = "android";
		userObj.params.pushNotifications.devices[device.uuid] = device;
		delete device.uuid;
		device.enabled = true;

		console.log("emitting user-up.", userObj);
		core.emit("user-up", {
			user: userObj,
			to: "me"
		}, function() {
			LS.setItem("lastGCMTime", new Date().getTime());
			LS.setItem("currentDevice", uuid);
			updateDevice = false;
		});
	}

	core.on("statechange", function(changes, next) {
		if (changes.user && device && updateDevice) {
			saveUser();
		}
		next();
	}, 500);

	core.on("logout", function(payload, next) {
		if (store.get("context", "env") === "android" && typeof window.Android.unregisterGCM === "function") {
			window.Android.unregisterGCM();
			localStorage.removeItem("lastGCMTime");
			localStorage.removeItem("currentDevice");
		}
		next();
	}, 500);
};
