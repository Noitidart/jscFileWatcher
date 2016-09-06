// MUST import this on mainthread with `Services.scriptloader.loadSubScript('xxxxx/xxx/dwMainthreadSubscript.js');`
/* globals ostypes, Services, Comm, callInMainworker */

if (typeof(Comm) == 'undefined') throw new Error('You must have imported `Comm` before getting here!');
if (typeof(ostypes) == 'undefined') throw new Error('You must have imported `ostypes` before getting here!');
if (typeof(Services) == 'undefined') throw new Error('You must have imported `Services` before getting here!');
if (typeof(callInMainworker) == 'undefined') throw new Error('You must have imported `callInMainworker` from `CommHelper` before getting here!');

// Globals
var dwGtkHandler_c;
var gDWNextSignalId = 0;
var gDWActive = {};
/*
	path: {
		all
			...
		win
			...
		mac
			...
		gio
			...
		inotify
			...
	}
*/

// Setup globals
switch (Services.appinfo.OS.toLowerCase()) {
	case 'winnt':
	case 'winmo':
	case 'wince':
	case 'darwin':
	case 'android':
			// nothing
		break;
	default:
		// assume gtk
		dwGtkHandler_c = ostypes.TYPE.GFileMonitor_changed_signal(dwGtkHandler);
}

function dwGtkHandler(monitor, file, other_file, event_type, user_data) {
	// https://developer.gnome.org/gio/stable/GFileMonitor.html#GFileMonitorEvent

	console.log('in dwGtkHandler', 'monitor:', monitor, 'file:', file, 'other_file:', other_file, 'event_type:', event_type, 'user_data:', user_data);

	var signalid = parseInt(ctypes.cast(user_data, ctypes.uint16_t.ptr).contents);
	var path_info = dwGetActiveInfo(signalid);
	if (!path_info) {
		console.error('how can path_info not be found? was it closed but this was a delayed receive?');
	} else {
		var path = path_info.path;

		var filepath = ostypes.API('g_file_get_path')(file);
		// console.log('filepath:', filepath);
		// console.log('filepath.readString:', filepath.readString());
		var _filepath = filepath.readString();
		ostypes.API('g_free')(filepath);

		var _otherfilepath;
		if (!other_file.isNull()) {
			var otherfilepath = ostypes.API('g_file_get_path')(file);
			// console.log('otherfilepath:', otherfilepath);
			// console.log('otherfilepath.readString:', otherfilepath.readString());
			_otherfilepath = otherfilepath.readString();
			ostypes.API('g_free')(otherfilepath);
		}

		var _event = {
			filepath: _filepath,
			otherfilepath: _otherfilepath,
			event_type: parseInt(event_type) // im not sure if this is uint32_t but it seems like from my tests
		};
		callInMainworker('dwCallOsHandlerById', {
			path,
			rest_args: [_event]
		});
	}
};

function dwAddPath(aArg) {
	// gio only


	// returns
		// true - successfully added
		// false - already there
		// undefined - error

	var { aPath } = aArg;

	var path_info = dwGetActiveInfo(aPath);
	if (path_info) {
		console.warn('already watching aPath:', aPath);
		return false;
	}

	// assume gtk based system
	var gfile = ostypes.API('g_file_new_for_path')(aPath);
	console.log('gfile:', gfile);

	if (gfile.isNull()) {
		console.error('failed to create gfile for aPath:', aPath);
		return undefined;
	}

	var mon = ostypes.API('g_file_monitor_directory')(gfile, ostypes.CONST.G_FILE_MONITOR_NONE, null, null);
	console.log('mon:', mon);

	ostypes.API('g_object_unref')(gfile);

	if (mon.isNull()) {
		console.error('failed to create dirwatcher for aPath:', aPath);
		return undefined;
	}

	var signalid = gDWNextSignalId++;
	var signalid_c = ctypes.uint16_t(signalid);
	var connectionid = ostypes.API('g_signal_connect_data')(mon, 'changed', dwGtkHandler_c, ctypes.cast(signalid_c.address(), ctypes.voidptr_t), null, 0);
	console.log('connectionid:', connectionid);

	if (cutils.jscEqual(connectionid, 0)) {
		console.error('failed to connect dirwatcher to signaler for aPath:', aPath);
		return undefined;
	}

	gDWActive[aPath] = {
		connectionid,
		mon,
		signalid,
		signalid_c
	};
	console.log('ok watching aPath:', aPath);

	return true;
}

// function dwShutdownMT() {
	// var deferredmain_dwshutdownmt = new Deferred();
	// callInMainworker('dwShutdown', undefined, function() {
	// 	console.log('worker dwShutdown completed, so mainthread dwShutdownMT resolving');
	// 	deferredmain_dwshutdownmt.resolve();
	// });
	// return deferredmain_dwshutdownmt.promise;
// }

function dwRemovePath(aArg) {
	// gio only

	// returns
		// true - successfully removed
		// false - wasnt there
		// undefined - error

	var { aPath } = aArg;

	var path_info = dwGetActiveInfo(aPath);
	if (!path_info) {
		console.warn('was not watching aPath:', aPath);
		return false;
	}
	var path_entry = path_info.entry;

	var { mon, connectionid } = path_entry;
	ostypes.API('g_signal_handler_disconnect')(mon, connectionid);
	ostypes.API('g_object_unref')(mon);

	delete gDWActive[aPath];

	console.log('stopped watching aPath:', aPath);

	return true;
}

function dwGetActiveInfo(aBy) {
	// aBy
		// string - path - platform path of directory watched
		// int - signalid

	// returns
		// undefined if not found
		// `{path, entry}` where `entry` in `gDWActive` by reference

	if (typeof(aBy) == 'string') {
		if (!gDWActive[aBy]) {
			return undefined;
		} else {
			return { path:aBy, entry:gDWActive[aBy] };
		}
	} else {
		for (var path in gDWActive) {
			var path_entry = gDWActive[path];
			if (path_entry.signalid === aBy) {
				return { path, entry:path_entry };
			}
		}
	}
}

// start - common helper functions
function Deferred() {
	this.resolve = null;
	this.reject = null;
	this.promise = new Promise(function(resolve, reject) {
		this.resolve = resolve;
		this.reject = reject;
	}.bind(this));
	Object.freeze(this);
}
function genericReject(aPromiseName, aPromiseToReject, aReason) {
	var rejObj = {
		name: aPromiseName,
		aReason: aReason
	};
	console.error('Rejected - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
function genericCatch(aPromiseName, aPromiseToReject, aCaught) {
	var rejObj = {
		name: aPromiseName,
		aCaught: aCaught
	};
	console.error('Caught - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
