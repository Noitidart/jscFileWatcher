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
	//	pipe
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

var SYSTEM_HAS_INOTIFY; // set to true on gtk systems if inotify is available. else sets to false

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

	var init_data;
	switch (gDWOSName) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				init_data = {};

				// get poller by id
				var poller_entry = dwGetPollerEntryById(aPollerId);

				if (!poller_entry) {
					console.error('could not get poller_entry! this is horrible should never ever happen!');
					throw new Error('could not get poller_entry! this is horrible should never ever happen!');
				}

				poller_entry.pipe = ostypes.API('CreateEvent')(null, false, false, 'dirwatcher_event_' + gDWSessionId + poller_entry.pollerid);
				console.log('poller_entry.pipe:', poller_entry.pipe);
				var pipe_ptrstr = cutils.strOfPtr(poller_entry.pipe);
				console.log('pipe_ptrstr:', pipe_ptrstr);

				init_data.pipe_ptrstr = pipe_ptrstr;

			break;
		case 'darwin':
				// do nothing
			break;
		case 'android':
		default:
			// android and gtk systems

			init_data = {};

			var poller_entry = dwGetPollerEntryById(aPollerId);
			if (!poller_entry) {
				console.error('could not get poller_entry! this is horrible should never ever happen!');
				throw new Error('could not get poller_entry! this is horrible should never ever happen!');
			}

			var pipefd = ostypes.TYPE.int.array(2)();
			var rez_pipe = ostypes.API('pipe')(pipefd);
			console.log('rez_pipe:', rez_pipe);
			if (cutils.jscEqual(rez_pipe, -1)) {
				console.error('failed to create pipem, errno:', ctypes.errno);
				throw new Error('failed to create pipem, errno: ' + ctypes.errno);
			}

			poller_entry.pipe_read = parseInt(cutils.jscGetDeepest(pipefd[0]));
			poller_entry.pipe_write = parseInt(cutils.jscGetDeepest(pipefd[1]));

			init_data.pipe_read = poller_entry.pipe_read;

	}

	return init_data;
}

function dwPollAfterInit(aPollerId, aArg) {
	var poller_entry = dwGetPollerEntryById(aPollerId);

	switch (gDWOSName) {
		case 'darwin':

				var { runloop_ptrstr } = aArg;
				poller_entry.runloop = ostypes.TYPE.CFRunLoopRef(ctypes.UInt64(runloop_ptrstr));

			break;
	}
}

function dwShutdown() {
	var deferredmain_dwshutdown = new Deferred();

	var promiseAllArr_close = [];

	for (var watcherid in gDWInstancesById) {
		var dwinst = gDWInstancesById[watcherid];
		promiseAllArr_close.push(dwinst.close());
	}

	var promiseAll_close = Promise.all(promiseAllArr_close);
	promiseAll_close.then(function(rez_close_arr) {

		// actually yes this is neeeded, because remotePath sets a timer for 10sec to see if the poller is still empty before terminating so disregard this comment --> // no need for this, as removePath takes care of terminating them
		// if any pollers, terminate them
		if (gDWPollers.length) {
			if (['winnt', 'wince', 'winmo', 'darwin'].includes(gDWOSName)) {
				setTimeoutSync(1000); // in my tests if i terminate pollers soon after the last APC is cancelled (deferred_cancel resolves) in winRoutine it crashes, so thats why i do a 1sec wait here
			}
			for (var a_poller of gDWPollers) {
				console.log('unregistering poller with pollerid:', a_poller.pollerid);
				a_poller.worker.unregister();
			}
		}

		if (rez_close_arr.includes(undefined)) {
			// closed but not all paths removed
			deferredmain_dwshutdown.resolve(undefined);
		} else {
			deferredmain_dwshutdown.resolve(true);
		}
	});

	return deferredmain_dwshutdown.promise;
}

function DirectoryWatcher(aCallback) {
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
				this.oshandler = function(path, dwNumberOfBytesTransfered, changes) {
					// path is the path of the directory that was watched
					console.log('in mainworker winHandler:', 'path:', path, 'dwNumberOfBytesTransfered:', dwNumberOfBytesTransfered, 'changes:', changes);

					if (this.closed) {
						console.warn('this watcher was closed so oshandler exiting');
						return;
					}

					// TODO: inform devhandler
				};
			break;
		case 'darwin':
				this.oshandler = function(path) {
					// path is the path of the directory that was watched
					console.log('in macHandler', 'path:', path);

					if (this.closed) {
						console.warn('this watcher was closed so oshandler exiting');
						return;
					}

					// TODO: inform devhandler
				}
			break;
		case 'android':
				this.oshandler = function(path) {
					// path is the path of the directory that was watched
					console.log('in andHandler', 'path:', path);

					if (this.closed) {
						console.warn('this watcher was closed so oshandler exiting');
						return;
					}

					// TODO: inform devhandler
				}
			break;
		default:
			// assume gtk based system
			this.oshandler = function(path, file, other_file, event_type) {
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
	}

	// this.addPath, removePath, close
	this.addPath = function(aPath) {
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
			console.log('path_info:', path_info);
			var path_entry = path_info.entry;
			if (path_entry.watcherids.includes(this.watcherid)) {
				console.warn('THIS WATCHER is already watching aPath:', aPath);
				return false;
			} else {
				path_entry.watcherids.push(this.watcherid);
				return true;
			}
		} else {

			var watcherid = this.watcherid;

			// if this platform need a poller worker, then find/make available poller
			var poller_entry;
			var poller_added_cb;
			switch (gDWOSName) {
				case 'winnt':
				case 'winmo':
				case 'wince':
				case 'darwin':
				case 'android':

						// find available poller
						for (var a_poller of gDWPollers) {
							if (dwGetActiveCntByPollerId(a_poller.pollerid) < DIRECTORYWATCHER_MAX_ACTIVE_PER_THREAD) {
								poller_entry = a_poller;
								break;
							}
						}

						if (!poller_entry) {
							// none available so lets crate one
							poller_entry = {
								pollerid: gDWPollerNextId++
							};
							poller_entry.worker = new Comm.server.worker(directorywatcher_paths.watcher_dir + 'DirectoryWatcherPollWorker.js', dwPollerIniter.bind(null, poller_entry.pollerid), dwPollAfterInit.bind(null, poller_entry.pollerid));
							poller_entry.callInPoller = Comm.callInX.bind(null, poller_entry.worker, null);
							gDWPollers.push(poller_entry);
						}

						poller_added_cb = function(added) {
							// TODO: think about this: POSSIBLY due to async, if something tries to add this path while this is running, it can cause issues. so i should handle this link383899
							if (added) {
								gDWActive[aPath] = {
									watcherids: [watcherid],
									pollerid: poller_entry.pollerid
								};
							}
						};

					break;
			}

			// platform specific add of path
			switch (gDWOSName) {
				case 'winnt':
				case 'winmo':
				case 'wince':

						if (poller_entry.pipe) {
							// trip it so it breaks the poll in worker
							ostypes.API('PulseEvent')(poller_entry.pipe);
						}

						// if the worker is not yet started, this call to addPath will start it (and call the init)
						poller_entry.callInPoller('addPath', { aPath, aWatcherId:this.watcherid }, poller_added_cb);

					break;
				case 'darwin':

						if (poller_entry.runloop) {
							// trip it so it breaks the poll in worker
							ostypes.API('CFRunLoopStop')(poller_entry.runloop);
						}

						poller_entry.callInPoller('addPath', { aPath, aWatcherId:this.watcherid }, poller_added_cb);

					break;
				case 'android':

						if (poller_entry.pipe_write) {
							// trip it so it breaks the poll in worker
							console.error('tripping pipe now');
							ostypes.API('write')(poller_entry.pipe_write, ctypes.char(3).address(), 1);
						}

						poller_entry.callInPoller('addPath', { aPath, aWatcherId:this.watcherid }, poller_added_cb);

					break;
				default:
					// assume gtk based system
					var watcherid = this.watcherid;
					callInBootstrap('dwAddPath', { aPath }, function(added) {
						// TODO: think about this: POSSIBLY due to async, if something tries to add this path while this is running, it can cause issues. so i should handle this link383899
						if (added) {
							gDWActive[aPath] = {
								watcherids: [watcherid]
							};
						}
					});
			}
		}
	}
	this.removePath = function(aPath, aClosing) {
		// aClosing is programtic value, devuser should never set this

		// returns promise that resolves to
			// true - successfully removed
			// false - wasnt watching
			// undefined - error

		var deferredmain_removepath = new Deferred();

		console.log('in removePath, aPath:', aPath);

		if (!aClosing && this.closed) {
			console.warn('error: this watcher was cleaned up');
			deferredmain_removepath.resolve(undefined);
		} else {

			var path_info = dwGetActiveInfo(aPath);
			if (!path_info) {
				console.warn('error: cannot remove as not even ANY WATCHER is watching aPath:', aPath);
				deferredmain_removepath.resolve(undefined);
			} else {
				console.log('path_info:', path_info);
				var path_entry = path_info.entry;

				var ix_watcherid = path_entry.watcherids.indexOf(this.watcherid);
				if (ix_watcherid == -1) {
					console.warn('error: cannot remove as THIS WATCHER is not watching aPath:', aPath);
					deferredmain_removepath.resolve(undefined);
				} else {
					path_entry.watcherids.splice(ix_watcherid, 1);
					console.log('ok spliced from watcherids:', path_entry.watcherids);
				}

				if (!path_entry.watcherids.length) {
					// no watcherid is watching this path so remove it
					console.log('no watcherid is watching this path so remove it');

					var removed_callback = function(removed) {
						console.log('result of removePath in caller, removed:', removed);
						if (removed) {
							// no longer watching so remove from gDWActive
							delete gDWActive[aPath];

							// if poller, then test if should destroy it
							if (path_entry.pollerid !== undefined) { // as pollerid might be 0
								// this platform uses a poller worker
								setTimeout(dwTerminatePollerIfEmpty.bind(null, path_entry.pollerid), 10000); // if no paths added back within 10sec, then terminate it
							}
						}
						deferredmain_removepath.resolve(removed);
					};

					switch (gDWOSName) {
						case 'winnt':
						case 'winmo':
						case 'wince':

								var poller_entry = dwGetPollerEntryById(path_entry.pollerid);
								ostypes.API('PulseEvent')(poller_entry.pipe);
								console.log('calling removePath in poller');
								poller_entry.callInPoller('removePath', { aPath }, removed_callback);

							break;
						case 'darwin':

								var poller_entry = dwGetPollerEntryById(path_entry.pollerid);
								ostypes.API('CFRunLoopStop')(poller_entry.runloop);
								console.log('calling removePath in poller');
								poller_entry.callInPoller('removePath', { aPath }, removed_callback);

							break;
						case 'android':
								//
							break;
						default:
							// assume gtk based system
							callInBootstrap('dwRemovePath', { aPath }, removed_callback);
					}
				}
			}
		}
		return deferredmain_removepath.promise;
	}
	this.close = function() {
		// returns promise which resolve with
			// true - when all paths removed
			// undefiend - if all paths not removed
		var deferredmain_close = new Deferred();
		this.closed = true;
		var watcherid = this.watcherid;

		var promiseAllArr_remove = [];
		var path_infos = dwGetPathInfos(watcherid);
		if (path_infos) {
			for (var path_info of path_infos) {
				promiseAllArr_remove.push(this.removePath(path_info.path, true)); // set aClosing to true, so removePath works even though this.closed was set
			}
		}

		var promiseAll_remove = Promise.all(promiseAllArr_remove);
		promiseAll_remove.then(function(rez_remove_arr) {

			delete gDWInstancesById[watcherid];

			if (rez_remove_arr.includes(false) || rez_remove_arr.includes(undefined)) {
				// not all of them succesfully removed
				deferredmain_close.resolve(undefined);
			} else {
				console.log('ok succesfully closed watcher with watcherid:', watcherid);
				deferredmain_close.resolve(true);
			}

		});
		return deferredmain_close.promise;
	}

}
if (OS && OS.File) {
	OS.File.DirectoryWatcher = DirectoryWatcher;
}

function dwTerminatePollerIfEmpty(aPollerId) {
	var poller_entry = dwGetPollerEntryById(aPollerId);

	if (!poller_entry) {
		// no longer exists. probably gets here when i terminate all pollers on dwShutdown after 1sec. but wait no, on dwShutdown i terminate this whole MainWorker after dwShutdown. so it may never get here. so this is just a precaution.
		return;
	}

	if (!dwGetActiveCntByPollerId(aPollerId)) {
		// this poller is not watching anything anymore, so destroy it
		console.log('destroying poller with pollerid:', aPollerId);
		// no need for a ostypes.API('PulseEvent')() because if there ano more paths then the `poll` in the worker would not have been restarted by the `removePath` method in the worker

		// release the pipe
		switch (gDWOSName) {
			case 'winnt':
			case 'winmo':
			case 'wince':
					var rez_pipeclosed = ostypes.API('CloseHandle')(poller_entry.pipe);
					console.log('rez_pipeclosed:', rez_pipeclosed);
				break;
			case 'darwin':
					//
				break;
			case 'android':
					var rez_piperead_closed = ostypes.API('close')(poller_entry.pipe_read);
					if (cutils.jscEqual(rez_piperead_closed, -1)) {
						console.error('failed to rez_piperead_closed, errno:', ctypes.errno);
					}

					var rez_pipewrite_closed = ostypes.API('close')(poller_entry.pipe_write);
					if (cutils.jscEqual(rez_pipewrite_closed, -1)) {
						console.error('failed to rez_pipewrite_closed, errno:', ctypes.errno);
					}

				break;
			default:
				// assume gtk based system
		}

		// destroy it
		poller_entry.worker.unregister();
		dwRemovePollerEntryById(aPollerId);
		console.log('destroyed poller with pollerid:', aPollerId);
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


function dwRemovePollerEntryById(aPollerId) {
	// returns
		// true - when it was found and removed
		// false - not found

	var l = gDWPollers.length;
	for (var i=0; i<l; i++) {
		var poller_entry = gDWPollers[i];
		if (poller_entry.pollerid === aPollerId) {
			gDWPollers.splice(i, 1);
			return true;
		}
	}
	return false;
}
function dwGetPollerEntryById(aPollerId) {
	for (var poller of gDWPollers) {
		if (poller.pollerid === aPollerId) {
			return poller;
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

	// test if system has inotify
	try {
		ostypes.API('inotify_init');
		SYSTEM_HAS_INOTIFY = true;
		gDWOSName = 'android'; // froce inotify on gtk systems that have it
	} catch (ex) {
		SYSTEM_HAS_INOTIFY = false;
		console.error('does not have inotify, ex:', ex);
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
function setTimeoutSync(aMilliseconds) {
	var breakDate = Date.now() + aMilliseconds;
	while (Date.now() < breakDate) {}
}
// end - common helper functions
