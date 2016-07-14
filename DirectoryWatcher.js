// DirectoryWatcher.js is meant to be imported to a ChromeWorker. You can import this to mainthread, however it will do the ctypes on the mainthread (except for polling)

var gDirectoryWatcherGlobal = this;
var gDirectoryWatcherImportsDone = false;

const isChromeWorker = () => (gDirectoryWatcherGlobal.DedicatedWorkerGlobalScope && gDirectoryWatcherGlobal.ctypes);

function importImportsIfMissing() {
	if (gDirectoryWatcherImportsDone) {
		return;
	}

	gDirectoryWatcherImportsDone = true;

	const importer = isChromeWorker() ? importScripts : function(path) { Services.scriptloader.loadSubScript(path, gDirectoryWatcherGlobal) };

	// Services.jsm
	if (!isChromeWorker() && typeof(Services) == 'undefined') {
		Cu.import('resource://gre/modules/Services.jsm');
	}

	// Import OS.File if not present
	if (typeof(OS) == 'undefined' || !OS.File) {
		if (isChromeWorker()) {
			importer('resource://gre/modules/osfile.jsm');
		} else {
			Cu.import('resource://gre/modules/osfile.jsm');
		}
	}

	// Import devuser defined paths
	importer('./DirectoryWatcherPaths.js');

	// Import Comm if not present
	if (typeof(Comm) == 'undefined') {
		importer(directorywatcher_paths.comm);
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
			default:
				// assume gtk based system OR android
				importer(directorywatcher_paths.ostypes_dir + 'ostypes_x11.jsm');
		}
	}
}

class DirectoryWatcher {
	constructor(aCallback) {
		/*
		aCallback called with these argumnets:
			aFilePath - i dont give just file name, because multiple directories can be being watched, so i give full os path
			aEventType - enum[ADDED, REMOVED, RENAMED, CONTENTS_MODIFIED]
			aExtra
				aExtra depends on aEventType
		*/

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
				this.oshandler_c = ostypes.TYPE.GFileMonitor_changed_signal(this.oshandler);
		}
	}
	winHandler() {

	}
	gtkHandler(monitor, file, other_file, event_type, user_data) {
		console.log('in gtkHandler', 'monitor:', monitor, 'file:', file, 'other_file:', other_file, 'event_type:', event_type, 'user_data:', user_data);

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
				var gfile = ostypes.API('g_file_new_for_path')(aPath);
			    console.log('gfile:', gfile);

				if (gfile.isNull()) {
			        console.error('failed to create gfile for path:', path);
			        throw new Error('failed to create gfile for path: ' + path);
			    }

				var mon = ostypes.API('g_file_monitor_directory')(gfile, ostypes.CONST.G_FILE_MONITOR_NONE, null, null);
				console.log('mon:', mon);

				ostypes.API('g_object_unref')(gfile);

				if (mon.isNull()) {
			        console.error('failed to create dirwatcher for path:', path);
			        throw new Error('failed to create dirwatcher for path: ' + path);
			    }

				var id = ostypes.API('g_signal_connect_data')(mon, 'changed', this.oshandler_c, null, null, 0);
				console.log('id:', id);


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
