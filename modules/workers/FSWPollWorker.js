'use strict';

// Imports
importScripts('resource://gre/modules/osfile.jsm');
importScripts('resource://gre/modules/workers/require.js');

// Globals
const core = { // have to set up the main keys
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
	},
	firefox: {}
};
const loopIntervalMS = 30000;
const loopIntervalS = 30;

// START - OS Specific
var winStuff;
var nixStuff;
var bsd_mac_kqStuff;
var macStuff;
// END - OS Specific

// Imports that use stuff defined in chrome
// I don't import ostypes_*.jsm yet as I want to init core first, as they use core stuff like core.os.isWinXP etc
importScripts(core.addon.path.content + 'modules/cutils.jsm');
importScripts(core.addon.path.content + 'modules/ctypes_math.jsm');

// Setup PromiseWorker
var PromiseWorker = require(core.addon.path.content + 'modules/workers/PromiseWorker.js');
var worker = new PromiseWorker.AbstractWorker();
worker.dispatch = function(method, args = []) {
	return self[method](...args);
};
worker.postMessage = function(result, ...transfers) {
	self.postMessage(result, ...transfers);
};
worker.close = function() {
	self.close();
};
self.addEventListener('message', msg => worker.handleMessage(msg));

////// end of imports and definitions

function init(objCore) {
	// merge objCore into core
	// core and objCore is object with main keys, the sub props

	for (var p in objCore) {
		/* // cant set things on core as its const
		if (!(p in core)) {
		  core[p] = {};
		}
		*/

		for (var pp in objCore[p]) {
			core[p][pp] = objCore[p][pp];
		}
	}

	// I import ostypes_*.jsm in init as they may use things like core.os.isWinXp etc
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			importScripts(core.addon.path.content + 'modules/ostypes_win.jsm');
			break;
		case 'linux':
		case 'sunos':
		case 'webos': // Palm Pre
		case 'android':
			importScripts(core.addon.path.content + 'modules/ostypes_nix.jsm');
			break;
		case 'darwin':
			if (core.os.version < 7) {
				importScripts(core.addon.path.content + 'modules/ostypes_bsd-mac-kq.jsm');
			} else {
				importScripts(core.addon.path.content + 'modules/ostypes_mac.jsm');
			}
			break;
		case 'freebsd':
		case 'openbsd':
			importScripts(core.addon.path.content + 'modules/ostypes_bsd-mac-kq.jsm');
			break;
		default:
			throw new Error({
				name: 'watcher-api-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
	
	// OS Specific Init
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				winStuff = {};

				winStuff.WATCHED_RES_MAXIMUM_NOTIFICATIONS = 100; // 100; Dexter uses 100
				winStuff.NOTIFICATION_BUFFER_SIZE = ostypes.TYPE.FILE_NOTIFY_INFORMATION.size * winStuff.WATCHED_RES_MAXIMUM_NOTIFICATIONS; // WATCHED_RES_MAXIMUM_NOTIFICATIONS * ostypes.TYPE.FILE_NOTIFY_INFORMATION.size;

				/*
				// start - calc NOTIFICATION_BUFFER_SIZE
				var dummyForSize = ostypes.TYPE.FILE_NOTIFY_INFORMATION.array(winStuff.WATCHED_RES_MAXIMUM_NOTIFICATIONS)();
				console.log('dummyForSize.constructor.size:', dummyForSize.constructor.size);
				console.log('ostypes.TYPE.DWORD.size:', ostypes.TYPE.DWORD.size);
				var dummyForSize_DIVIDED_BY_DwordSize = dummyForSize.constructor.size / ostypes.TYPE.DWORD.size;
				dummyForSize = null;

				console.log('dummyForSize.constructor.size / ostypes.TYPE.DWORD.size:', dummyForSize_DIVIDED_BY_DwordSize, Math.ceil(dummyForSize_DIVIDED_BY_DwordSize)); // should be whole int but lets round up with Math.ceil just in case
				winStuff.NOTIFICATION_BUFFER_SIZE = Math.ceil(dummyForSize_DIVIDED_BY_DwordSize);
				// end - calc NOTIFICATION_BUFFER_SIZE
				*/
				
				winStuff.lpCompletionRoutine = ostypes.TYPE.FileIOCompletionRoutine.ptr(lpCompletionRoutine_js);
				winStuff.changes_to_watch = ostypes.CONST.FILE_NOTIFY_CHANGE_LAST_WRITE | ostypes.CONST.FILE_NOTIFY_CHANGE_FILE_NAME | ostypes.CONST.FILE_NOTIFY_CHANGE_DIR_NAME; // this is what @Dexter used

				winStuff.handles_watched = {}; // key is cutils.strOfPtr(hDirectory) and value is its overlapped struct as i need to reuse that in the callback to restart the watch, so setting it to 1 for now
				winStuff.handles_watched_jsArr = []; // array of hDirectory , not the pointer strings!
				winStuff.handles_watched_cArr = undefined;
				
				winStuff.handles_pending_add = [];
				
				winStuff.maxLen_cStrOfHandlePtrStrsWaitingAdd = 100;
				
				winStuff.didCBHap = 0;
				winStuff.FSChanges = [];
				
			break;
		case 'linux':
		case 'webos': // Palm Pre
		case 'android':
		
				nixStuff = {};
				nixStuff._cache_aRenamed = {}; // key is cookie and val is aExtra of rename-from, and on reanmed-to, it finds the cookie and deletes it and triggers callback with renamed-to with aExtra holding oldFileName
		
			break;
		case 'darwin':
		case 'freebsd':
		case 'openbsd':
		
				if (core.os.name !== 'darwin' /* bsd */ || core.os.version < 7) {
					bsd_mac_kqStuff = {};
					bsd_mac_kqStuff.evtMtrPtrStr_len = 50; // change in FSWatcherWorker too
					bsd_mac_kqStuff.watchedFd = {};
					/* about bsd_mac_kqStuff.watchedFd
					keys is fd,
					val is obj:
						{
							jsStr: jsStr of OSPath of watched directory,
							dirStat: {
								jsStr_filename_1: {
									lastModificationDate: js_lastModDate
								},
								jsStr_filename_2: {
									lastModificationDate: js_lastModDate
								},
							}
						}
					*/
				} else {
					// osx > 10.7
					macStuff = {};
					macStuff.maxLenCfArrRefPtrStr = 20;
					macStuff._c_fsevents_callback = ostypes.TYPE.FSEventStreamCallback(js_FSEvStrCB);
					macStuff.FSChanges = null;
					
					macStuff.cId = ostypes.API('FSEventsGetCurrentEventId')(); // ostypes.TYPE.FSEventStreamEventId(ostypes.CONST.kFSEventStreamEventIdSinceNow);
					console.info('macStuff.cId:', macStuff.cId.toString());
					macStuff.rez_CFRunLoopGetCurrent = ostypes.API('CFRunLoopGetCurrent')();
					console.info('rez_CFRunLoopGetCurrent:', macStuff.rez_CFRunLoopGetCurrent.toString());
					
					macStuff.last_jsStr_ptrOf_cfArrRef = 0;
				}
				
			break;
		default:
			// do nothing special
	}	

	return true;
}

var _nextPathId = 0;
function getPathId() {
	_nextPathId++;
	return _nextPathId-1;
}
function poll(aArgs) {
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				console.error('here in poll');
				
				while (true) {
					console.log('top of loop');
					if (!('numHandlesWaitingAdd' in winStuff)) {
						winStuff.numHandlesWaitingAdd = ctypes.int.ptr(ctypes.UInt64(aArgs.numHandlesWaitingAdd_ptrStr));
						winStuff.cStrOfHandlePtrStrsWaitingAdd = ctypes.char.array(winStuff.maxLen_cStrOfHandlePtrStrsWaitingAdd).ptr(ctypes.UInt64(aArgs.strOfHandlePtrStrsWaitingAdd_ptrStr));
					}
					if (winStuff.numHandlesWaitingAdd.contents > 0) { // i dont do .contents.value because .contents makesit primitive per @arai on irc #jsctypes
						var jsStrOfHandlePtrStrsWaitingAdd = winStuff.cStrOfHandlePtrStrsWaitingAdd.contents.readString();
						console.info('jsStrOfHandlePtrStrsWaitingAdd:', jsStrOfHandlePtrStrsWaitingAdd);
						var jsArrOfHandlePtrStrsWaitingAdd = jsStrOfHandlePtrStrsWaitingAdd.split(',');
						
						if (jsArrOfHandlePtrStrsWaitingAdd.length == 0) {
							throw new Error('what on earth this should never happen as numHandlesWaitingAdd increments only when there is contents in this cStr');
						}
						
						// blank the str
						cutils.modifyCStr(winStuff.cStrOfHandlePtrStrsWaitingAdd.contents, '');
						winStuff.numHandlesWaitingAdd.contents = 0;
						
						for (var i=0; i<jsArrOfHandlePtrStrsWaitingAdd.length; i++) {
							let iHoisted = i;
							var hDirectory_ptrStr = jsArrOfHandlePtrStrsWaitingAdd[iHoisted];
							var hDirectory = ostypes.TYPE.HANDLE.ptr(ctypes.UInt64(hDirectory_ptrStr)).contents;
							
							winStuff.handles_watched_jsArr.push(hDirectory);
							
							var o = ostypes.TYPE.OVERLAPPED(); //(ostypes.TYPE.ULONG_PTR(0), ostypes.TYPE.ULONG_PTR(0), null, null);
							
							var notif_buf = ostypes.TYPE.DWORD.array(winStuff.NOTIFICATION_BUFFER_SIZE)(); //ostypes.TYPE.DWORD.array(NOTIFICATION_BUFFER_SIZE)(); // im not sure about the 4096 ive seen people use that and 2048 im not sure why
							var notif_buf_size = notif_buf.constructor.size; // obeys length of .array //ostypes.TYPE.DWORD(notif_buf.constructor.size); // will be same as winStuff.NOTIFICATION_BUFFER_SIZE duhhh
							console.info('notif_buf.constructor.size:', notif_buf.constructor.size);

							winStuff.handles_watched[hDirectory_ptrStr] = {
								o: o,
								notif_buf: notif_buf,
								path_id: getPathId(),
								hDirectory: hDirectory
							};
							o.hEvent = ctypes.int(winStuff.handles_watched[hDirectory_ptrStr].path_id).address(); //notif_buf.address(); 
							
							console.error('will not hang, as async, hDirectory:', hDirectory.toString());
							var rez_RDC = ostypes.API('ReadDirectoryChanges')(hDirectory, notif_buf.address(), notif_buf_size, false, winStuff.changes_to_watch, null, o.address(), winStuff.lpCompletionRoutine);
							console.info('rez_RDC:', rez_RDC.toString(), uneval(rez_RDC));

							//console.error('ok got here didnt hang, this is good as i wanted it async');
							
							if (rez_RDC == false || ctypes.winLastError != 0) {
								console.error('Failed rez_RDC, winLastError:', ctypes.winLastError);
								throw new Error({
									name: 'os-api-error',
									message: 'Failed to ReadDirectoryChanges on handle: ' + hDirectory_ptrStr,
									winLastError: ctypes.winLastError
								});
							}
							
						}
						
						winStuff.handles_watched_cArr = ostypes.TYPE.VOID.ptr.array()(winStuff.handles_watched_jsArr);
					}
					
					winStuff.FSChanges = [];
					var rez_WaitForMultipleObjectsEx = ostypes.API('WaitForMultipleObjectsEx')(winStuff.handles_watched_cArr.length, winStuff.handles_watched_cArr, false, 10000 /*in ship product set this to half a second, so 500ms*/, true);
					console.error('hang completed for WaitForMultipleObjectsEx');
					//console.error('value of did callback happen first:', winStuff.didCBHap); // learned that WaitForMultipleObjectsEx un-blocks/hangs after the callback ran, this is perfect aH! so now i can return the promise with the callbacks work, just store it to global then return it here (clear global so future functions wont double return)
					if (cutils.jscEqual(rez_WaitForMultipleObjectsEx, ostypes.CONST.WAIT_FAILED)) {
						console.error('Failed rez_WaitForMultipleObjectsEx, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed to rez_WaitForMultipleObjectsEx',
							winLastError: ctypes.winLastError
						});
					} else if (cutils.jscEqual(rez_WaitForMultipleObjectsEx, ostypes.CONST.WAIT_IO_COMPLETION)) {
						console.error('The wait was ended by one or more user-mode asynchronous procedure calls (APC) queued to the thread.');
						console.error('winStuff.FSChanges should have been populated by all the callbacks, as WaitForMultipleObjectsEx unhangs after all callbacks complete, i learned this from testing. winStuff.FSChanges:', JSON.stringify(winStuff.FSChanges));
						return winStuff.FSChanges;
					} else if (cutils.jscEqual(rez_WaitForMultipleObjectsEx, ostypes.CONST.WAIT_TIMEOUT)) {
						console.error('The time-out interval elapsed, the conditions specified by the bWaitAll parameter were not satisfied, and no completion routines are queued.');
						// scratch this comment to right maybe, this really just means timeout // ill get here if there are no paths being watched, like (1) on creat of watcher and addPath hasnt been called yet, or (2) all paths that were added were removed
					} else {
						// either nCount number of object ABANDONDED or SATISFIED
						var nCount = winStuff.handles_watched_cArr.length;
						var postSubtract = ctypes_math.UInt64.sub(ctypes.UInt64(cutils.jscGetDeepest(rez_WaitForMultipleObjectsEx)), ctypes.UInt64(nCount - 1));
						
						if (cutils.jscEqual(postSubtract, ostypes.CONST.WAIT_ABANDONED_0)) {
							console.error('This is not an error I just made it this so I can notice in browser console logs, likely I did .removePath so its callback was abandoned. The lpHandles array index of ' + nCount + ' was the abandoned mutex object.');
						} else if (cutils.jscEqual(postSubtract, ostypes.CONST.WAIT_OBJECT_0)) {
							console.info('The lpHandles array index of ' + nCount + ' was the signaled with some file event!!');
						}
					}
				}
				
			break;
		case 'darwin':
		case 'freebsd':
		case 'openbsd':
		
			// uses kqueue for core.os.version < 10.7 and non-Darwin, FSEventFramework for core.os.version >= 10.7

			if (core.os.name !== 'darwin' /* bsd */ || core.os.version < 7) {
				
				// use kqueue
				console.error('poll kq');
				var kq = aArgs.kq;

				if (!('events_to_monitor' in bsd_mac_kqStuff)) {
					bsd_mac_kqStuff.cStr_evtMtrPtrStr = ctypes.char.array(bsd_mac_kqStuff.evtMtrPtrStr_len).ptr(ctypes.UInt64(aArgs.ptStr_cStringOfPtrStrToEventsToMonitorArr));
					bsd_mac_kqStuff.num_files = ostypes.TYPE.int.ptr(ctypes.UInt64(aArgs.num_files_ptrStr));
				}
				
				// Set the timeout to wake us every half second.
				var timeout = ostypes.TYPE.timespec();
				var useSec = 0;
				var useNsec = 500000000;
				timeout.tv_sec = useSec; // 0 seconds
				timeout.tv_nsec = useNsec; // 500 milliseconds
				
				// Handle events
				var last_eventsToMonitorPtrStr;
				console.info('last_eventsToMonitorPtrStr:', last_eventsToMonitorPtrStr);
				var last_num_files = -1;
				
				var events_to_monitor;
				var event_data;// = ostypes.TYPE.kevent.array(ostypes.CONST.NUM_EVENT_SLOTS)();
				
				var continue_loop = Infinity; // monitor forever // 40; // Monitor for twenty seconds. // ostypes.TYPE.int
				var FSChanges = []; // object to deliever back to main thread
				while (--continue_loop) {
					var now_eventsToMonitorPtrStr = bsd_mac_kqStuff.cStr_evtMtrPtrStr.contents.readString(); // using ctypes.char and NOT ostypes.TYPE.char as this is depending on cutils.modifyCStr (which says use ctypes.char) // link87354 50 cuz thats what i set it to
					if (now_eventsToMonitorPtrStr != last_eventsToMonitorPtrStr) { // link584732
						// so paths were added or removed OR added and remove you get what im trying to say
						console.info('CHANGE ON last_eventsToMonitorPtrStr:', last_eventsToMonitorPtrStr, 'now one is:', now_eventsToMonitorPtrStr);
						last_eventsToMonitorPtrStr = now_eventsToMonitorPtrStr;
						
						console.info('num_files.contents:', bsd_mac_kqStuff.num_files.contents); // testing if i really need to re read ptr or if it changes in this FSWPollWorker.js thread when FSWatcherWorker.js thread changes .value on it
						
						events_to_monitor = ostypes.TYPE.kevent.array(bsd_mac_kqStuff.num_files.contents).ptr(ctypes.UInt64(now_eventsToMonitorPtrStr)).contents;
						event_data = ostypes.TYPE.kevent.array(events_to_monitor.length)();
						
						var accountedFdInArr = [];
						for (var i=0; i<events_to_monitor.length; i++) {
							let iHoisted = i;
							var fd = cutils.jscGetDeepest(events_to_monitor[iHoisted].ident);
							accountedFdInArr.push(fd);
							if (!(fd in bsd_mac_kqStuff.watchedFd)) {
								bsd_mac_kqStuff.watchedFd[fd] = 0;
								console.log('fd of ' + fd + ' was added to watch list');
							}
							// start - even if it was there, i want to make sure the path is right
							// get the cstr
							if (core.os.name == 'darwin') {
								var ptrStr = ctypes.cast(events_to_monitor[iHoisted].udata.address(), ctypes.intptr_t.ptr).contents;
							} else {
								// bsd
								var ptrStr = cutils.jscGetDeepest(events_to_monitor[0].udata);
							}
							console.info('ptrStr:', ptrStr.toString());
							var cStr_cOSPath = ctypes.jschar.array(OS.Constants.libc.PATH_MAX).ptr(ctypes.UInt64(ptrStr)); //jschar due to link321354 in FSWatcherWorker
							console.info('cStr_cOSPath:', cStr_cOSPath.toString());
							//console.info('cStr_cOSPath.contents:', cStr_cOSPath.contents.toString());
							var jsStr_cOSPath = '';
							for (var j=0; j<cStr_cOSPath.contents.length; j++) {
								let jHoisted = j;
								var cChar = cStr_cOSPath.contents[j];
								if (cChar == '\x00') {
									break; // reached null-terminator
								}
								jsStr_cOSPath += cChar;
							}
							cStr_cOSPath = null; // as i took out a lot OS.Constants.libc.PATH_MAX so lets just set it to null so it GC's, well im hoping this makes it GC
							
							var aOSPath_watchedDir = jsStr_cOSPath; // ctypes.jschar due to link4874354 in ostypes_bsd-mac-kq.jsm
							if (bsd_mac_kqStuff.watchedFd[fd] == 0 || bsd_mac_kqStuff.watchedFd[fd].OSPath != aOSPath_watchedDir) {
								console.error('STARTING READDIR on:', jsStr_cOSPath);
								if (bsd_mac_kqStuff.watchedFd[fd] != 0 && bsd_mac_kqStuff.watchedFd[fd].OSPath != aOSPath_watchedDir) {
									console.error('WARNING: just note to self, fd got reused (i suspected this was a possibility and this message confirms it), old path was "' + bsd_mac_kqStuff.watchedFd[fd].OSPath + '" and now it is updated to "' + aOSPath_watchedDir + '" the fd is: "' + fd + '"');
								}
								bsd_mac_kqStuff.watchedFd[fd] = {
									OSPath: aOSPath_watchedDir, //jsStr
									dirStat: fetchInodeAndFilenamesInDir(aOSPath_watchedDir)
								};
							} else if (bsd_mac_kqStuff.watchedFd[fd].OSPath == aOSPath_watchedDir) {
								// the stored js str is same so no need to do anything, the last OS.File.DirectoryIterator is sufficient (as if it did change it was updated from change notification)
							} else {
								console.error('WHAAA should never get here', aOSPath_watchedDir, bsd_mac_kqStuff.watchedFd[fd]);
							}
							// end get the cstr
							// end - even if it was there, i want to make sure the path is right
						}
						for (var fdInObj in bsd_mac_kqStuff.watchedFd) {
							if (accountedFdInArr.indexOf(fdInObj) == -1) {
								delete bsd_mac_kqStuff.watchedFd[fdInObj]; // fd was removed by removePath probably so delete it from watched list
							}
						}
					}
					if (events_to_monitor.length == 0) {
						// no pahts to watch
						// lets quit polling as its useless overhead
						//FSChanges = 0;
						throw new Error({
							name: 'poll-aborted-nopaths',
							message: 'This is not an error, just throwing to cause rejection due to no more paths being watched, so aborting poll, as it is useless overhead now'
						});
					} else {
						// commented out as otherwise i have to make it setTimeout for half second // i also dont want to make this an infinite poll, as after addPath i need to update kevent arguments, which i do by reading hte num_files_ptrStr
						// there is at least 1 file to watch
						var event_count = ostypes.API('kevent')(kq, events_to_monitor/*.address()*/, events_to_monitor.length, event_data/*.address()*/, event_data.length, timeout.address());
						console.info('event_count:', event_count.toString(), uneval(event_count));
						if (ctypes.errno !== 0) {
							console.error('Failed event_count, errno:', ctypes.errno, 'event_count:', cutils.jscGetDeepest(event_count));
							throw new Error({
								name: 'os-api-error',
								message: 'Failed to event_count due to failed kevent call',
								uniEerrno: ctypes.errno
							});
						}
						if (cutils.jscEqual(event_data.addressOfElement(0).contents.flags, ostypes.CONST.EV_ERROR)) {
							console.error('Failed event_count, due to event_data.flags == EV_ERROR, errno:', ctypes.errno, 'event_count:', cutils.jscGetDeepest(event_count));
							throw new Error({
								name: 'os-api-error',
								message: 'Failed to event_count despite succesful kevent call due to event_data.flags == EV_ERROR',
								uniEerrno: ctypes.errno
							});
						}

						var js_event_count = cutils.jscGetDeepest(event_count);
						if (!cutils.jscEqual(event_count, 0)) {
							if (parseInt(js_event_count) > 1) {
								console.error('not yet implemented::: more then 1 event_count!!');
							}
							// something happend
							var evFd = cutils.jscGetDeepest(event_data[0].ident);
							console.log('Event ' + evFd + ' occurred. Filter ' + cutils.jscGetDeepest(event_data[0].filter) + ', flags ' + cutils.jscGetDeepest(event_data[0].flags) + ', filter flags ' + cutils.jscGetDeepest(event_data[0].fflags) + ', filter data ' + cutils.jscGetDeepest(event_data[0].data) + ', path ' + cutils.jscGetDeepest(event_data[0].udata /*.contents.readString()*/ ));
							
							var aOSPath_parentDir = bsd_mac_kqStuff.watchedFd[evFd].OSPath;
							
							var nowDirStat = fetchInodeAndFilenamesInDir(aOSPath_parentDir);
							for (var nowInode in nowDirStat) {
								if (!(nowInode in bsd_mac_kqStuff.watchedFd[evFd].dirStat)) {
									// added
									FSChanges.push({
										aFileName: nowDirStat[nowInode].filename,
										aEvent: 'added',
										aExtra: {
											aOSPath_parentDir: aOSPath_parentDir
										}
									});
								} else {
									// its there, lets check if it was contents-modified and/or renamed
									if (bsd_mac_kqStuff.watchedFd[evFd].dirStat[nowInode].lastmod != nowDirStat[nowInode].lastmod) {
										// contents-modified
										FSChanges.push({
											aFileName: nowDirStat[nowInode].filename,
											aEvent: 'contents-modified',
											aExtra: {
												aOSPath_parentDir: aOSPath_parentDir,
												previousMod: bsd_mac_kqStuff.watchedFd[evFd].dirStat[nowInode].lastmod.toString(),
												nowMod: nowDirStat[nowInode].lastmod.toString()
											}
										});
									}
									if (bsd_mac_kqStuff.watchedFd[evFd].dirStat[nowInode].filename != nowDirStat[nowInode].filename) {
										// renamed
										FSChanges.push({
											aFileName: nowDirStat[nowInode].filename,
											aEvent: 'renamed',
											aExtra: {
												aOSPath_parentDir_identifier: aOSPath_parentDir,
												aOld: {
													aFileName: bsd_mac_kqStuff.watchedFd[evFd].dirStat[nowInode].filename
												}
											}
										});
									}
									delete bsd_mac_kqStuff.watchedFd[evFd].dirStat[nowInode];
								}
							}
							for (var thenInode in bsd_mac_kqStuff.watchedFd[evFd].dirStat) { // check if any inodes remaining
								// removed
								console.error('removed push');
								FSChanges.push({
									aFileName: bsd_mac_kqStuff.watchedFd[evFd].dirStat[thenInode].filename,
									aEvent: 'removed',
									aExtra: {
										aOSPath_parentDir: aOSPath_parentDir,
									}
								});
							}
							bsd_mac_kqStuff.watchedFd[evFd].dirStat = nowDirStat; // set old dirstat to the new dirstat
							
							if (FSChanges.length > 0) {
								return FSChanges;
							}
						} else {
							// No event
						}

						// Reset the timeout. In case of a signal interrruption, the values may change.
						timeout.tv_sec = useSec; // 0 seconds
						timeout.tv_nsec = useNsec; // 500 milliseconds
					}
				}
				// ostypes.API('close')(event_fd); // this should not happen here but in watcher1.close()
				//return FSChanges;
				
			// end kqueue
			} else {
				// os.version is >= 10.7
				// use FSEventFramework
				
				if (!('cfArrRef' in macStuff)) {
					macStuff.cStr_ptrOf_cfArrRef = ctypes.char.array(macStuff.maxLenCfArrRefPtrStr).ptr(ctypes.UInt64(aArgs.ptrStrOf__cStr_ptrOf_cfArrRef));
				}
				var now_jsStr_ptrOf_cfArrRef;
				
				console.error('PRE THE LOOP SO ENTRY FUNC');
				
				while (true) {
					now_jsStr_ptrOf_cfArrRef = macStuff.cStr_ptrOf_cfArrRef.contents.readString();
					console.info('LOOP TOP last:', macStuff.last_jsStr_ptrOf_cfArrRef.toString(), 'now:', now_jsStr_ptrOf_cfArrRef.toString());
					if (macStuff.last_jsStr_ptrOf_cfArrRef != now_jsStr_ptrOf_cfArrRef) {
						console.info('cfArr changed, so make new stream');
						// invalidate old stream, create new stream
						if ('fsstream' in macStuff) {
							ostypes.API('FSEventStreamStop')(macStuff.fsstream); // i dont think i need this but lets leave it just in case
							ostypes.API('FSEventStreamInvalidate')(macStuff.fsstream);
							// just doing the above two will make runLoopRun break but we want to totally clean up the stream as we dont want it anymore as we are making a new one
							ostypes.API('FSEventStreamRelease')(macStuff.fsstream);
						}
						
						// create new
						macStuff.last_jsStr_ptrOf_cfArrRef = now_jsStr_ptrOf_cfArrRef;
						console.log('set last to now so last is now:', macStuff.last_jsStr_ptrOf_cfArrRef.toString(), 'and again now is:', now_jsStr_ptrOf_cfArrRef.toString());
						var cfArrRef = ostypes.TYPE.CFArrayRef.ptr(ctypes.UInt64(now_jsStr_ptrOf_cfArrRef)).contents;
						console.info('from poll worker cfArrRef:', cfArrRef.toString());
						
						macStuff.fsstream = ostypes.API('FSEventStreamCreate')(ostypes.CONST.kCFAllocatorDefault, macStuff._c_fsevents_callback, null, cfArrRef, macStuff.cId, 0, ostypes.CONST.kFSEventStreamCreateFlagWatchRoot | ostypes.CONST.kFSEventStreamCreateFlagFileEvents | ostypes.CONST.kFSEventStreamCreateFlagNoDefer);
						console.info('macStuff.fsstream:', macStuff.fsstream.toString(), uneval(macStuff.fsstream));
						if (macStuff.fsstream.isNull()) { // i have seen this null when cfArr had no paths added to it, so was an empty cfarr
							console.error('Failed FSEventStreamCreate');
							throw new Error({
								name: 'os-api-error',
								message: 'Failed FSEventStreamCreate'
							});
						}
						
						ostypes.API('FSEventStreamScheduleWithRunLoop')(macStuff.fsstream, macStuff.rez_CFRunLoopGetCurrent, ostypes.CONST.kCFRunLoopDefaultMode) // returns void
						
						var rez_FSEventStreamStart = ostypes.API('FSEventStreamStart')(macStuff.fsstream);
						if (!rez_FSEventStreamStart) {
							console.error('Failed FSEventStreamStart');
							throw new Error({
								name: 'os-api-error',
								message: 'Failed FSEventStreamStart'
							});
						}
						console.log('succsefuly started stream:', rez_FSEventStreamStart.toString());
					} // else { console.log('cfArr unchanged so just go straight to run loop again'); }
				
					//console.log('going to start runLoopRun');
					macStuff.FSChanges = null;
					var rez_cfRLRIM = ostypes.API('CFRunLoopRunInMode')(ostypes.CONST.kCFRunLoopDefaultMode, loopIntervalS, true); // returns void
					console.log('post runLoopRun line, rez_cfRLRIM:', rez_cfRLRIM.toString(), uneval(rez_cfRLRIM));
					
					if (cutils.jscEqual(rez_cfRLRIM, ostypes.CONST.kCFRunLoopRunFinished)) {
						console.log('poll-aborted-nopaths');
						throw new Error({
							name: 'poll-aborted-nopaths',
							message: 'This is not an error, just throwing to cause rejection due to no more paths being watched, so aborting poll, as it is useless overhead now'
						});
					} else if (cutils.jscEqual(rez_cfRLRIM, ostypes.CONST.kCFRunLoopRunStopped)) {
						console.log('The run loop was stopped with CFRunLoopStop');
						throw new Error({
							name: 'poll-aborted-manually-stopped',
							message: 'This is not an error, just throwing to cause rejection due to loop stopped by CFRunLoopStop'
						});
					} else if (cutils.jscEqual(rez_cfRLRIM, ostypes.CONST.kCFRunLoopRunTimedOut)) {
						console.log('The time interval seconds passed'); // probably no events triggered so continue loop
					} else if (cutils.jscEqual(rez_cfRLRIM, ostypes.CONST.kCFRunLoopRunHandledSource)) {
						console.log('A source was processed. This exit condition only applies when returnAfterSourceHandled is true.');
					} else {
						console.error('huh??!?! should never get here');
					}
					
					
					if (macStuff.FSChanges && macStuff.FSChanges.length > 0) {
						return macStuff.FSChanges;
					} // else continue loop
				}
				
			}

		break;
		case 'linux':
		case 'webos': // Palm Pre // im guessng this has inotify, untested
		case 'android': // im guessng this has inotify, untested
			{
				// uses inotify
				console.log('ok in pollThis of nixPoll');
				let fd = aArgs.fd;
				
				var sizeUnaligned_inotify_event = 
					ostypes.TYPE.inotify_event.fields[0].wd.size + 
					ostypes.TYPE.inotify_event.fields[1].mask.size + 
					ostypes.TYPE.inotify_event.fields[2].cookie.size + 
					ostypes.TYPE.inotify_event.fields[3].len.size + 
					ostypes.TYPE.inotify_event.fields[4].name.size; // has built in length of MAX_NAME + 1 (the + 1 is for null terminator)
				var size_inotify_event = ostypes.TYPE.inotify_event.size;
				var sizeField0 = ostypes.TYPE.inotify_event.fields[0].wd.size;
				var sizeField1 = ostypes.TYPE.inotify_event.fields[1].mask.size;
				var sizeField2 = ostypes.TYPE.inotify_event.fields[2].cookie.size;
				var sizeField3 = ostypes.TYPE.inotify_event.fields[3].len.size;
				var sizeField4 = ostypes.TYPE.inotify_event.fields[4].name.size;
				
				console.info('sizeUnaligned_inotify_event:', sizeUnaligned_inotify_event.toString());
				console.info('size_inotify_event:', sizeUnaligned_inotify_event.toString());
				console.info('sizeField4:', sizeField4.toString());
				
				let count = size_inotify_event * 10; // a single read can return an array of multiple elements, i set max to 10 elements of name with NAME_MAX, but its possible to get more then 10 returned as name may not be NAME_MAX in length for any/all of the returned's
				let buf = ctypes.ArrayType(ostypes.TYPE.char, count)(); // docs page here http://linux.die.net/man/7/inotify says sizeof(struct inotify_event) + NAME_MAX + 1 will be sufficient to read at least one event.
				
				console.log('starting the loop, fd:', fd, 'count:', count);
				count = ostypes.TYPE.size_t(count); // for use with read
				while (true) {
					let length = ostypes.API('read')(fd, buf, count);

					length = parseInt(cutils.jscGetDeepest(length));
					console.info('length read:', length, length.toString(), uneval(length));
					
					if (cutils.jscEqual(length, -1)) {
						throw new Error({
							name: 'os-api-error',
							message: 'Failed to read during poll',
							uniEerrno: ctypes.errno
						});
					} else if (!cutils.jscEqual(length, 0)) {
						// then its > 0 as its not -1
						// something happend, read struct
						let FSChanges = [];
						var i = 0;
						var numElementsRead = 0;
						console.error('starting loop');
						length = parseInt(cutils.jscGetDeepest(length));
						do {
							let iHoisted = i;
							numElementsRead++;
							var casted = ctypes.cast(buf.addressOfElement(iHoisted), ostypes.TYPE.inotify_event.ptr).contents;
							console.log('casted:', casted.toString());
							var fileName = casted.addressOfField('name').contents.readString();
							var mask = casted.addressOfField('mask').contents; // ostypes.TYPE.uint32_t which is ctypes.uint32_t so no need to get deepest, its already a number
							var len = casted.addressOfField('len').contents; // need to iterate to next item that was read in // ostypes.TYPE.uint32_t which is ctypes.uint32_t so no need to get deepest, its already a number
							var cookie = cutils.jscGetDeepest(casted.addressOfField('cookie').contents); // ostypes.TYPE.uint32_t which is ctypes.uint32_t so no need to get deepest, its already a number
							var wd = casted.addressOfField('wd').contents; // ostypes.TYPE.int which is ctypes.int so no need to get deepest, its already a number
							
							var aEvent = convertFlagsToAEventStr(mask);
							
							console.info('aFileName:', fileName, 'aEvent:', convertFlagsToAEventStr(mask), 'len:', len, 'cookie:', cookie);
							
							if (aEvent == 'renamed-to') {
								if (cookie in nixStuff._cache_aRenamed) {
									// renamed-to message came second, so obtain the renamed-from from the _cache_aRenamed and push a rezObj
									var rezObj = nixStuff._cache_aRenamed[cookie];
									delete nixStuff._cache_aRenamed[cookie];
									
									rezObj.aFileName = fileName;
									FSChanges.push(rezObj);
								} else {
									// renamed-to message came first, so just store in _cache_aRenamed
									var rezObj = {
										aFileName: fileName,
										aEvent: 'renamed',
										aExtra: {
											aOSPath_parentDir_identifier: wd,
											nixInotifyFlags: mask // i should pass this, as if user did modify the flags, they might want to figure out what exactly changed
											//aOld: {}
										}
									}
									nixStuff._cache_aRenamed[cookie] = rezObj;
								}
							} else if (aEvent == 'renamed-from') {
								if (cookie in nixStuff._cache_aRenamed) {
									// renamed-from message came second, so obtain the renamed-to from the _cache_aRenamed and push a rezObj
									var rezObj = nixStuff._cache_aRenamed[cookie];
									delete nixStuff._cache_aRenamed[cookie];
									
									rezObj.aExtra.aOld = {
										aFileName: fileName,
										nixInotifyFlags: mask
									};
									FSChanges.push(rezObj);
								} else {
									// renamed-from message came first, so just store in _cache_aRenamed
									var rezObj = {
										//aFileName: fileName,
										aEvent: 'renamed',
										aExtra: {
											aOSPath_parentDir_identifier: wd,
											aOld: {
												nixInotifyFlags: mask, // i should pass this, as if user did modify the flags, they might want to figure out what exactly changed
												aFileName: fileName
											}
										}
									}
									nixStuff._cache_aRenamed[cookie] = rezObj;
								}							
							} else {
								var rezObj = {
									aFileName: fileName,
									aEvent: aEvent,
									aExtra: {
										nixInotifyFlags: mask, // i should pass this, as if user did modify the flags, they might want to figure out what exactly changed
										aOSPath_parentDir_identifier: wd
									}
								}
								FSChanges.push(rezObj);
							}
							
							if (len == 0) {
								break;
							};
							i += sizeField0 + sizeField1 + sizeField2 + sizeField3 + parseInt(len);
							console.info('incremented i is now:', i, 'length:', length, 'incremented i by:', (sizeField0 + sizeField1 + sizeField2 + sizeField3 + parseInt(len)));
						} while (i < length);
						
						console.error('loop ended:', 'numElementsRead:', numElementsRead);
						
						if (FSChanges.length > 0) {
							return FSChanges;
						}
					}
				}
			}
			break;
		default:
			throw new Error({
				name: 'watcher-api-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
}
// START - OS Specific - helpers for kqueue
function fetchInodeAndFilenamesInDir(aOSPath) {
	// aOSPath must be path to directory
	// returns object with key as inode and value as obj with {filename: jsStr, lastmod: jsData}
	// currently filenames must be ctypes.char, i dont know if we need to use ctypes.jschar maybe
	
	var obj_inodeAndFns = {};

	// START - popen method
	console.time('popen ls -i');
	var rez_popen = ostypes.API('popen')('ls -i "' + aOSPath + '"', 'r');
	if (ctypes.errno != 0 || rez_popen.isNull()) {
		console.error('Failed rez_popen, errno:', ctypes.errno);
		throw new Error({
			name: 'os-api-error',
			message: 'Failed to popen got "' + rez_popen.toString() + '"',
			uniEerrno: ctypes.errno
		});
	}
	var readInChunksOf = 1000; // bytes
	var readBuf = ctypes.char.array(readInChunksOf)(); // not ostypes.TYPE.char as we are free to use what we want, asit expects a void* link6321887
	var readSize = 0;
	var readChunks = [];
	do { 
		readSize = ostypes.API('fread')(readBuf, ctypes.char.size, readBuf.constructor.size, rez_popen); // ctypes.char link6321887
		if (ctypes.errno != 0) {
			console.error('Failed fread, errno:', ctypes.errno, readSize.toString());
			throw new Error({
				name: 'os-api-error',
				message: 'Failed to fread got "' + readSize.toString() + '"',
				uniEerrno: ctypes.errno
			});
		}
		readChunks.push(readBuf.readString()/*.substring(0, size)*/); // due to ctypes.char can use readString link6321887
	} while (cutils.jscEqual(readSize, readInChunksOf)) // if read less then readInChunksOf size then obviously there's no more
	var rez_pclose = ostypes.API('pclose')(rez_popen);
	if (ctypes.errno != 0 || cutils.jscEqual(rez_pclose, -1)) {
		console.error('Failed rez_popen, errno:', ctypes.errno);
		throw new Error({
			name: 'os-api-error',
			message: 'Failed to popen got "' + rez_pclose.toString() + '"',
			uniEerrno: ctypes.errno
		});
	}
	var readTotal = readChunks.join('');
	//console.info('readTotal:', readTotal.toString());
	var inode_and_filename_patt = /^(\d+) (.*?)$/gm;
	var inode_and_filename_match;
	while (inode_and_filename_match = inode_and_filename_patt.exec(readTotal)) {
		obj_inodeAndFns[inode_and_filename_match[1]] = {
			filename: inode_and_filename_match[2],
			lastmod: OS.File.stat(OS.Path.join(aOSPath, inode_and_filename_match[2])).lastModificationDate.toString()
		}
	}
	console.timeEnd('popen ls -i'); // avg of 25ms max of 55ms

	/* dirent stuff is giving me a headache
	console.error('st opendir');
	var rez_opendir = ostypes.API('opendir')(aOSPath_watchedDir);
	console.info('rez_opendir:', rez_opendir.toString(), uneval(rez_opendir));
	if (ctypes.errno != 0 || rez_opendir.isNull()) {
		console.error('Failed rez_opendir, errno:', ctypes.errno);
		throw new Error({
			name: 'os-api-error',
			message: 'Failed to opendir on "' + aOSPath_watchedDir + '"',
			uniEerrno: ctypes.errno
		});
	}
	var dirent = ostypes.TYPE.dirent();
	var dirent_result = ostypes.TYPE.dirent.ptr();
	while (true) {
		var rez_readdir = ostypes.API('readdir_r')(rez_opendir, dirent.address(), dirent_result.address());
		if (ctypes.errno != 0 || !cutils.jscEqual(rez_readdir, 0)) {
			console.error('Failed readdir_r, errno:', ctypes.errno);
			throw new Error({
				name: 'os-api-error',
				message: 'Failed to readdir_r on "' + aOSPath_watchedDir + '"',
				uniEerrno: ctypes.errno
			});
		}
		console.info('dirent_result:', dirent_result.toString());
		//console.info('dirent:', dirent.toString());
		if (dirent_result.isNull()) {
			console.log('one past last directory entry'); // from testing i learned that the dirent will be the previous entry (meaning the last entry that it had found)
			break;
		} else {
			console.error('HEREEEEEE');
			//console.info('dirent.d_name:', dirent.addressOfField('d_name').toString());
			//console.info('dirent.d_name:', dirent.addressOfField('d_name').readString.toString());
			var dirent_filename = dirent.d_name.readString();
			var dirent_inode = dirent.d_ino;
			var dirent_ftype = dirent.d_type;
			console.info('dirent_filename:', dirent_filename, 'dirent_inode:', dirent_inode.toString());
			bsd_mac_kqStuff.watchedFd[fd].dirStat[dirent_filename] = {
				inode: dirent_inode,
				type: dirent_ftype
			};
		}
	}
	var rez_closedir = ostypes.API('closedir')(rez_opendir);
	if (ctypes.errno != 0 || !cutils.jscEqual(rez_readdir, 0)) {
		console.error('Failed closedir, errno:', ctypes.errno);
		throw new Error({
			name: 'os-api-error',
			message: 'Failed to closedir on "' + aOSPath_watchedDir + '"',
			uniEerrno: ctypes.errno
		});
	}
	*/
	/*
	// fetch OS.File.DirectoryIterator
	var iterator_dirStat = new OS.File.DirectoryIterator(aOSPath_watchedDir);
	try {
		for (var dirEnt in iterator_dirStat) {
			var dirEntStat = OS.File.stat(dirEnt.path);
			bsd_mac_kqStuff.watchedFd[fd].dirStat[dirEntStat.name] = {
				lastModificationDate: dirEntStat.lastModificationDate, //jsDate
				creationDate: (dirEntStat.creationDate || dirEntStat.macBirthDate), //jsDate // used for detecting rename
				lastAccessDate: dirEntStat.lastAccessDate, // used for detecting rename
				size: dirEntStat.size, // used for detecting rename
				unixOwner: dirEntStat.unixOwner, // used for detecting rename
				unixGroup: dirEntStat.unixGroup, // used for detecting rename
				unixMode: dirEntStat.unixMode // used for detecting rename
			}
		}
	} finally {
		iterator_dirStat.close();
	}
	*/
	console.info(obj_inodeAndFns);
	return obj_inodeAndFns;
}
// END - OS Specific - helpers for kqueue
// START - OS Specific - helpers for windows
// START - OS Specific - helpers for osx 10.7+
function js_FSEvStrCB(streamRef, clientCallBackInfo, numEvents, eventPaths, eventFlags, eventIds) {
	console.error('in _js_fsevents_callback aH!!!', 'clientCallBackInfo:', clientCallBackInfo.toString(), 'numEvents:', numEvents.toString(), 'eventPaths:', eventPaths.toString(), 'eventFlags:', eventFlags.toString(), 'eventIds:', eventIds.toString());
	
	var numEv = parseInt(cutils.jscGetDeepest(numEvents));
	console.log('got numEv:', numEv.toString());
	var paths = ctypes.cast(eventPaths, ostypes.TYPE.char.ptr.array(numEv).ptr).contents;
	//console.info('will try to cast:', eventFlags.toString(), 'to:', ostypes.TYPE.FSEventStreamEventFlags.array(numEv).ptr.toString());
	// try {
		var flags = ctypes.cast(eventFlags, ostypes.TYPE.FSEventStreamEventFlags.array(numEv).ptr).contents;
	// } catch(ex) {
		// console.warn('ex on cast flags:', ex.toString());
	// }
	// console.log('flags casted');
	var ids = ctypes.cast(eventIds, ostypes.TYPE.FSEventStreamEventId.array(numEv).ptr).contents;
	// console.log('ids casted');
	
	console.info('.ptr casted', 'paths:', paths.toString(), 'flags:', flags.toString(), 'ids:', ids.toString());
	
	macStuff.FSChanges = [];
	for (var i=0; i<numEv; i++) {
		var aEvent = convertFlagsToAEventStr(cutils.jscGetDeepest(flags[i]));
		var evIdStr = cutils.jscGetDeepest(ids[i]);
		var evId = ctypes.UInt64(evIdStr);
		console.info('contents at ' + i, 'path: ' + paths[i].readString(), 'flags: ' + aEvent + ' | ' + cutils.jscGetDeepest(flags[i]), 'id: ' + evIdStr);
		
		if (aEvent) {
			var fullpath = paths[i].readString();
			var filename = OS.Path.basename(fullpath);
			var dirpath = OS.Path.dirname(fullpath);
			if (aEvent == 'moved-from') {
				if (i+1 < numEv && cutils.jscGetDeepest(flags[i+1]) == '0') {
					var nextFullpath = paths[i+1].readString();
					var nextFilename = OS.Path.basename(nextFullpath);
					var nextDirpath = OS.Path.dirname(nextFullpath);
					if (cutils.jscGetDeepest(flags[i+1]) == '0') {
						// this one is renamed-from
						if (nextDirpath == dirpath) {
							macStuff.FSChanges.push({
								aFileName: nextFilename,
								aEvent: 'renamed',
								aExtra: {
									aOSPath_parentDir: dirpath, // on mainthread side, check if dirpath is in any of the watched paths, if not then dont trigger this callback as its for a subdir BUT im trying to think of a way to do this all in the worker side
									aOld: {
										aFileName: filename
									}
								}
							});
						} else {
							macStuff.FSChanges.push({
								aFileName: filename,
								aEvent: 'removed', // moved from dirpath to nextDirpath (so we mark it as added in nextDirpath) link68743400
								aExtra: {
									aOSPath_parentDir: dirpath, // on mainthread side, check if dirpath is in any of the watched paths, if not then dont trigger this callback as its for a subdir BUT im trying to think of a way to do this all in the worker side
								}
							});
							macStuff.FSChanges.push({
								aFileName: nextFilename, //  (so we mark it as added in nextDirpath) link68743400
								aEvent: 'added',
								aExtra: {
									aOSPath_parentDir: nextDirpath, // on mainthread side, check if dirpath is in any of the watched paths, if not then dont trigger this callback as its for a subdir BUT im trying to think of a way to do this all in the worker side
								}
							});
						}
						i++; // so it skips checking the next 1
					} else {
						console.error('????? aEvent ????? as next entry is not flag of 0 it is:', cutils.jscGetDeepest(flags[i+1]));
							macStuff.FSChanges.push({
								aFileName: filename,
								aEvent: '????? aEvent ?????',
								aExtra: {
									aOSPath_parentDir: dirpath, // on mainthread side, check if dirpath is in any of the watched paths, if not then dont trigger this callback as its for a subdir BUT im trying to think of a way to do this all in the worker side
								}
							});
					}
				} else {
					macStuff.FSChanges.push({
						aFileName: filename,
						aEvent: 'removed',
						aExtra: {
							aOSPath_parentDir: dirpath, // on mainthread side, check if dirpath is in any of the watched paths, if not then dont trigger this callback as its for a subdir BUT im trying to think of a way to do this all in the worker side
						}
					});
				}
			} else {
				macStuff.FSChanges.push({
					aFileName: filename,
					aEvent: aEvent,
					aExtra: {
						aOSPath_parentDir: dirpath // on mainthread side, check if dirpath is in any of the watched paths, if not then dont trigger this callback as its for a subdir BUT im trying to think of a way to do this all in the worker side
					}
				});
			}
		} // aEvent is false meaning it had some flags we dont care to trigger the callback for so dont push it to FSChanges
	}
	
	/*
	// stop runLoopRun
	console.log('attempting to stop the runLoopRun so console message after it happens');
	ostypes.API('FSEventStreamStop')(streamRef);
	ostypes.API('FSEventStreamInvalidate')(streamRef);
	console.log('call to stop completed'); // after FSEventStreamStop and FSEventStreamInvalidate run then the RunLoopRun unblocks and firefox can be closed without hanging/force quit
	*/
	return null;
};
// END - OS Specific - helpers for osx 10.7+
function lpCompletionRoutine_js(dwErrorCode, dwNumberOfBytesTransfered, lpOverlapped) {
	// for Windows only
	
	console.error('in callback!');
	
	console.info('dwErrorCode:', dwErrorCode, 'dwNumberOfBytesTransfered:', dwNumberOfBytesTransfered, 'lpOverlapped.contents:', lpOverlapped.contents.toString());	
	// create new buffer, and re-run ReadDirectoryChangesW
	
	console.info('lpOverlapped.contents.hEvent:', lpOverlapped.contents.hEvent.toString());
	
	//var casted = ctypes.cast(lpOverlapped.contents.hEvent, ostypes.TYPE.FILE_NOTIFY_INFORMATION.ptr).contents;
	var path_id = ctypes.cast(lpOverlapped.contents.hEvent, ctypes.int.ptr).contents;
	console.info('path_id:', path_id.toString());
	
	var hDir_ptrStr = 0;
	for (var p in winStuff.handles_watched) {
		if (winStuff.handles_watched[p].path_id == path_id) {
			hDir_ptrStr = p;
			break;
		}
	}
	
	if (hDir_ptrStr == 0) {
		throw new Error('could not find path_id, this is watcher-api-error');
	}
	
	console.info('found hDir_ptrStr:', hDir_ptrStr.toString());
	var notif_buf = winStuff.handles_watched[hDir_ptrStr].notif_buf;
	console.log('notif_buf:', notif_buf.toString());
	var cPos = 0;
	
	do {
		var fni = ctypes.cast(notif_buf.addressOfElement(cPos), ostypes.TYPE.FILE_NOTIFY_INFORMATION.ptr).contents;
		console.log(cPos, 'fni:', fni.toString());
		var fileNameLen = parseInt(cutils.jscGetDeepest(fni.FileNameLength)) / ostypes.TYPE.WCHAR.size;
		console.log('fileNameLen', fileNameLen);
		var filenamePtr = ctypes.cast(fni.FileName.address(), ostypes.TYPE.WCHAR.array(fileNameLen).ptr);
		console.info('filenamePtr:', filenamePtr.toString());
		var filename = '';
		for (var i=0; i<fileNameLen; i++) {
			filename += filenamePtr.contents[i];
		}
		console.info('filename:', filename);

		var aEvent = convertFlagsToAEventStr(fni.Action);
		
		if (aEvent == 'renamed-from') {
			var rezObj = {
				aExtra: {
					aOld: {
						aFileName: filename
					},
					aOSPath_parentDir_identifier: hDir_ptrStr
				},
				aEvent: 'renamed'
			};
			winStuff.FSChanges.push(rezObj);
		} else if (aEvent == 'renamed-to') {
			winStuff.FSChanges[winStuff.FSChanges.length-1].aFileName = filename;
		} else {
			var rezObj = {
				aFileName: filename,
				aEvent: convertFlagsToAEventStr(fni.Action),
				aExtra: {
					aOSPath_parentDir_identifier: hDir_ptrStr
				}
			};
			winStuff.FSChanges.push(rezObj);
		}
		
		cPos = parseInt(cutils.jscGetDeepest(fni.NextEntryOffset)) / ostypes.TYPE.DWORD.size;
	} while (cPos != 0);
	
	// restart listen
	//winStuff.handles_watched[hDir_ptrStr].notif_buf = ostypes.TYPE.DWORD.array(winStuff.NOTIFICATION_BUFFER_SIZE)();
	var rez_RDC = ostypes.API('ReadDirectoryChanges')(winStuff.handles_watched[hDir_ptrStr].hDirectory, winStuff.handles_watched[hDir_ptrStr].notif_buf.address(), winStuff.handles_watched[hDir_ptrStr].notif_buf.constructor.size, false, winStuff.changes_to_watch, null, winStuff.handles_watched[hDir_ptrStr].o.address(), winStuff.lpCompletionRoutine);
	console.info('rez_RDC:', rez_RDC.toString(), uneval(rez_RDC));

	//console.error('ok got here didnt hang, this is good as i wanted it async');
	
	if (rez_RDC == false || ctypes.winLastError != 0) {
		console.error('Failed rez_RDC, winLastError:', ctypes.winLastError);
		throw new Error({
			name: 'os-api-error',
			message: 'Failed to ReadDirectoryChanges on handle: ' + hDirectory_ptrStr,
			winLastError: ctypes.winLastError
		});
	}
	return null;
}
// END - OS Specific - helpers for windows

function convertFlagsToAEventStr(flags) {
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				var default_flags = {
					FILE_ACTION_ADDED: 'added',
					FILE_ACTION_REMOVED: 'removed',
					FILE_ACTION_MODIFIED: 'contents-modified',
					FILE_ACTION_RENAMED_OLD_NAME: 'renamed-from',
					FILE_ACTION_RENAMED_NEW_NAME: 'renamed-to'
				};
				for (var f in default_flags) {
					if (flags == ostypes.CONST[f]) {
						return default_flags[f];
					}
				}
				return 'UNKNOWN FLAG';
				
			break;
		case 'darwin':
		case 'freebsd':
		case 'openbsd':
		
				if (core.os.name != 'darwin' /*is bsd*/ || core.os.version < 7 /*is old mac*/) {
			
					// kqueue
					
					var default_flags = { // shoud be whatever is passed in FSWatcherWorker.js addPathToWatcher function
						NOTE_WRITE: 'contents-modified',
						NOTE_DELETE: 'deleted',
						NOTE_RENAME: 'renamed',
						NOTE_EXTEND: 'note extended - i dont know what this action entails',
						NOTE_LINK: 'note link - i dont know what this action entails',
						NOTE_UNLINK: 'note unlink - i dont know what this action entails',
						NOTE_REVOKE: 'note revoke - i dont know what this action entails',
						NOTE_ATTRIB: 'note attrib - i dont know what this action entails'
					};
					for (var f in default_flags) {
						if (flags & ostypes.CONST[f]) {
							return default_flags[f];
						}
					}
					return 'UNKNOWN FLAG';
				} else {
					// its mac and os.version is >= 10.7
					// use FSEventFramework
					
					var default_flags = {
						kFSEventStreamEventFlagItemCreated: 'added',
						kFSEventStreamEventFlagItemRemoved: 'removed',
						kFSEventStreamEventFlagItemRenamed: 'moved-from',
						kFSEventStreamEventFlagItemModified: 'contents-modified'
					};
					if (flags == '0') {
						return 'moved-to or watched-dir deleted';
					}
					for (var f in default_flags) {
						if (flags & ostypes.CONST[f]) {
							if (flags & ostypes.CONST.kFSEventStreamEventFlagMustScanSubDirs) {
								console.error(default_flags[f] + ' | SUBDIR?');
							}
							return default_flags[f];
						}
					}
					return false;
				}
				
			break;
		case 'linux':
		case 'webos': // Palm Pre // im guessng this has inotify, untested
		case 'android': // im guessng this has inotify, untested
		
				var default_flags = { // shoud be whatever is passed in FSWatcherWorker.js addPathToWatcher function
					IN_CLOSE_WRITE: 'contents-modified',
					IN_MOVED_TO: 'renamed-to', // can also be a added
					IN_DELETE: 'removed',
					IN_MOVED_FROM: 'renamed-from', // can also be a removed
					IN_CREATE: 'added'
				};
				
				/*
				default_flags.IN_MODIFY = 'modded';
				var allFlags = '';
				for (var f in default_flags) {
					if (flags & ostypes.CONST[f]) {
						allFlags += default_flags[f];
						//return default_flags[f];
					}
				}
				return allFlags;
				*/
				
				for (var f in default_flags) {
					if (flags & ostypes.CONST[f]) {
						return default_flags[f];
					}
				}
				return 'UNKNOWN FLAG';

			break;
		default:
			throw new Error({
				name: 'watcher-api-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
}
