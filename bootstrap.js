const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const core = {
	name: 'jscFileWatcher',
	id: 'jscFileWatcher@jetpack',
	path: {
		chrome: 'chrome://jscfilewatcher/content/',
		locale: 'chrome://jscfilewatcher/locale/'
	},
	aData: 0
};


const myServices = {};
var PromiseWorker;
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/osfile.jsm');
Cu.import('resource://gre/modules/devtools/Console.jsm');
XPCOMUtils.defineLazyGetter(myServices, 'hph', function () { return Cc['@mozilla.org/network/protocol;1?name=http'].getService(Ci.nsIHttpProtocolHandler); });

var stringBundle = Services.strings.createBundle(core.path.locale + 'global.properties?' + Math.random()); // Randomize URI to work around bug 719376
var cOS = OS.Constants.Sys.Name.toLowerCase();
var myWorker;

function startWorker() {
	myWorker = new PromiseWorker(core.path.chrome + 'modules/workers/myWorker.js');
	
	var objInfo = {};
	switch (cOS) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			objInfo.OSVersion = parseFloat(Services.sysinfo.getProperty('version'));
			if (objInfo.OSVersion >= 6.1) {
				objInfo.isWin7 = true;
			} else if (objInfo.OSVersion == 5.1 || objInfo.OSVersion == 5.2) {
				objInfo.isWinXp = true;
			}
			break;
			
		case 'darwin':
			var userAgent = myServices.hph.userAgent;
			//console.info('userAgent:', userAgent);
			var version_osx = userAgent.match(/Mac OS X 10\.([\d]+)/);
			//console.info('version_osx matched:', version_osx);
			
			if (!version_osx) {
				throw new Error('Could not identify Mac OS X version.');
			} else {		
				objInfo.OSVersion = parseFloat(version_osx[1]);
			}
			break;
		default:
			// nothing special
	}
	
	objInfo.FFVersion = Services.appinfo.version;
	objInfo.FFVersionLessThan30 = (Services.vc.compare(Services.appinfo.version, 30) < 0);
	
	var promise_initWorker = myWorker.post('init', [objInfo]);
	promise_initWorker.then(
		function(aVal) {
			console.log('Fullfilled - promise_initWorker - ', aVal);
			// start - do stuff here - promise_initWorker
			// end - do stuff here - promise_initWorker
		},
		function(aReason) {
			var rejObj = {name:'promise_initWorker', aReason:aReason};
			console.error('Rejected - promise_initWorker - ', rejObj);
			//deferred_createProfile.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_initWorker', aCaught:aCaught};
			console.error('Caught - promise_initWorker - ', rejObj);
			//deferred_createProfile.reject(rejObj);
		}
	);
	// should maybe test if the promise was successful
}

function main() {
	/*
	var promise_doOsAlert = myWorker.post('doOsAlert', [stringBundle.GetStringFromName('startup_prompt_title'), stringBundle.GetStringFromName('startup_prompt_msg')]);
	promise_doOsAlert.then(
		function(aVal) {
			console.log('Fullfilled - promise_doOsAlert - ', aVal);
			// start - do stuff here - promise_doOsAlert
			
			// end - do stuff here - promise_doOsAlert
		},
		function(aReason) {
			var rejObj = {name:'promise_doOsAlert', aReason:aReason};
			console.error('Rejected - promise_doOsAlert - ', rejObj);
			//deferred_createProfile.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_doOsAlert', aCaught:aCaught};
			console.error('Caught - promise_doOsAlert - ', rejObj);
			//deferred_createProfile.reject(rejObj);
		}
	);
	*/
	
	switch (cOS) {
		case 'linux':
		case 'freebsd':
		case 'openbsd':
		case 'sunos':
		case 'webos': // Palm Pre
		case 'android':
			//new ostypes.API.;
			var promise_initWatch = myWorker.post('initWatch', [
				OS.Constants.Path.desktopDir,
				{
					masks: 0x00000001 /*ostypes.CONST.IN_ACCESS*/
				}
			]);
			promise_initWatch.then(
				function(aVal) {
					console.log('Fullfilled - promise_initWatch - ', aVal);
					// start - do stuff here - promise_initWatch
					// end - do stuff here - promise_initWatch
				},
				function(aReason) {
					var rejObj = {name:'promise_initWatch', aReason:aReason};
					console.error('Rejected - promise_initWatch - ', rejObj);
					//deferred_createProfile.reject(rejObj);
				}
			).catch(
				function(aCaught) {
					var rejObj = {name:'promise_initWatch', aCaught:aCaught};
					console.error('Caught - promise_initWatch - ', rejObj);
					//deferred_createProfile.reject(rejObj);
				}
			);
			break;
		default:
			throw new Error(['os-unsupported', OS.Constants.Sys.Name]);
	}
	
}

function install() {}
function uninstall() {}

function startup(aData, aReason) {
	core.aData = aData;
	PromiseWorker = Cu.import(core.path.chrome + 'modules/PromiseWorker.jsm').BasePromiseWorker;
	
	//Services.prompt.alert(null, stringBundle.GetStringFromName('startup_prompt_title'), stringBundle.GetStringFromName('startup_prompt_title'));
	
	
	startWorker();
	
	
	
	main();
}
 
function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) { return }
	Cu.unload(core.path.chrome + 'modules/PromiseWorker.jsm');
}
