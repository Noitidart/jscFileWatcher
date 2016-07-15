// DESIGN DECISION: Currently designed to be imported to mainthread AND ChromeWorker ( as GTK needs to be on mainthread - https://github.com/Noitidart/jscFileWatcher/issues/22 )

// Globals
var gDWImportsDone = false;
if (typeof(gBsComm) == 'undefined') { var gBsComm; }
if (typeof(callInBootstrap) == 'undefined') { var callInBootstrap; }

var gDWSessionId = Date.now() + '';
var gDWInstancesById = {};
var gDWNextId = 0;
var gDWPollerNextId = 0;
var gDWOSName = OS.Constants.Sys.Name.toLowerCase();
var gDWPollers = [];
// each element is an object:
	// {
	// 	worker: instance of comm server
	// 	callInPoller
	// }

var gDWActive = {};
/*
	path: {
		all
			watcherids: []
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

var DIRECTORYWATCHER_MAX_ACTIVE_PER_THREAD;
switch (gDWOSName) {
	case 'winnt':
	case 'winmo':
	case 'wince':
			DIRECTORYWATCHER_MAX_ACTIVE_PER_THREAD = 64;
		break;
	default:
		DIRECTORYWATCHER_MAX_ACTIVE_PER_THREAD = 50; // guess, as i dont know the os
}

function dwCallOsHandlerById(aArg) {
	// returns
		// true if anything triggered
		// false if nothing triggered - i think, by my design, this indicates error

	var { path, rest_args } = aArg;

	var path_entry = gDWActive[path];
	if (!path_entry) {
		console.error('how can path_info not be found? was it closed but this was a delayed receive?');
		throw new Error('how can path_info not be found? was it closed but this was a delayed receive?');
		return false;
	} else {
		if (!path_entry.watcherids.length) {
			console.error('how path be in gDWActive but not have any watcherids??? maybe delayed receive?');
			throw new Error('how path be in gDWActive but not have any watcherids??? maybe delayed receive?');
			return false;
		} else {
			for (var watcherid of path_entry.watcherids) {
				// console.log('watcherid:', watcherid);
				gDWInstancesById[watcherid].oshandler(path, ...rest_args);
			}
		}
	}
}

function dwPollerIniter(aPollerId) {
	console.log('initier, aPollerId:', aPollerId);
	var pipe_ptrstr = '0x0';

	switch (gDWOSName) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				// get poller by id
				var poller;
				for (var a_poller of gDWPollers) {
					if (a_poller.pollerid === aPollerId) {
						poller = a_poller;
						break;
					}
				}

				if (!poller) {
					console.error('could not get poller! this is horrible should never ever happen!');
					throw new Error('could not get poller! this is horrible should never ever happen!');
				}

				poller.pipe = ostypes.API('CreateEvent')(null, false, false, 'dirwatcher_event_' + gDWSessionId + poller.pollerid);
				console.log('poller.pipe:', poller.pipe);
				pipe_ptrstr = cutils.strOfPtr(poller.pipe);
				console.log('pipe_ptrstr:', pipe_ptrstr);

			break;
	}

	return { pipe_ptrstr };
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
		this.watcherid = gDWNextId++;
		gDWInstancesById[this.watcherid] = this;

		dwImportImportsIfMissing();
		this.devhandler = aCallback;

		// set MAX_WATCHING_CNT for pollers (windows, mac, inotify/android) - Gio on mainthread has no limit but i manually limit it
		this.MAX_WATCHING_CNT = 64; // https://bugzilla.mozilla.org/show_bug.cgi?id=958280#c42

		// watching collection
		this.watching_paths = {}; // key is path, value is object holding whatever info i need

		// set oshandler - oshandler is responsible for triggering aCallback (this.devhandler)
		switch (gDWOSName) {
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
	winHandler(aPath, dwNumberOfBytesTransfered, changes) {
		console.log('in mainworker winHandler:', 'aPath:', aPath, 'dwNumberOfBytesTransfered:', dwNumberOfBytesTransfered, 'changes:', changes);
		// path is the path of the directory that was watched

		if (this.closed) {
			console.warn('this watcher was closed so oshandler exiting');
			return;
		}

		// TODO: inform devhandler
	}
	gtkHandler(path, file, other_file, event_type) {
		// path is the path of the directory that was watched
		console.log('in gtkHandler', 'path:', path, 'file:', file, 'other_file:', other_file, 'event_type:', event_type);

		if (this.closed) {
			console.warn('this watcher was closed so oshandler exiting');
			return;
		}

		file = ostypes.TYPE.GFile.ptr(ctypes.UInt64(file));
		// other_file = ostypes.TYPE.GFile.ptr(ctypes.UInt64(other_file));
		event_type = parseInt(cutils.jscGetDeepest(event_type));

		// TODO: inform devhandler
	}
	macHandler(path) {
		// path is the path of the directory that was watched
		console.log('in macHandler', 'path:', path);

		if (this.closed) {
			console.warn('this watcher was closed so oshandler exiting');
			return;
		}

		// TODO: inform devhandler
	}
	andHandler(path) {
		// path is the path of the directory that was watched
		console.log('in andHandler', 'path:', path);

		if (this.closed) {
			console.warn('this watcher was closed so oshandler exiting');
			return;
		}

		// TODO: inform devhandler
	}
	addPath(aPath) {
		// returns
			// actually not yet - due to async nature // true - successfully removed
			// false - wasnt watching
			// undefined - error

		if (this.closed) {
			console.warn('this watcher was cleaned up');
			return;
		}

		var path_info = dwGetActiveInfo(aPath);
		if (path_info) {
			var path_entry = path_entry.entry;
			if (path_entry.watcherids.includes(this.watcherid)) {
				console.warn('THIS WATCHER is already watching aPath:', aPath);
				return false;
			} else {
				path_entry.watcherids.push(this.watcherid);
				return true;
			}
		} else {
			switch (gDWOSName) {
				case 'winnt':
				case 'winmo':
				case 'wince':

						// find available poller
						var poller;
						for (var a_poller of gDWPollers) {
							if (dwGetActiveCntByPollerId(a_poller.pollerid) < DIRECTORYWATCHER_MAX_ACTIVE_PER_THREAD) {
								poller = a_poller;
								break;
							}
						}

						if (!poller) {
							// none available so lets crate one
							poller = {
								pollerid: gDWPollerNextId++
							};
							poller.worker = new Comm.server.worker(directorywatcher_paths.watcher_dir + 'DirectoryWatcherPollWorker.js', dwPollerIniter.bind(null, poller.pollerid));
							poller.callInPoller = Comm.callInX.bind(null, poller.worker, null);
							gDWPollers.push(poller);
						}

						if (poller.pipe) {
							// trip it so it breaks the poll in worker
							ostypes.API('PulseEvent')(poller.pipe);
						}

						// if the worker is not yet started, this call to addPath will start it (and call the init)
						var watcherid = this.watcherid;
						poller.callInPoller('addPath', { aPath, aWatcherId:this.watcherid }, function(added) {
							// TODO: due to async, if something tries to add this path while this is running, it can cause issues. so i should handle this
							if (added) {
								gDWActive[aPath] = {
									watcherids: [watcherid],
									pollerid: poller.pollerid
								};
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
					var watcherid = this.watcherid;
					callInBootstrap('dwAddPath', { aPath }, function(added) {
						// TODO: due to async, if something tries to add this path while this is running, it can cause issues. so i should handle this
						if (added) {
							gDWActive[aPath] = {
								watcherids: [watcherid]
							};
						}
					});
			}
		}
	}
	removePath(aPath, aClosing) {
		// aClosing is programtic value, devuser should never set this

		// returns
			// actually not yet - due to async nature // true - successfully removed
			// false - wasnt watching
			// undefined - error

		if (!aClosing && this.closed) {
			console.warn('this watcher was cleaned up');
			return;
		}

		var path_info = dwGetActiveInfo(aPath);
		if (!path_info) {
			console.warn('cannot remove as NO WATCHER was ever watching aPath:', aPath);
			return false;
		}
		var path_entry = path_entry.entry;

		var ix_watcherid = path_entry.watcherids.indexOf(this.watcherid);
		if (ix_watcherid == -1) {
			console.warn('cannot remove as THIS WATCHER was never watching aPath:', aPath);
			return false;
		} else {
			path_entry.watcherids.splice(ix_watcherid, 1);
		}

		if (path_entry.watcherids.length) {
			switch (gDWOSName) {
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
					callInBootstrap('dwRemovePath', { aPath }, function(removed) {
						if (removed) {
							delete gDWActive[aPath];
						}
					});
			}
		}
	}
	close() {
		this.closed = true;

		var path_infos = dwGetPathInfos(this.watcherid);
		if (path_infos) {
			for (var path_info of path_infos) {
				this.removePath(path, true); // set aClosing to true, so removePath works even though this.closed was set
			}
		}
	}
}
if (OS && OS.File) {
	OS.File.DirectoryWatcher = DirectoryWatcher;
}

function dwGetActiveInfo(aBy) {
	// aBy
		// string - path - platform path of directory watched
		// int - signalid

	// returns
		// undefined if not found
		// `{path, entry}` where `entry` in `gDWActive` by reference

	if (typeof(aBy) == 'string') {
		return gDWActive[aBy];
	} else {
		for (var path in gDWActive) {
			var path_entry = gDWActive[path];
			if (path_entry.signalid === aBy) {
				return { path, entry:path_entry };
			}
		}
	}
}

function dwGetPathInfos(aWatcherId) {
	// returns
		// array if paths found that include aWatcherId
		// undefined if no paths found that include aWatcherId

	var path_infos = [];
	for (var path in gDWActive) {
		var path_entry = gDWActive[path];
		if (path_entry.watcherids.includes(aWatcherId)) {
			path_infos.push({
				path,
				path_entry
			});
		}
	}

	return path_infos;
}
function dwGetActiveCntByPollerId(aPollerId) {
	var cnt = 0;
	for (var path in gDWActive) {
		var path_entry = gDWActive[path];
		if (path_entry.pollerid === aPollerId) {
			cnt++;
		}
	}
	return cnt;
}
function dwImportImportsIfMissing() {
	if (gDWImportsDone) {
		return;
	}

	gDWImportsDone = true;

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
		switch (gDWOSName) {
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
