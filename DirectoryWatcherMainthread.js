// MUST import this on mainthread with `Services.scriptloader.loadSubScript('xxxxx/xxx/DirectoryWatcherMainthread.js');`
//
var gDirectoryWatcherImportsDone = false;
var gDirectoryWatcherGlobal = this;

var callInDirectoryWatcherWorker;
function DirectoryWatcherMainthreadInit(aCommServer_VarStr) {
	// aCommServer_VarStr is string of the global variable that is a instance of new Comm.worker.server
	if (!aCommServer_VarStr) {
		throw new Error('MUST provide aCommServer_VarStr!');
	}

	if (typeof(Comm) == 'undefined') {
		throw new Error('How on earth can you provie aCommServer_VarStr without having imported Comm?? You are doing things wrong. Make sure to import Comm and pass correct string to here!');
	}

	callInDirectoryWatcherWorker = Comm.callInX.bind(null, aCommServer_VarStr, null);
}

var DirectoryWatcherGtkHandler_c;
function DirectoryWatcherGtkHandler(monitor, file, other_file, event_type, user_data) {
	console.log('in DirectoryWatcherGtkHandler', 'monitor:', monitor, 'file:', file, 'other_file:', other_file, 'event_type:', event_type, 'user_data:', user_data);

	callInDirectoryWatcherWorker('DirectoryWatcherCallOsHandlerById', {
		handler_args: [cutils.strOfPtr(monitor), cutils.strOfPtr(file), cutils.strOfPtr(other_file), event_type, cutils.strOfPtr(user_data)]
	});
};

var DirectoryWatcherGtkPathMonIdCollection = {}; // key is path, value is object {id, mon}
function DirectoryWatcherGtkAddPath(aArg) {
	var { aPath, aWatcherId } = aArg;
	console.log('aWatcherId:', aWatcherId);

	importImportsIfMissing();

	var watcher_entry = DirectoryWatcherGtkPathMonIdCollection[aWatcherId];
	if (!watcher_entry) {
		watcher_entry = DirectoryWatcherGtkPathMonIdCollection[aWatcherId] = {
			data: {
				watcherid_c: ctypes.uint16_t(aWatcherId)
			},
			paths: {}
		};
	}
	if (watcher_entry.paths[aPath]) {
		console.warn('already watching aPath:', aPath);
		return;
	}

	// assume gtk based system
	var gfile = ostypes.API('g_file_new_for_path')(aPath);
	console.log('gfile:', gfile);

	if (gfile.isNull()) {
		console.error('failed to create gfile for aPath:', aPath);
		throw new Error('failed to create gfile for aPath: ' + aPath);
	}

	var mon = ostypes.API('g_file_monitor_directory')(gfile, ostypes.CONST.G_FILE_MONITOR_NONE, null, null);
	console.log('mon:', mon);

	ostypes.API('g_object_unref')(gfile);

	if (mon.isNull()) {
		console.error('failed to create dirwatcher for aPath:', aPath);
		throw new Error('failed to create dirwatcher for aPath: ' + aPath);
	}

	var signalerid = ostypes.API('g_signal_connect_data')(mon, 'changed', DirectoryWatcherGtkHandler_c, ctypes.cast(watcher_entry.data.watcherid_c.address(), ctypes.voidptr_t), null, 0);
	console.log('signalerid:', signalerid);
	signalerid = parseInt(cutils.jscGetDeepest(signalerid));
	if (signalerid === 0) {
		console.error('failed to connect dirwatcher to signaler for aPath:', aPath);
		throw new Error('failed to connect dirwatcher to signaler for aPath: ' + aPath);
	}

	watcher_entry.paths[aPath] = { signalerid, mon };
	console.log('ok watching aPath:', aPath);
}

function DirectoryWatcherGtkRemovePath(aArg) {
	var { aPath, aWatcherId } = aArg;
	var watcher_entry = DirectoryWatcherGtkPathMonIdCollection[aWatcherId];
	if (!watcher_entry || !watcher_entry.paths[aPath]) {
		console.warn('was not watching aPath:', aPath);
		return;
	}

	var path_entry = watcher_entry.paths[aPath];

	var { mon, signalerid } = path_entry;
	ostypes.API('g_signal_handler_disconnect')(mon, id);
	ostypes.API('g_object_unref')(mon);
	delete DirectoryWatcherGtkPathMonIdCollection[aWatcherId].paths[aPath];
	console.log('stopped watching aPath:', aPath);
}
function DirectoryWatcherGtkClose(aArg) {
	var { aWatcherId } = aArg;
	var watcher_entry = DirectoryWatcherGtkPathMonIdCollection[watcher_entry];
	if (!watcher_entry) {
		console.warn('cannot close this watcher id as it was never opened, meaning it wasnt watching anything');
		return;
	}

	for (var path in watcher_entry.paths) {
		DirectoryWatcherGtkRemovePath(path, aWatcherId);
	}

	delete DirectoryWatcherGtkPathMonIdCollection[watcher_entry];
}

function importImportsIfMissing() {
	if (gDirectoryWatcherImportsDone) {
		return;
	}
	console.log('in mainthread importImportsIfMissing');

	gDirectoryWatcherImportsDone = true;

	// const importer = function(path) { Services.scriptloader.loadSubScript(path, gDirectoryWatcherGlobal) };
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
	DirectoryWatcherGtkHandler_c = ostypes.TYPE.GFileMonitor_changed_signal(DirectoryWatcherGtkHandler);
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
