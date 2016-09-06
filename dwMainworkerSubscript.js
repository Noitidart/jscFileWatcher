// DESIGN DECISION: Currently designed to be imported to mainthread AND ChromeWorker ( as GTK needs to be on mainthread - https://github.com/Noitidart/jscFileWatcher/issues/22 )
/* globals callInBootstrap, ostypes, Comm, dwPathWatcherDir, OS.Constants */

if (typeof(Comm) == 'undefined') throw new Error('You must have imported `Comm` before getting here!');
if (typeof(ostypes) == 'undefined') throw new Error('You must have imported `ostypes` before getting here!');
if (typeof(callInBootstrap) == 'undefined') throw new Error('You must have imported `callInBootstrap` from `CommHelper` before getting here!');
if (typeof(dwPathWatcherDir) == 'undefined') throw new Error('You must have defined `dwPathWatcherDir` to be the path to the directory containing the "watcher" module before getting here!');
if (typeof(OS) == 'undefined') throw new Error('You must have imported `OS` before getting here!');
if (typeof(OS.Constants) == 'undefined') throw new Error('You must have imported `OS.Constants` before getting here!');
if (typeof(OS.Path) == 'undefined') throw new Error('You must have imported `OS.Path` before getting here!');

// Globals
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
const gDW_FILE_EVENT_FLAGS = {
	gtk: ['G_FILE_MONITOR_EVENT_CHANGED', 'G_FILE_MONITOR_EVENT_CHANGES_DONE_HINT', 'G_FILE_MONITOR_EVENT_DELETED', 'G_FILE_MONITOR_EVENT_CREATED', 'G_FILE_MONITOR_EVENT_ATTRIBUTE_CHANGED', 'G_FILE_MONITOR_EVENT_PRE_UNMOUNT', 'G_FILE_MONITOR_EVENT_UNMOUNTED', 'G_FILE_MONITOR_EVENT_MOVED', 'G_FILE_MONITOR_EVENT_RENAMED', 'G_FILE_MONITOR_EVENT_MOVED_IN', 'G_FILE_MONITOR_EVENT_MOVED_OUT'],
	win: ['FILE_ACTION_ADDED', 'FILE_ACTION_REMOVED', 'FILE_ACTION_MODIFIED', 'FILE_ACTION_RENAMED_OLD_NAME', 'FILE_ACTION_RENAMED_NEW_NAME'],
	mac:  ['kFSEventStreamEventFlagNone', 'kFSEventStreamEventFlagMustScanSubDirs', 'kFSEventStreamEventFlagUserDropped', 'kFSEventStreamEventFlagKernelDropped', 'kFSEventStreamEventFlagEventIdsWrapped', 'kFSEventStreamEventFlagHistoryDone', 'kFSEventStreamEventFlagRootChanged', 'kFSEventStreamEventFlagMount', 'kFSEventStreamEventFlagUnmount', 'kFSEventStreamEventFlagItemCreated', 'kFSEventStreamEventFlagItemRemoved', 'kFSEventStreamEventFlagItemInodeMetaMod', 'kFSEventStreamEventFlagItemRenamed', 'kFSEventStreamEventFlagItemModified', 'kFSEventStreamEventFlagItemFinderInfoMod', 'kFSEventStreamEventFlagItemChangeOwner', 'kFSEventStreamEventFlagItemXattrMod', 'kFSEventStreamEventFlagItemIsFile', 'kFSEventStreamEventFlagItemIsDir', 'kFSEventStreamEventFlagItemIsSymlink'],
	inotify: ['IN_ACCESS', 'IN_MODIFY', 'IN_ATTRIB', 'IN_CLOSE_WRITE', 'IN_CLOSE_NOWRITE', 'IN_OPEN', 'IN_MOVED_FROM', 'IN_MOVED_TO', 'IN_CREATE', 'IN_DELETE', 'IN_DELETE_SELF', 'IN_MOVE_SELF', 'IN_UNMOUNT', 'IN_Q_OVERFLOW', 'IN_IGNORED', 'IN_ONLYDIR', 'IN_DONT_FOLLOW', 'IN_MASK_ADD', 'IN_ISDIR', 'IN_ONESHOT']
};
var gDWStuff = {
	possrename: {} // used by inotify
};

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
switch (gDWOSName) {
	case 'winnt':
	case 'winmo':
	case 'wince':
	case 'darwin':
	case 'android':
			// do nothing
		break;
	default:
		// assume gtk
		try {
			ostypes.API('inotify_init');
			SYSTEM_HAS_INOTIFY = true;
			gDWOSName = 'android'; // froce inotify on gtk systems that have it // DEBUG
		} catch (ex) {
			SYSTEM_HAS_INOTIFY = false;
			console.error('does not have inotify, ex:', ex);
		}
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

				poller_entry.pipe = ostypes.API('CreateEvent')(null, true, false, 'dirwatcher_event_' + gDWSessionId + poller_entry.pollerid);
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
			// init_data.GTK_VERSION = GTK_VERSION; // uses the global core.os.toolkit or TOOLKIT or toolkit to calculate this

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
		aFilePath - i dont give just file name, because multiple directories can be being watched, so i give full os path. so it is OS.Path.join(path to dir being watched, filename that was affected)
		aEventType - enum[ADDED, REMOVED, RENAMED, CONTENTS_MODIFIED]
		aOldFileName - only set if aEventType was "RENAMED"
	*/
	this.watcherid = gDWNextId++;
	gDWInstancesById[this.watcherid] = this;

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
				this.oshandler = function(path, event) {
					// path is the path of the directory that was watched
					console.log('in andHandler', 'path:', path, 'event:', event);

					if (this.closed) {
						console.warn('this watcher was closed so oshandler exiting');
						return;
					}

					var myflags = [];
					for (var flag of gDW_FILE_EVENT_FLAGS.inotify) {
						if (event.mask & ostypes.CONST[flag]) {
							myflags.push(flag);
						}
					}
					console.log('myflags:', myflags);

					// anything in subdir of watched dir - NO EVENTS - good
					// moved to trash dir - [ "IN_MOVED_FROM", "IN_ISDIR" ]
					// created new dir - [ "IN_CREATE", "IN_ISDIR" ]
					// moved dir to unwatched dir - Array [ "IN_MOVED_FROM", "IN_ISDIR" ]
					// moved dir to watched dir - same as moving to unwatched dir line above
					// created new doc - [ "IN_CREATE" ]
					// renamed doc - [ "IN_MOVED_FROM" ] - name is old name, cookie is 123
						// renamed doc - [ "IN_MOVED_TO" ] - name is new name, cookie is 123
					// moved in doc (want to see how to diff when not rename) - no diff, cookie is not 0 as i was hoping, will have to do back to back technique
					// moved out doc (want to see how to diff when not rename) - no diff, cookie is not 0 as i was hoping, will have to do back to back technique
					// write non-atomic to doc - Array [ "IN_MODIFY" ]
					// delete with OS.File.remove doc - [ "IN_DELETE" ]

					if (!event.name) {
						console.warn('no name!');
						return;
					}

					var filepath = OS.Path.join(path, event.name);
					var eventtype;
					var oldfilename;
					if (event.mask & ostypes.CONST.IN_CREATE) {
						eventtype = 'ADDED';
					} else if (event.mask & ostypes.CONST.IN_MOVED_TO) {
						if (gDWStuff.possrename[event.cookie]) {
							clearTimeout(gDWStuff.possrename[event.cookie].timeout);
							oldfilename = gDWStuff.possrename[event.cookie].event.name;
							var time_movedfrom = gDWStuff.possrename[event.cookie].time_movedfrom;
							var time_torename = Date.now() - time_movedfrom;
							console.warn('time_torename:', time_torename);
							delete gDWStuff.possrename[event.cookie];
							eventtype = 'RENAMED';
						} else {
							eventtype = 'ADDED';
						}
					} else if (event.mask & ostypes.CONST.IN_MOVED_FROM) {
						gDWStuff.possrename[event.cookie] = {
							event,
							time_movedfrom: Date.now(),
							triggerRemoved: () => {
								delete gDWStuff.possrename[event.cookie];
								eventtype = 'REMOVED';
								console.log('ok dispatching as REMOVED as no IN_MOVE_FROM came in for 200ms, this.devhandler:', this.devhandler);
								this.devhandler(filepath, eventtype, oldfilename);
							},
							timeout: setTimeout(()=>gDWStuff.possrename[event.cookie].triggerRemoved(), 200) // if another event does not come in for 200ms, then dipsach this to `devhandler` as `eventtype` `ADDED`
						};
						return;
					} else if (event.mask & ostypes.CONST.IN_DELETE) {
						eventtype = 'REMOVED';
					} else if (event.mask & ostypes.CONST.IN_MODIFY) {
						eventtype = 'CONTENTS_MODIFIED';
					} else {
						console.error('none of the flags i expected are on this, flags are:', myflags);
						return;
					}

					if (eventtype) {
						this.devhandler(filepath, eventtype, oldfilename);
					}
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

				var myflags = [];
				for (var flag of gDW_FILE_EVENT_FLAGS.gtk) {
					if (event_type & ostypes.CONST[flag]) {
						myflags.push(flag);
					}
				}

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
							poller_entry.worker = new Comm.server.worker(dwPathWatcherDir + 'dwPollWorker.js', dwPollerIniter.bind(null, poller_entry.pollerid), dwPollAfterInit.bind(null, poller_entry.pollerid));
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
							ostypes.API('SetEvent')(poller_entry.pipe);
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
								ostypes.API('SetEvent')(poller_entry.pipe);
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

								var poller_entry = dwGetPollerEntryById(path_entry.pollerid);
								ostypes.API('write')(poller_entry.pipe_write, ctypes.char(4).address(), 1);
								poller_entry.callInPoller('removePath', { aPath }, removed_callback);

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
