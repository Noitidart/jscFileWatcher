## Announcements
###### ***September 7, 2016*** - Finally, in working order. Just note: (1) FSEvents differs for Mac on version <10.7 - I do not have any means to test there so I could not address this yet. (2) Multiple events if you watch a subdir that has a parent-directory already being watched [Issue #25](https://github.com/Noitidart/jscFileWatcher/issues/25) (3) Order of events is not perfect on mac/*nix due to [Issue #24](https://github.com/Noitidart/jscFileWatcher/issues/24)

## Demo
Download `CommPlayground.xpi` and load it as a temporary addon from `about:debugging` from here - [Noitidart/CommPlayground ::  Branch:jscfilewatcher-demo](https://github.com/Noitidart/CommPlayground/tree/jscfilewatcher-demo).

It will watch your Desktop (`OS.Constants.Path.desktopDir`). If Android, it will watch your profile directory (`OS.Constants.Path.profileDir`). Do any file changes there and you will see messages logged to the "Browse Console".

## Dependency Submodules
Make sure to import [Noitidart/ostypes](https://github.com/Noitidart/ostypes) and [Noitidart/Comm](https://github.com/Noitidart/Comm) submodules first.

## About
This code is meant to be used from a `ChromeWorker`. This is the central area you will control it from.

The main thread portion, `dwMainthreadSubscript.js` is only needed because I could not yet figure out how to run the GIOFileMonitor from a thread - [Issue #22](https://github.com/Noitidart/jscFileWatcher/issues/22). GIOFileMonitor is needed for BSD and Solaris systems. These do not have inotify. On BSD we tried kqueue, however it had a blocker -  [Issue #19](https://github.com/Noitidart/jscFileWatcher/issues/19). It also had [Issue #10](https://github.com/Noitidart/jscFileWatcher/issues/10) however this was not a blocking reason. On Solaris, we can use FEN, we didn't try it yet, but we did some work on it in the past.

You create a watcher like this:

	var myFirstWatcher = new OS.File.DirectoryWatcher(function(aPath, aEventType, aOldName) {

	});

	var mySecondWatcher = new OS.File.DirectoryWatcher(function(aPath, aEventType, aOldName) {

	});

The `aPath` argument is the system path to the affected entry in the directory. `aEventType` is one of the following strings: `ADDED`, `REMOVED`, `RENAMED`, or `CONTENTS_MODIFIED`. The argument `aOldName` is `undefined` except when `aEventType` is `RENAMED`. In this case `aOldName` will be the old name.

You then add paths to the watchers like this:

	myFirstWatcher.addPath('system path goes here');

You can remove paths with

	myFirstWatcher.removePath('system path goes here');

You can remove all paths and destroy the watcher with `close`:

	myFirstWatcher.close();

## How to implement in your code
### Step 1 - Import Submodules
Import "ostypes", "Comm", and "jscFileWatcher" submodules. This is how you import submodules:

    git submodule add git@github.com:Noitidart/jscFileWatcher OPTIONAL/CUSTOM/FOLDER/PATH/HERE

### Step 2 - Create Paths JSON File
In the directory containing the "jscFileWatcher" submodule directory, place a file called `dwPaths.json` and populate the paths to the submodule directories like this:

	{
		"comm": "chrome://jscfilewatcher-demo/content/resources/scripts/Comm/Comm.js",
		"ostypes_dir": "chrome://jscfilewatcher-demo/content/resources/scripts/ostypes/",
		"watcher_dir": "chrome://jscfilewatcher-demo/content/resources/scripts/watcher/"
	}

### Step 3 - Main Thread Subscript
In `bootstrap.js` or `main.js` or whatever you are using for your main thread, after you have imported `Comm` and `ostypes` import `dwMainthreadSubscript.js`. From `Comm`, `callInMainworker` also needs to be declared.

	var callInMainworker = CommHelper.bootstrap.callInMainworker;
    Services.scriptloader.loadSubScript('YOUR/PATH/TO/JSCFILEWATCHER/shtkMainthreadSubscript.js');

#### Handle termination
To the worker you spawned with `Comm`, you will need to call `dwShutdown` and include it as a promise so `Comm` will wait for that to finish before terminating the worker.

If you don't have any other work done in the termination use this:

    function onBeforeTerminate() {
        return new Promise(resolve =>
            callInMainworker( 'dwShutdown', null, ()=>resolve() )
        );
    }

Reminder: With `Comm` if you want to wait for multiple things before termination do it like this:

function onBeforeTerminate() {
	return Promise.all([
		new Promise(resolve =>
			callInMainworker( 'dwShutdown', null, ()=>resolve() )
		),
		new Promise(resolve =>
			// some other stuff
			resolve();
		),
		function() {
			// you can have synchronus functions within `Promise.all` that do not return a promise, it is totally fine
		}
	]);
}

Reminder: This is how to do a pre termination call with `Comm`:

    gWkComm = new Comm.server.worker('YOUR/PATH/TO/MainWorker.js', undefined, undefined, onBeforeTerminate )

### Step 4 - ChromeWorker Subscript
Make sure to first `importScripts` `OS.File` `Comm` and `ostypes` submodule then import `dwMainworkerSubscript.js`

	importScripts('resource://gre/modules/osfile.jsm');
	importScripts('YOUR/PATH/TO/JSCFILEWATCHER/dwMainworkerSubscript.js');

	// you can now use it
	var watcher = new OS.File.DirectoryWatcher(function(aPath, aEventType, aOldName) {
		console.log(aEventType, aPath, aOldName);
	});
	watcher.addPath('C:\\bin');

You do not have to remove all the paths or `watcher.close()` before shutdown, `dwShutdown` procedure will handle clean up of anything that is running.
