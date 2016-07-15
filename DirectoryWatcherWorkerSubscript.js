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
	var { watcherid, handler_args } = aArg;
	// watcherid is undefined if gtk
	if (watcherid === undefined) {
		// watcherid is in user_data
		var user_data = parseInt(cutils.jscGetDeepest(ctypes.uint16_t.ptr(ctypes.UInt64(handler_args[4]))));
		watcherid = handler_args[4] = user_data;
		console.log('user_data:', user_data, 'watcherid:', watcherid, 'handler_args[4]:', handler_args[4]);
	}
	DirectoryWatcherById[watcherid].oshandler(...handler_args);
}

var DirectoryWatcherPollerIniter = function(aPollerId) {
	console.log('initier, aPollerId:', aPollerId);
	var pipe_ptrstr = '0x0';

	switch (OS.Constants.Sys.Name.toLowerCase()) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				// get poller by id
				for (var poller of DirectoryWatcherPollers) {
					if (poller.pollerid === aPollerId) {
						break;
					}
				}

				// poller.pipe = ostypes.API('CreateNamedPipe')('\\\\.\\pipe\\dirwatcher' + DirectoryWatcherSessionId + poller.pollerid, ostypes.CONST.PIPE_ACCESS_DUPLEX | ostypes.CONST.FILE_FLAG_OVERLAPPED, ostypes.CONST.PIPE_TYPE_BYTE, 1, 1, 1, 0, null);
				poller.pipe = ostypes.API('CreateEvent')(null, false, false, 'dirwatcher_event_' + DirectoryWatcherSessionId + poller.pollerid);
				console.log('poller.pipe:', poller.pipe);
				pipe_ptrstr = cutils.strOfPtr(poller.pipe);
				console.log('pipe_ptrstr:', pipe_ptrstr);

			break;
	}

	return { pollerid:aPollerId, sessionid:DirectoryWatcherSessionId, pipe_ptrstr };
};

var DirectoryWatcherSessionId = Date.now() + '';
var DirectoryWatcherById = {};
var DirectoryWatcherNextId = 0;
var DirectoryWatcherPollers = [];
var DirectoryWatcherPollerNextId = 0;
// each element is an object:
	// {
	// 	worker: instance of comm server
	// 	callInPoller
	// 	watching_cnt - increment when addPath, decrement when removePath, when count hits 0, it is terminated if nothing is added to it within 10sec
	// }
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

		// set MAX_WATCHING_CNT for pollers (windows, mac, inotify/android) - Gio on mainthread has no limit but i manually limit it
		this.MAX_WATCHING_CNT = 64; // https://bugzilla.mozilla.org/show_bug.cgi?id=958280#c42

		// watching collection
		this.watching_paths = {}; // key is path, value is object holding whatever info i need

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
	winHandler(dwNumberOfBytesTransfered, notif_buf, aPath) {
		console.log('in mainworker winHandler:', dwNumberOfBytesTransfered, notif_buf, aPath);
		// aPath is the path of the directory that was watched

		// TODO: inform devhandler
	}
	gtkHandler(monitor, file, other_file, event_type, user_data) {
		if (this.closed) {
			console.warn('this watcher was cleaned up');
			return;
		}
		console.log('in gtkHandler', 'monitor:', monitor, 'file:', file, 'other_file:', other_file, 'event_type:', event_type, 'user_data:', user_data);
		// monitor = ostypes.TYPE.GFileMonitor.ptr(ctypes.UInt64(monitor));
		file = ostypes.TYPE.GFile.ptr(ctypes.UInt64(file));
		// other_file = ostypes.TYPE.GFile.ptr(ctypes.UInt64(other_file));
		event_type = parseInt(cutils.jscGetDeepest(event_type));

		// TODO: inform devhandler
	}
	macHandler() {

	}
	andHandler() {

	}
	addPath(aPath) {
		if (this.closed) {
			console.warn('this watcher was cleaned up');
			return;
		}
		// on success add path to this.watching_paths
		switch (this.osname) {
			case 'winnt':
			case 'winmo':
			case 'wince':

					// find available poller
					var poller;
					for (var a_poller of DirectoryWatcherPollers) {
						if (a_poller.watching_cnt < this.MAX_WATCHING_CNT) {
							poller = a_poller;
							break;
						}
					}

					if (!poller) {
						// none available so lets crate one
						poller = {
							pollerid: DirectoryWatcherPollerNextId++,
							watching_cnt: 0
						};
						poller.worker = new Comm.server.worker(directorywatcher_paths.watcher_dir + 'DirectoryWatcherPollWorker.js', DirectoryWatcherPollerIniter.bind(null, poller.pollerid));
						poller.callInPoller = Comm.callInX.bind(null, poller.worker, null);
						DirectoryWatcherPollers.push(poller);
					}

					if (poller.pipe) {
						// trip it so it breaks the poll in worker
						ostypes.API('PulseEvent')(poller.pipe);
					}

					// if the worker is not yet started, this call to addPath will start it (and call the init)
					poller.callInPoller('addPath', { aPath, aWatcherId:this.watcherid }, function(aArg) {
						var successfully_added = aArg;
						if (successfully_added) {
							poller.watching_cnt++;
						}
					});

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
		if (this.closed) {
			console.warn('this watcher was cleaned up');
			return;
		}
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
				this.closed = true;
				callInBootstrap('DirectoryWatcherGtkClose', { aWatcherId:this.watcherid }, function() {
					delete DirectoryWatcherById[id];
				});
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
