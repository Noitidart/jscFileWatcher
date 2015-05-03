// Imports
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import('resource://gre/modules/devtools/Console.jsm');
Cu.import('resource://gre/modules/osfile.jsm');
Cu.import('resource://gre/modules/Promise.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

// Lazy Imports
const myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'hph', function () { return Cc['@mozilla.org/network/protocol;1?name=http'].getService(Ci.nsIHttpProtocolHandler); });
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'global.properties?' + Math.random()); /* Randomize URI to work around bug 719376 */ });

// Globals
const core = {
	addon: {
		name: 'jscFileWatcher',
		id: 'jscFileWatcher@jetpack',
		path: {
			content: 'chrome://jscfilewatcher/content/',
			locale: 'chrome://jscfilewatcher/locale/'
		}
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase()
	}
};

var PromiseWorker;
var pathsSplitterStr = '/////////'; // i use this as joiner as `/////////` is disallowed on winnt, linux, and darwin, in file names, im pretty sure

////// end of imports and definitions
var watcher1;
function main() {
	var callback_logPath = function(aFileName, aEvent, aExtra) {
		// aExtra, on all os'es should hold:
			// aFileNameOld when aEvent is renamed :todo:
			// aOSPath_parentDir - OS path of the directory containing aFileName // this is needed because what if user added multiple directories to one Watcher :todo:
		// aExtra can container other os specific stuff
		// aEvent is a string, or if user passed in options.masks and the event that happend is not one of the strings below, then its a number returned by the OS
			// created
			// deleted
			// renamed (renamed-to and renamed-from?)
			// contents-modified
		console.log('callback_logPath triggered', 'aEvent:', aEvent, 'aFileName:', aFileName, 'aExtra:', aExtra);
	};
	watcher1 = new Watcher(callback_logPath);
	var promise_removeSomePath = watcher1.removePath('blah'); //test1 - remove non-added path before Watcher closes
	var promise_watcher1_addpath = watcher1.addPath(OS.Constants.Path.desktopDir);
	//var promise_removeSomePath = watcher1.removePath(OS.Constants.Path.desktopDir); //test2 - remove existing path before Watcher closes
	/*
	//start test3 - remove existing path after watcher closes
	Services.wm.getMostRecentWindow(null).setTimeout(function() {
		var promise_removeSomePath = watcher1.removePath(OS.Constants.Path.desktopDir);
		promise_removeSomePath.then(
		  function(aVal) {
			console.log('Fullfilled - promise_removeSomePath - ', aVal);
			// start - do stuff here - promise_removeSomePath
			// end - do stuff here - promise_removeSomePath
		  },
		  function(aReason) {
			var rejObj = {name:'promise_removeSomePath', aReason:aReason};
			console.error('Rejected - promise_removeSomePath - ', rejObj);
			//deferred_createProfile.reject(rejObj);
		  }
		).catch(
		  function(aCaught) {
			var rejObj = {name:'promise_removeSomePath', aCaught:aCaught};
			console.error('Caught - promise_removeSomePath - ', rejObj);
			//deferred_createProfile.reject(rejObj);
		  }
		);
	}, 1000);
	//end test3
	*/
	/*
	//start test4 - remove a non-existing path after watcher close
	Services.wm.getMostRecentWindow(null).setTimeout(function() {
		var promise_removeSomePath = watcher1.removePath('blah');
		promise_removeSomePath.then(
		  function(aVal) {
			console.log('Fullfilled - promise_removeSomePath - ', aVal);
			// start - do stuff here - promise_removeSomePath
			// end - do stuff here - promise_removeSomePath
		  },
		  function(aReason) {
			var rejObj = {name:'promise_removeSomePath', aReason:aReason};
			console.error('Rejected - promise_removeSomePath - ', rejObj);
			//deferred_createProfile.reject(rejObj);
		  }
		).catch(
		  function(aCaught) {
			var rejObj = {name:'promise_removeSomePath', aCaught:aCaught};
			console.error('Caught - promise_removeSomePath - ', rejObj);
			//deferred_createProfile.reject(rejObj);
		  }
		);
	}, 1000);
	//end test4
	*/
	
	// these promises are not required, but its just nice to do it, in case an error hapens, especially as im in dev mode it may be throwing a bunch of .catch
	// i placed the promise_watcher1_addpath .then first because i want to make sure that watcher1.promise_initialized resolves first
	promise_watcher1_addpath.then(
	  function(aVal) {
		console.log('Fullfilled - promise_watcher1_addpath - ', aVal);
		// start - do stuff here - promise_watcher1_addpath
		// end - do stuff here - promise_watcher1_addpath
	  },
	  function(aReason) {
		var rejObj = {name:'promise_watcher1_addpath', aReason:aReason};
		console.error('Rejected - promise_watcher1_addpath - ', rejObj);
		//deferred_createProfile.reject(rejObj);
	  }
	).catch(
	  function(aCaught) {
		var rejObj = {name:'promise_watcher1_addpath', aCaught:aCaught};
		console.error('Caught - promise_watcher1_addpath - ', rejObj);
		//deferred_createProfile.reject(rejObj);
	  }
	);
	watcher1.promise_initialized.then(
	  function(aVal) {
		console.log('Fullfilled - watcher1.promise_initialized - ', aVal);
		// start - do stuff here - watcher1.promise_initialized
		// end - do stuff here - watcher1.promise_initialized
	  },
	  function(aReason) {
		var rejObj = {name:'watcher1.promise_initialized', aReason:aReason};
		console.error('Rejected - watcher1.promise_initialized - ', rejObj);
		//deferred_createProfile.reject(rejObj);
	  }
	).catch(
	  function(aCaught) {
		var rejObj = {name:'watcher1.promise_initialized', aCaught:aCaught};
		console.error('Caught - watcher1.promise_initialized - ', rejObj);
		//deferred_createProfile.reject(rejObj);
	  }
	);
	///* for test1 and test2
	promise_removeSomePath.then(
	  function(aVal) {
		console.log('Fullfilled - promise_removeSomePath - ', aVal);
		// start - do stuff here - promise_removeSomePath
		// end - do stuff here - promise_removeSomePath
	  },
	  function(aReason) {
		var rejObj = {name:'promise_removeSomePath', aReason:aReason};
		console.error('Rejected - promise_removeSomePath - ', rejObj);
		//deferred_createProfile.reject(rejObj);
	  }
	).catch(
	  function(aCaught) {
		var rejObj = {name:'promise_removeSomePath', aCaught:aCaught};
		console.error('Caught - promise_removeSomePath - ', rejObj);
		//deferred_createProfile.reject(rejObj);
	  }
	);
	//*/
	
}

// start - OS.File.Watcher API
var FSWatcherWorker;
var _FSWatcherWorker_start_already_triggered = false;
function _FSWatcherWorker_start() {
	// returns promise
	var deferredMain_FSWatcherWorker_start = new Deferred();
	
	if (!FSWatcherWorker) {
		FSWatcherWorker = new PromiseWorker(core.addon.path.content + 'modules/workers/FSWatcherWorker.js');
		
		var objCore = { // holds stuff to add to core object in worker
			os: {
				name: core.os.name,
				version: core.os.version, // exists for winnt and darwin, for others its undefined
				version_name: core.os.version_name, // for winnt
				toolkit: core.os.toolkit
			},
			firefox: {
				//version: core.firefox.version // i dont use this for jscFileWatcher
			}
		};
		
		var promise_initWorker = initWorkerCore(FSWatcherWorker, objCore);
		promise_initWorker.then(
			function(aVal) {
				console.log('Fullfilled - promise_initWorker - ', aVal);
				// start - do stuff here - promise_initWorker
				deferredMain_FSWatcherWorker_start.resolve(true);
				// end - do stuff here - promise_initWorker
			},
			function(aReason) {
				var rejObj = {name:'promise_initWorker', aReason:aReason};
				console.error('Rejected - promise_initWorker - ', rejObj);
				deferredMain_FSWatcherWorker_start.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_initWorker', aCaught:aCaught};
				console.error('Caught - promise_initWorker - ', rejObj);
				deferredMain_FSWatcherWorker_start.reject(rejObj);
			}
		);
		
	} else {
		deferredMain_FSWatcherWorker_start.resolve(true);
	}
	
	return deferredMain_FSWatcherWorker_start.promise;
	
}
var _Watcher_nextId = 0; // never decrement this
var _Watcher_UnterminatedFSWPollWorkers = {}; // used for termination on shutdown // key is aWatcherId and value is the FSWPollWorker reference
function Watcher(aCallback) {
	// returns prototype object, meaning whenever this function is called it should be called like `let watcher = new OS.File.Watcher(callback)`
	// if user wants to know if it was succesfully initalized they can do this:
	/*
		let watcher = new OS.File.Watcher(callback)
		watcher.promise_initialized.then(onFulfill, onReject).catch(onCatch);
	*/
	// dev user can do watcher.addPath/watcher.removePath before waiting for promise_initialized, as they return promises, those promise will just return after execution after initialization
	var thisW = this;
	if (!aCallback || typeof aCallback != 'function') {
		throw new Error('The argument aCallback is not a function. It must be a function, which optionally takes three arguments: first is aOSPath, second is aEvent, and thrid is aExtra which has some os specific stuff.');
	}
	
	thisW.id = _Watcher_nextId;
	_Watcher_nextId++; // so its available to next one
	
	thisW.readyState = 0;
	// readyState's
		// 0 - uninintialized
		// 1 - initialized, ready to do addPaths // when i change readyState to 1, i should check if any paths to add are in queue
		// 2 - closed due to user calling Watcher.prototype.close
		// 3 - closed due to failed to initialize
	thisW.cb = aCallback;
	/*
	thisW.cbQueue = []; //array of functions that pass the args from worker to the aCallback
	
	thisW.timerEvent_triggerCallback = {
		notify: function() {
			thisW.cbQueue.shift()();
		}
	};
	thisW.timer = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);
	*/
	
	//thisW.paths_watched = []; // array of cased OS paths (as inputed by devuser) that are being watched
	thisW.paths_watched = {}; // changed to obj as its easier to delete
	/* OS Specific Values on thisW.paths_watched
	 * // linux/inotify
	 *    i use this to link a callback to aOSPath_parentDir, as value is set to the watched_fd
	 *    :todo: ask p0lip if i need to close this descriptor on thisW.close()
	 * // windows
	 *    //Value holds string pointer of the hDirectory which is handle to the directory, on thisW.close() this handle must be closed
	 *    Never mind, value is not used
	 * // kqueue
	 *    Value is not used
	 *    :todo: ask p0lip if i need to close descriptor on thisW.close() but i think i wont have to put it here as i hold it already in the array struct
	 */
	
	thisW.pendingAdds = {}; // object with key aOSPath
	thisW.adds_pendingAddC = {}; // as if user calls removePath while the c is running, it will think that path was never added
	thisW.removes_pendingAddC = {};
	
	// todo: work on handling pendingRemoveC ie: thisW.adds_pendingRemoveC and thisW.removes_pendingRemoveC
	
	thisW.pollBeingManaged = false;
	
	var deferred_initialized = new Deferred();
	thisW.promise_initialized = deferred_initialized.promise;
	
	
	// logic:
		// ensure FSWatcherWorker is started
			// then ensure thisW.FSWPollWorker is created
				// then create watcher c side
		// after all 3 done then resolve deferred_initialized
		
	var deferred_createWatcher = new Deferred();
	var deferred_ensureWatcherWorker = new Deferred();
	var deferred_startWatchersPollWorker = new Deferred();
	
	var promiseAllArr_watcherBasis = [
		deferred_createWatcher.promise,
		deferred_ensureWatcherWorker.promise,
		deferred_startWatchersPollWorker.promise
	];
	
	var promiseAll_watcherBasis = Promise.all(promiseAllArr_watcherBasis);
	promiseAll_watcherBasis.then(
	  function(aVal) {
		console.log('Fullfilled - promiseAll_watcherBasis - ', aVal);
		// start - do stuff here - promiseAll_watcherBasis
		deferred_initialized.resolve(true);
		// end - do stuff here - promiseAll_watcherBasis
	  },
	  function(aReason) {
		thisW.readyState = 3;
		// run through the waiting adds, they are functions which will reject the pending deferred's with .message saying "closed due to readyState 3" as initialization failed
		for (var pendingAdd in thisW.pendingAdds) {
			thisW.pendingAdds[pendingAdd].addIt();
			// i dont care to delete thisW.pendingAdds[pendingAdd] because i only iterate it once, and thats init, and btw i do set thisW.pendingAdds to null at the end of this for loop (i do this as its uneeded stuff, so maybe save like some bytes of memory haha)
		}
		thisW.pendingAdds = null;
		
		var rejObj = {name:'promiseAll_watcherBasis', aReason:aReason};
		console.warn('Rejected - promiseAll_watcherBasis - ', rejObj);
		deferred_initialized.reject(rejObj);
	  }
	).catch(
	  function(aCaught) {
		thisW.readyState = 3;
		// run through the waiting adds, they are functions which will reject the pending deferred's with .message saying "closed due to readyState 3" as initialization failed
		for (var pendingAdd in thisW.pendingAdds) {
			thisW.pendingAdds[pendingAdd].addIt();
			// i dont care to delete thisW.pendingAdds[pendingAdd] because i only iterate it once, and thats init, and btw i do set thisW.pendingAdds to null at the end of this for loop (i do this as its uneeded stuff, so maybe save like some bytes of memory haha)
		}
		thisW.pendingAdds = null;
		
		var rejObj = {name:'promiseAll_watcherBasis', aCaught:aCaught};
		console.error('Caught - promiseAll_watcherBasis - ', rejObj);
		deferred_initialized.reject(rejObj);
	  }
	);
	
	var do_createWatcher = function() {
		// creates the watcher on the c side
		var promise_createWatcher = FSWatcherWorker.post('createWatcher', [thisW.id]);
		promise_createWatcher.then(
		  function(aVal) {
			console.log('Fullfilled - promise_createWatcher - ', aVal);
			// start - do stuff here - promise_createWatcher
			thisW.readyState = 1;
			thisW.argsForPoll = aVal;
			deferred_createWatcher.resolve(true);
			// add in the paths that are waiting
			for (var pendingAdd in thisW.pendingAdds) {
				var addIt = thisW.pendingAdds[pendingAdd].addIt();
				// i dont care to delete thisW.pendingAdds[pendingAdd] because i only iterate it once, and thats init, and btw i do set thisW.pendingAdds to null at the end of this for loop (i do this as its uneeded stuff, so maybe save like some bytes of memory haha)
			}
			thisW.pendingAdds = null;
			
			// start - os specific
			// moved to managePoll
			// end - os specific
			
			// end - do stuff here - promise_createWatcher
		  },
		  function(aReason) {
			var rejObj = {name:'promise_createWatcher', aReason:aReason};
			console.warn('Rejected - promise_createWatcher - ', rejObj);
			deferred_createWatcher.reject(rejObj);
		  }
		).catch(
		  function(aCaught) {
			var rejObj = {name:'promise_createWatcher', aCaught:aCaught};
			console.error('Caught - promise_createWatcher - ', rejObj);
			deferred_createWatcher.reject(rejObj);
		  }
		);
	};
	
	var doStartWatchersPollWorker = function() {
		thisW.FSWPollWorker = new PromiseWorker(core.addon.path.content + 'modules/workers/FSWPollWorker.js');
		_Watcher_UnterminatedFSWPollWorkers[thisW.id] = thisW.FSWPollWorker;
	
		var promise_initPollWorker = initWorkerCore(thisW.FSWPollWorker, {
			os: {
				version: core.os.version, // used for mac, for non-mac this may go in as undefined, but because os key exists in core by default, it wont throw an error
				toolkit: core.os.toolkit
			}
		}); // just need core.os.version added to PromiseWorker core as i use it for mac
		
		promise_initPollWorker.then(
		  function(aVal) {
			console.log('Fullfilled - promise_initPollWorker - ', aVal);
			// start - do stuff here - promise_initPollWorker
			deferred_startWatchersPollWorker.resolve(true);
			do_createWatcher();
			// end - do stuff here - promise_initPollWorker
		  },
		  function(aReason) {
			var rejObj = {name:'promise_initPollWorker', aReason:aReason};
			console.warn('Rejected - promise_initPollWorker - ', rejObj);
			deferred_startWatchersPollWorker.reject(rejObj);
		  }
		).catch(
		  function(aCaught) {
			var rejObj = {name:'promise_initPollWorker', aCaught:aCaught};
			console.error('Caught - promise_initPollWorker - ', rejObj);
			deferred_startWatchersPollWorker.reject(rejObj);
		  }
		);
	};
	
	var doEnsureMainWatcher = function() {
		var promise_ensureFSWatcherWorkerStarted = _FSWatcherWorker_start();
		promise_ensureFSWatcherWorkerStarted.then(
		  function(aVal) {
			console.log('Fullfilled - promise_ensureFSWatcherWorkerStarted - ', aVal);
			// start - do stuff here - promise_ensureFSWatcherWorkerStarted
			deferred_ensureWatcherWorker.resolve(true);
			doStartWatchersPollWorker();
			// end - do stuff here - promise_ensureFSWatcherWorkerStarted
		  },
		  function(aReason) {
			var rejObj = {name:'promise_ensureFSWatcherWorkerStarted', aReason:aReason};
			console.warn('Rejected - promise_ensureFSWatcherWorkerStarted - ', rejObj);
			deferred_ensureWatcherWorker.reject(rejObj);
		  }
		).catch(
		  function(aCaught) {
			var rejObj = {name:'promise_ensureFSWatcherWorkerStarted', aCaught:aCaught};
			console.error('Caught - promise_ensureFSWatcherWorkerStarted - ', rejObj);
			deferred_ensureWatcherWorker.reject(rejObj);
		  }
		);
	};
	
	doEnsureMainWatcher();
	
}
Watcher.prototype.addPath = function(aOSPath, aOptions = {}) {
	// returns promise
		// resolves to true on success
		// rejects object with keys of name and message, expalining why it failed
	// aOptions
		// for inotify, this supports `masks` key
		
	var deferredMain_Watcher_addPath = new Deferred();
	
	var thisW = this;
	
	var do_addPath = function() {
		// thisW.FSWPollWorker must be started before this is run, unless it is thisW is closed
		if (thisW.readyState == 2 || thisW.readyState == 3) {
			// closed either to failed initialization or user called watcher.close
			deferredMain_Watcher_addPath.reject({
				name: 'watcher-closed',
				message: 'Cannot add as this Watcher was previously closed with reason ' + thisW.readyState
			});
		} else if (thisW.readyState == 0) {
			console.error('what on earth, ready state is 0, it should never have got to this do_addPath');
		} else {
			if (aOSPath in thisW.adds_pendingAddC) {
				if (aOSPath in thisW.removes_pendingAddC) {
					thisW.removes_pendingAddC[aOSPath].cancelIt();
				}
				deferredMain_Watcher_addPath.reject({
					name: 'duplicate-path',
					message: 'This path is currently already in process of being added by the jsctypes code.'
				});
			} else {
				thisW.adds_pendingAddC[aOSPath] = true;
				var promise_addPath = FSWatcherWorker.post('addPathToWatcher', [thisW.id, aOSPath]);
				promise_addPath.then(
				  function(aVal) {
					console.log('Fullfilled - promise_addPath - ', aVal);
					// start - do stuff here - promise_addPath
					delete thisW.adds_pendingAddC[aOSPath];
					//thisW.paths_watched.push(aOSPath);
					thisW.paths_watched[aOSPath] = aVal; // aVal is watch_fd, so i can use this to link triggered callback to aOSPath_parentDir
					console.info('post add path, saved to paths_watched with fd val of:', aVal, 'toString of paths_watched:', JSON.stringify(thisW.paths_watched));
					deferredMain_Watcher_addPath.resolve(true);
					// do the pending remove if it was there
					if (aOSPath in thisW.removes_pendingAddC) {
						thisW.removes_pendingAddC[aOSPath].removeIt();
					} else {
						managePoll(thisW);
					}
					// end - do stuff here - promise_addPath
				  },
				  function(aReason) {
					delete thisW.adds_pendingAddC[aOSPath];
					var rejObj = {name:'promise_addPath', aReason:aReason};
					console.warn('Rejected - promise_addPath - ', rejObj);
					deferredMain_Watcher_addPath.reject(rejObj);
					// reject the pending remove if it was there
					if (aOSPath in thisW.removes_pendingAddC) {
						thisW.removes_pendingAddC[aOSPath].removeIt();
					}
				  }
				).catch(
				  function(aCaught) {
					delete thisW.adds_pendingAddC[aOSPath];
					var rejObj = {name:'promise_addPath', aCaught:aCaught};
					console.error('Caught - promise_addPath - ', rejObj);
					deferredMain_Watcher_addPath.reject(rejObj);
					// reject the pending remove if it was there
					if (aOSPath in thisW.removes_pendingAddC) {
						thisW.removes_pendingAddC[aOSPath].removeIt();
					}
				  }
				);
			}
		}
	};
	
	var do_cancelPendingAdd = function() {
		delete thisW.pendingAdds[aOSPath];
		deferredMain_Watcher_addPath.reject({
			name: 'add-cancelled',
			message: 'This path was waiting for initalization to be added, but was removePath\'ed before it got a chance to add.'
		});
	};
	
	if (thisW.readyState === 0) {
		// watcher not yet initalized
		if (aOSPath in thisW.pendingAdds) {
			deferredMain_Watcher_addPath.reject({
				name: 'duplicate-path',
				message: 'This path is already waiting to be added. It is waiting as the Watcher has not been initailized yet.'
			});
		} else {
			// start - case insensitive check to throw warning
			var aOSPathLower_forCaseInsensTest = aOSPath.toLowerCase();
			for (var cOSPath in thisW.pendingAdds) {
				if (cOSPath.toLowerCase() == aOSPathLower_forCaseInsensTest) {
					console.warn('WARNING: This is a note to the developer using this jscFileWatcher API - You are adding a path that already exists in the add queue but with different casing, casing MAY NOT MATTER on an operating systems filesystem, in which case this would be a duplicate path. The path you are trying to add is: "' + aOSPath + '" and the pre-existing path with different casing is: "' + cOSPath + '".');
					break;
				}
			}
			// end - case insensitive check to throw warning
			thisW.pendingAdds[aOSPath] = {addIt: do_addPath, cancelIt: do_cancelPendingAdd};
		}
	} else if (thisW.readyState == 1) {
		// watcher is ready
		//if (thisW.paths_watched.indexOf(aOSPath) > -1) {
		if (aOSPath in thisW.paths_watched) {
			deferredMain_Watcher_addPath.reject({
				name: 'duplicate-path',
				message: 'This path was already succesfully added by a previous call to Watcher.prototype.addPath.'
			});
		} else {
			// start - case insensitive check to throw warning
			var aOSPathLower_forCaseInsensTest = aOSPath.toLowerCase();
			for (var cOSPath in thisW.paths_watched) {
				if (cOSPath.toLowerCase() == aOSPathLower_forCaseInsensTest) {
					console.warn('WARNING: This is a note to the developer using this jscFileWatcher API - You are adding a path that was already previoulsy added but with different casing, casing MAY NOT MATTER on an operating systems filesystem, in which case this would be a duplicate path. The path you are trying to add is: "' + aOSPath + '" and the pre-existing path with different casing is: "' + cOSPath + '".');
					break;
				}
			}
			// end - case insensitive check to throw warning
			do_addPath();
		}
	} else {
		// watcher is closed
		deferredMain_Watcher_addPath.reject({
			name: 'watcher-closed',
			message: 'Cannot add as this Watcher was previously closed with reason ' + thisW.readyState
		});
	}
	
	return deferredMain_Watcher_addPath.promise;
}
Watcher.prototype.removePath = function(aOSPath) {
	// must return promise, as removal of path is done by call to myWorker.js to do a c call
		// resolves to true if sucesfully removed
	var deferredMain_Watcher_removePath = new Deferred();
	
	var thisW = this;
	
	if (thisW.readyState === 0) {
		// watcher not yet initalized
		if (aOSPath in thisW.pendingAdds) {
			thisW.pendingAdds[aOSPath].cancelIt();
			// should also reject the promise in pendingAdds
			deferredMain_Watcher_removePath.resolve(true);
		} else {
			deferredMain_Watcher_removePath.reject({
				name: 'path-not-found',
				message: 'This path was never added, it was not found in watched paths arrays/objects.'
			});
		}
	} else if (thisW.readyState == 1) {
		// watcher is ready
		var do_removePath = function() {
			//if (thisW.paths_watched.indexOf(aOSPath) > -1) { // moved this if block here because removes_pendingAddC call this function after pendingC is done (pendingC is ctypes addPathToWatcher code running) and if that fails then it will run this which will reject the pending deferred
			if (aOSPath in thisW.removes_pendingAddC) {
				delete thisW.removes_pendingAddC[aOSPath];
			}
			if (aOSPath in thisW.paths_watched) { // moved this if block here because removes_pendingAddC call this function after pendingC is done (pendingC is ctypes addPathToWatcher code running) and if that fails then it will run this which will reject the pending deferred
				//thisW.paths_watched.splice(thisW.paths_watched.indexOf(aOSPath), 1);
				delete thisW.paths_watched[aOSPath]; // moved this to before the promise worker post, because the callback may trigger, for like windows on final remove. so we want to remove it from the main-thread object so it doesnt trigger the main-thread callback // PER `CancelIo causes Windows to automatically call the Completion Routine for each ` from http://qualapps.blogspot.ch/2010/05/understanding-readdirectorychangesw_19.html AND MSDN: https://msdn.microsoft.com/en-us/library/windows/desktop/aa363792%28v=vs.85%29.aspx "The operation being canceled is completed with one of three statuses; you must check the completion status to determine the completion state. The three statuses are: "
				var promise_removePath = FSWatcherWorker.post('removePathFromWatcher', [thisW.id, aOSPath]);
				promise_removePath.then(
				  function(aVal) {
					console.log('Fullfilled - promise_removePath - ', aVal);
					// start - do stuff here - promise_removePath
					deferredMain_Watcher_removePath.resolve(true);
					// end - do stuff here - promise_removePath
				  },
				  function(aReason) {
					var rejObj = {name:'promise_removePath', aReason:aReason};
					console.warn('Rejected - promise_removePath - ', rejObj);
					deferredMain_Watcher_removePath.reject(rejObj);
				  }
				).catch(
				  function(aCaught) {
					var rejObj = {name:'promise_removePath', aCaught:aCaught};
					console.error('Caught - promise_removePath - ', rejObj);
					deferredMain_Watcher_removePath.reject(rejObj);
				  }
				);
			} else {
				deferredMain_Watcher_removePath.reject({
					name: 'path-not-found',
					message: 'This path was never added, it was not found in watched paths arrays/objects. (note: you might have got here because you called .removePath(path) while path was being by the jsctypes code of the .addPath(path), and then that jsctypes code rejected, so it never got added so never had anything to remove)'
				});
			}
		};
		
		var do_cancelPendingRemove = function() {
			delete thisW.removes_pendingAddC[aOSPath];
			deferredMain_Watcher_removePath.reject({
				name: 'remove-cancelled',
				message: 'This path was waiting for initalization to be added, but was removePath\'ed before it got a chance to add.'
			});
		};
		
		if (aOSPath in thisW.adds_pendingAddC) {
				thisW.removes_pendingAddC[aOSPath] = { // note: pendingC means its waiting for the call to FSWatcherWorker.addPathToWatcher is in process
					removeIt: do_removePath,
					cancelIt: do_cancelPendingRemove
				};
		} else {
			do_removePath();
		}
	} else {
		// watcher is closed
		deferredMain_Watcher_removePath.reject({
			name: 'watcher-closed',
			message: 'No need to remove paths as this Watcher was previously closed with reason ' + thisW.readyState
		});
	}
	
	return deferredMain_Watcher_removePath.promise;
}
Watcher.prototype.close = function() {
	// returns promise as it has to make a c call
		// resolves to true on success, else an object explaining why it failed
	var deferredMain_Watcher_close = new Deferred();
	var thisW = this;
	
	if (thisW.readyState == 2 || thisW.readyState == 3) {
		// was already previously closed
		deferredMain_Watcher_close.reject({
			name: 'watcher-closed',
			message: 'Cannot close because Watcher was already previously closed with reason ' + thisW.readyState
		});
	} else {
		var promise_closeWatcher = FSWatcherWorker.post('close', [thisW.id, aOSPath]);
		promise_closeWatcher.then(
		  function(aVal) {
			console.log('Fullfilled - promise_closeWatcher - ', aVal);
			// start - do stuff here - promise_closeWatcher
			delete _Watcher_UnterminatedFSWPollWorkers[thisW.id];
			deferredMain_Watcher_close.resolve(true);
			// end - do stuff here - promise_closeWatcher
		  },
		  function(aReason) {
			var rejObj = {name:'promise_closeWatcher', aReason:aReason};
			console.warn('Rejected - promise_closeWatcher - ', rejObj);
			deferredMain_Watcher_close.reject(rejObj);
		  }
		).catch(
		  function(aCaught) {
			var rejObj = {name:'promise_closeWatcher', aCaught:aCaught};
			console.error('Caught - promise_closeWatcher - ', rejObj);
			deferredMain_Watcher_close.reject(rejObj);
		  }
		);
	}
	
	return deferredMain_Watcher_close.promise;
}
// helper functions for Watcher, not putting into prototype as i dont want to expose these functions to devusers
function managePoll(instanceWatcher) {
	// managePoll used to be called waitForNextChange
	// does not return anything
	
	// this function ensures that the poll is running, and keeps it going as needed
	// if poll ends due to no paths being watched, this also quits, and a call to this function must be made to restart poll
	// should call this function after every addPath, if its already polling it wont do anything
	
	// this function also handles calling the mainthread callback
	
	var thisW = instanceWatcher;
	if (thisW.pollBeingManaged) {
		// poll is already being managed
		return;
	}
	
	var do_waitForNextChange = function() {
		thisW.pollBeingManaged = true;
		if (thisW.readyState == 2 || thisW.readyState == 3) {
			// watcher was closed so stop polling
			thisW.pollBeingManaged = false;
			return; // to prevent deeper exec
		}
		var promise_waitForNextChange = thisW.FSWPollWorker.post('poll', [thisW.argsForPoll]);
		promise_waitForNextChange.then(
		  function(aVal) {
			console.log('Fullfilled - promise_waitForNextChange - ', aVal);
			// start - do stuff here - promise_waitForNextChange
				// handle thisW.cb triggering
				for (var i=0; i<aVal.length; i++) {
					let iHoisted = i;
					var cVal = aVal[iHoisted];
					if ('aOSPath_parentDir_identifier' in cVal.aExtra) {
						cVal.aExtra.aOSPath_parentDir = undefined;
						for (var cOSPath in thisW.paths_watched) {
							console.log('comparing:', thisW.paths_watched[cOSPath], cVal.aExtra.aOSPath_parentDir_identifier);
							if (thisW.paths_watched[cOSPath] == cVal.aExtra.aOSPath_parentDir_identifier) {
								cVal.aExtra.aOSPath_parentDir = cOSPath;
								break;
							}
						}
						delete cVal.aExtra.aOSPath_parentDir_identifier;
					}
					if (/*core.os.name == 'darwin' && core.os.version >= 7 && */'aOSPath_parentDir' in cVal.aExtra) {
						// this is for osx 10.7+ as we want to discard subdir of watched dirs
						if (!(cVal.aExtra.aOSPath_parentDir in thisW.paths_watched)) {
							console.error('will not trigger cb for this obj as its path was not found in thisW.paths_watched, this is likely a subdir:', cVal);
							continue; // to prevent cb from triggering with this obj
						}
					}
					thisW.cb(cVal.aFileName, cVal.aEvent, cVal.aExtra);
				}
				do_waitForNextChange(); // restart poll
			// end - do stuff here - promise_waitForNextChange
		  },
		  function(aReason) {
			  thisW.pollBeingManaged = false;
			if (aReason.name == 'poll-aborted-nopaths') {
				// poll aborted due to no paths being watched
				if (Object.keys(thisW.paths_watched).length > 0) {
					aReason.API_ERROR = {
						name: 'watcher-api-error',
						message: 'Poll aborted with error reason 0 indicating no more paths being watched, however thisW.paths_watched has paths in it',
						extra: JSON.stringify(thisW.paths_watched),
					}
				}
			}
			var rejObj = {name:'promise_waitForNextChange', aReason:aReason};
			console.warn('Rejected - promise_waitForNextChange - ', rejObj);
			//deferred_createProfile.reject(rejObj);
			//do_waitForNextChange();
		  }
		).catch(
		  function(aCaught) {
			  thisW.pollBeingManaged = false;
			var rejObj = {name:'promise_waitForNextChange', aCaught:aCaught};
			console.error('Caught - promise_waitForNextChange - ', rejObj);
			//deferred_createProfile.reject(rejObj);
			//do_waitForNextChange();
		  }
		);
	};
	do_waitForNextChange();
}
// end - OS.File.Watcher API

function extendCore() {
	// adds some properties i use to core
		switch (core.os.name) {
			case 'winnt':
			case 'winmo':
			case 'wince':
				core.os.version = parseFloat(Services.sysinfo.getProperty('version'));
				// http://en.wikipedia.org/wiki/List_of_Microsoft_Windows_versions
				if (core.os.version == 6.0) {
					core.os.version_name = 'vista';
				}
				if (core.os.version >= 6.1) {
					core.os.version_name = '7+';
				}
				if (core.os.version == 5.1 || core.os.version == 5.2) { // 5.2 is 64bit xp
					core.os.version_name = 'xp';
				}
				break;
				
			case 'darwin':
				var userAgent = myServices.hph.userAgent;
				//console.info('userAgent:', userAgent);
				var version_osx = userAgent.match(/Mac OS X 10\.([\d\.]+)/);
				//console.info('version_osx matched:', version_osx);
				
				if (!version_osx) {
					throw new Error('Could not identify Mac OS X version.');
				} else {
					var version_osx_str = version_osx[1];
					var ints_split = version_osx[1].split('.');
					if (ints_split.length == 1) {
						core.os.version = parseInt(ints_split[0]);
					} else if (ints_split.length >= 2) {
						core.os.version = ints_split[0] + '.' + ints_split[1];
						if (ints_split.length > 2) {
							core.os.version += ints_split.slice(2).join('');
						}
						core.os.version = parseFloat(core.os.version);
					}
					// this makes it so that 10.10.0 becomes 10.100
					// 10.10.1 => 10.101
					// so can compare numerically, as 10.100 is less then 10.101
					
					core.os.version = 6.9; // note: debug: temporarily forcing mac to be 10.6 so we can test kqueue
				}
				break;
			default:
				// nothing special
		}
		
		core.os.toolkit = Services.appinfo.widgetToolkit.toLowerCase();
		
		core.firefox = {};
		core.firefox.version = Services.appinfo.version;
		
		console.log('done adding to core, it is now:', core);
}

function install() {}
function uninstall() {}

function startup(aData, aReason) {
	console.log('test')
	//core.addon.aData = aData;
	
	extendCore();
	
	PromiseWorker = Cu.import(core.addon.path.content + 'modules/PromiseWorker.jsm').BasePromiseWorker;

	//Services.prompt.alert(null, myServices.sb.GetStringFromName('startup_prompt_title'), myServices.sb.GetStringFromName('startup_prompt_title'));
	
	main();
}
 
function shutdown(aData, aReason) {
	// must terminate workers as they are seperate threads
	if (FSWatcherWorker) {
		//FSWatcherWorker.terminate(); // do this for ChromeWorker's
		FSWatcherWorker._worker.terminate(); // do this for PromiserWorker's // C:\Users\Vayeate\Pictures\PromiseWorker console.info.png
		// terminate all FSWPollWorker's - can do this inside this `if (FSWatcherWorker)` block because obviously if that doesnt exist then no FSWPollWorker's exist
		for (var aWatcherId in _Watcher_UnterminatedFSWPollWorkers) {
			_Watcher_UnterminatedFSWPollWorkers[aWatcherId]._worker.terminate();
		}
	}
	
	if (aReason == APP_SHUTDOWN) { return }
	
	Cu.unload(core.addon.path.content + 'modules/PromiseWorker.jsm');
}

// start - common helper functions
function Deferred() {
	if (Promise && Promise.defer) {
		//need import of Promise.jsm for example: Cu.import('resource:/gree/modules/Promise.jsm');
		return Promise.defer();
	} else if (PromiseUtils && PromiseUtils.defer) {
		//need import of PromiseUtils.jsm for example: Cu.import('resource:/gree/modules/PromiseUtils.jsm');
		return PromiseUtils.defer();
	} else if (Promise) {
		try {
			/* A method to resolve the associated Promise with the value passed.
			 * If the promise is already settled it does nothing.
			 *
			 * @param {anything} value : This value is used to resolve the promise
			 * If the value is a Promise then the associated promise assumes the state
			 * of Promise passed as value.
			 */
			this.resolve = null;

			/* A method to reject the assocaited Promise with the value passed.
			 * If the promise is already settled it does nothing.
			 *
			 * @param {anything} reason: The reason for the rejection of the Promise.
			 * Generally its an Error object. If however a Promise is passed, then the Promise
			 * itself will be the reason for rejection no matter the state of the Promise.
			 */
			this.reject = null;

			/* A newly created Pomise object.
			 * Initially in pending state.
			 */
			this.promise = new Promise(function(resolve, reject) {
				this.resolve = resolve;
				this.reject = reject;
			}.bind(this));
			Object.freeze(this);
		} catch (ex) {
			console.error('Promise not available!', ex);
			throw new Error('Promise not available!');
		}
	} else {
		throw new Error('Promise not available!');
	}
}

function initWorkerCore(workerObj, aCore={}) {
	// aCore is what you want aCore to be populated with
	
	// PromiseWorker
	return workerObj.post('init', [aCore]);
	
	// add support and detection for regular ChromeWorker
}
// end - common helper functions