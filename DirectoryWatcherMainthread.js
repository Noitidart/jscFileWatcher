// MUST import this on mainthread with `Services.scriptloader.loadSubScript('xxxxx/xxx/DirectoryWatcherMainthread.js');`

// Globals
var gDWImportsDone = false;
var callInDWWorker;
var dwGtkHandler_c;
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

function dwMainthreadInit(aCommServer_VarStr) {
	// aCommServer_VarStr is a var or a str if a instance of new Comm.worker.server. if str, the thing must be global.
	if (!aCommServer_VarStr) {
		throw new Error('MUST provide aCommServer_VarStr!');
	}

	if (typeof(Comm) == 'undefined') {
		throw new Error('How on earth can you provie aCommServer_VarStr without having imported Comm?? You are doing things wrong. Make sure to import Comm and pass correct string to here!');
	}

	callInDWWorker = Comm.callInX.bind(null, aCommServer_VarStr, null);
}

function dwGtkHandler(monitor, file, other_file, event_type, user_data) {
	console.log('in dwGtkHandler', 'monitor:', monitor, 'file:', file, 'other_file:', other_file, 'event_type:', event_type, 'user_data:', user_data);

	var signalid = ctypes.cast(user_data, ctypes.uint16_t.ptr).contents;
	var path_info = dwGetActiveInfo(signalid);
	if (!path_info) {
		console.error('how can path_info not be found? was it closed but this was a delayed receive?');
	} else {
		var path = path_info.path;
		callInDWWorker('dwCallOsHandlerById', {
			path,
			rest_args: [cutils.strOfPtr(file), cutils.strOfPtr(other_file), event_type]
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

	dwImportImportsIfMissing();

	var path_info = dwGetActiveInfo(aPath);
	if (path_info) {
		console.warn('already watching aPath:', aPath);
		return false;
	}
	var path_entry = path_entry.entry;

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

	var signalerid = ostypes.API('g_signal_connect_data')(mon, 'changed', dwGtkHandler_c, ctypes.cast(watcher_entry.data.watcherid_c.address(), ctypes.voidptr_t), null, 0);
	console.log('signalerid:', signalerid);
	signalerid = parseInt(cutils.jscGetDeepest(signalerid));
	if (signalerid === 0) {
		console.error('failed to connect dirwatcher to signaler for aPath:', aPath);
		return undefined;
	}

	gDWActive[aPath] = { signalerid, mon };
	console.log('ok watching aPath:', aPath);

	return true;
}

function dwShutdownMT() {
	var deferredmain_dwshutdownmt = new Deferred();
	callInDWWorker('dwShutdown', undefined, function() {
		console.log('worker dwShutdown completed, so mainthread dwShutdownMT resolving');
		deferredmain_dwshutdownmt.resolve();
	});
	return deferredmain_dwshutdownmt.promise;
}

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

	var { mon, signalerid } = path_entry;
	ostypes.API('g_signal_handler_disconnect')(mon, signalerid);
	ostypes.API('g_object_unref')(mon);

	delete gDWActive[aPath];

	console.log('stopped watching aPath:', aPath);

	return true;
}

function dwImportImportsIfMissing() {
	if (gDWImportsDone) {
		return;
	}
	console.log('in mainthread dwImportImportsIfMissing');

	gDWImportsDone = true;

	// const importer = function(path) { Services.scriptloader.loadSubScript(path) };
	const importer = Services.scriptloader.loadSubScript;

	// Services.jsm
	importServicesJsm();

	const osname = Services.appinfo.OS.toLowerCase();

	// Import ostypes for GTK only
	if (typeof(ostypes) == 'undefined') {
		switch (osname) {
			case 'winnt':
			case 'winmo':
			case 'wince':
			case 'darwin':
			case 'android':
					// dont import ostypes
				break;
			default:
				// assume gtk

				// Import ctypes
				if (typeof(ctypes) == 'undefined') {
					Cu.import('resource://gre/modules/ctypes.jsm');
				}

				// relative path import doesnt work from bootstrap
				// // Import devuser defined paths
				// importer('../DirectoryWatcherPaths.js');
				// console.log('directorywatcher_paths:', directorywatcher_paths);

				// Import ostypes
				importer(directorywatcher_paths.ostypes_dir + 'cutils.jsm');
				// importer(directorywatcher_paths.ostypes_dir + 'ctypes_math.jsm');
				importer(directorywatcher_paths.ostypes_dir + 'ostypes_x11.jsm');
		}
	}
	console.log('imports done');

	// Setup globals
	switch (osname) {
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
}

function importServicesJsm() {
	if (!this.DedicatedWorkerGlobalScope && typeof(Services) == 'undefined') {
		if (typeof(Cu) == 'undefined') {
			if (typeof(Components) != 'undefined') {
				// Bootstrap
				var { utils:Cu } = Components;
			} else if (typeof(require) != 'undefined') {
				// Addon SDK
				var { Cu } = require('chrome');
			} else {
				console.warn('cannot import Services.jsm');
			}
		}
		if (typeof(Cu) != 'undefined') {
			Cu.import('resource://gre/modules/Services.jsm');
		}
	}
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
