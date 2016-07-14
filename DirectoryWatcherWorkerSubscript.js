// DESIGN DECISION: Currently designed to be imported to mainthread AND ChromeWorker ( as GTK needs to be on mainthread - https://github.com/Noitidart/jscFileWatcher/issues/22 )

// Globals
var gDirectoryWatcherImportsDone = false;
if (typeof(gBsComm) == 'undefined') { var gBsComm; }
if (typeof(callInBootstrap) == 'undefined') { var callInBootstrap; }

function importImportsIfMissing() {
	if (gDirectoryWatcherImportsDone) {
		return;
	}

	gDirectoryWatcherImportsDone = true;

	const importer = importScripts;


	// Import OS.File if not present
	if (typeof(OS) == 'undefined' || !OS.File) {
		importer('resource://gre/modules/osfile.jsm');
	}

	// Import devuser defined paths
	importer('./DirectoryWatcherPaths.js');

	// Import Comm if not present
	if (typeof(Comm) == 'undefined') {
		importer(directorywatcher_paths.comm);
	}

	if (!callInBootstrap) {
		callInBootstrap = CommHelper.mainworker.callInBootstrap;
	}

	if (!gBsComm) {
		gBsComm = new Comm.client.worker();
	}

	// Import ostypes
	if (typeof(ostypes) == 'undefined') {
		importer(directorywatcher_paths.ostypes_dir + 'cutils.jsm');
		importer(directorywatcher_paths.ostypes_dir + 'ctypes_math.jsm');
		switch (OS.Constants.Sys.Name.toLowerCase()) {
			case 'winnt':
			case 'winmo':
			case 'wince':
					importer(directorywatcher_paths.ostypes_dir + 'ostypes_win.jsm');
				break
			case 'darwin':
					importer(directorywatcher_paths.ostypes_dir + 'ostypes_mac.jsm');
				break;
			case 'android':
					importer(directorywatcher_paths.ostypes_dir + 'ostypes_x11.jsm');
				break;
			default:
				// assume gtk
				// actually i think do need it, so disregard comment --> // // ostypes not needed as it is on the mainthread
				importer(directorywatcher_paths.ostypes_dir + 'ostypes_x11.jsm');
		}
	}
}

function DirectoryWatcherCallOsHandlerById(aArg) {
	var { id, handler_args } = aArg;
	// id is undefined if gtk
	if (id === undefined) {
		// id is in user_data
		var user_data = parseInt(cutils.jscGetDeepest(ctypes.uint16_t.ptr(ctypes.UInt64(handler_args[4]))));
		id = handler_args[4] = user_data;
		console.log('user_data:', user_data, 'id:', id, 'handler_args[4]:', handler_args[4]);
	}
	DirectoryWatcherById[id].oshandler(...handler_args);
}

var DirectoryWatcherById = {};
var DirectoryWatcherNextId = 0;
class DirectoryWatcher {
	constructor(aCallback) {
		/*
		aCallback called with these argumnets:
			aFilePath - i dont give just file name, because multiple directories can be being watched, so i give full os path
			aEventType - enum[ADDED, REMOVED, RENAMED, CONTENTS_MODIFIED]
			aExtra
				aExtra depends on aEventType
		*/
		this.watcherid = DirectoryWatcherNextId++;
		DirectoryWatcherById[this.watcherid] = this;

		importImportsIfMissing();
		this.devhandler = aCallback;
		this.osname = OS.Constants.Sys.Name.toLowerCase();

		// set oshandler - oshandler is responsible for triggering aCallback (this.devhandler)
		switch (this.osname) {
			case 'winnt':
			case 'winmo':
			case 'wince':
					this.oshandler = this.winHandler;
				break;
			case 'darwin':
					this.oshandler = this.macHandler;
				break;
			case 'android':
					this.oshandler = this.andHandler;
				break;
			default:
				// assume gtk based system
				this.oshandler = this.gtkHandler;
		}
	}
	winHandler() {

	}
	gtkHandler(monitor, file, other_file, event_type, user_data) {
		console.log('in gtkHandler', 'monitor:', monitor, 'file:', file, 'other_file:', other_file, 'event_type:', event_type, 'user_data:', user_data);
		// monitor = ostypes.TYPE.GFileMonitor.ptr(ctypes.UInt64(monitor));
		file = ostypes.TYPE.GFile.ptr(ctypes.UInt64(file));
		// other_file = ostypes.TYPE.GFile.ptr(ctypes.UInt64(other_file));
		event_type = parseInt(cutils.jscGetDeepest(event_type));
	}
	macHandler() {

	}
	andHandler() {

	}
	addPath(aPath) {
		switch (this.osname) {
			case 'winnt':
			case 'winmo':
			case 'wince':
					//
				break;
			case 'darwin':
					//
				break;
			case 'android':
					//
				break;
			default:
				// assume gtk based system

				// var gfile = ostypes.API('g_file_new_for_path')(aPath);
			    // console.log('gfile:', gfile);
				//
				// if (gfile.isNull()) {
			    //     console.error('failed to create gfile for path:', path);
			    //     throw new Error('failed to create gfile for path: ' + path);
			    // }
				//
				// var mon = ostypes.API('g_file_monitor_directory')(gfile, ostypes.CONST.G_FILE_MONITOR_NONE, null, null);
				// console.log('mon:', mon);
				//
				// ostypes.API('g_object_unref')(gfile);
				//
				// if (mon.isNull()) {
			    //     console.error('failed to create dirwatcher for path:', path);
			    //     throw new Error('failed to create dirwatcher for path: ' + path);
			    // }
				//
				// var id = ostypes.API('g_signal_connect_data')(mon, 'changed', this.oshandler_c, null, null, 0);
				// console.log('id:', id);
				callInBootstrap('DirectoryWatcherGtkAddPath', { aPath, aWatcherId:this.watcherid });
		}
	}
	removePath(aPath) {
		switch (this.osname) {
			case 'winnt':
			case 'winmo':
			case 'wince':
					//
				break;
			case 'darwin':
					//
				break;
			case 'android':
					//
				break;
			default:
				// assume gtk based system
				callInBootstrap('DirectoryWatcherGtkRemovePath', { aPath, aWatcherId:this.watcherid });
		}
	}
	close() {
		switch (this.osname) {
			case 'winnt':
			case 'winmo':
			case 'wince':
					//
				break;
			case 'darwin':
					//
				break;
			case 'android':
					//
				break;
			default:
				// assume gtk based system
				callInBootstrap('DirectoryWatcherGtkClose', { aWatcherId:this.watcherid });
		}
	}
}
if (OS && OS.File) {
	OS.File.DirectoryWatcher = DirectoryWatcher;
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
// end - common helper functions
