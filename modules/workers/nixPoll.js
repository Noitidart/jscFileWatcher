'use strict';
importScripts('resource://gre/modules/workers/require.js');

var core = {
  name: 'jscFileWatcher',
  id: 'jscFileWatcher@jetpack',
  path: {
    chrome: 'chrome://jscfilewatcher/content/',
    locale: 'chrome://jscfilewatcher/locale/'
  },
  aData: 0
};

importScripts(core.path.chrome + 'modules/cutils.jsm');

var cOS = 'linux';

self.onmessage = function (msg) {
	pollThis(msg.data);
}


function pollThis(fd, restartAfterChange) {
	var count = 1024 + ostypes.TYPE.inotify_event.size; //size_t
	var buf = ctypes.char.array(count)();
      var i = 0;
      while (true) {      
		var length = ostypes.API('read')(fd, buf.address(), count);
		if (length === -1) {
			throw new Error('read failed');
		} else if (length > 0) {
			// something happend, read struct
			var casted = ctypes.cast(buf.addressOfElement(0), ostypes.TYPE.inotify_event.ptr).contents;
			//var fname = casted.addressOfField('fname').readString();
			console.info('casted:', casted.toString());
			self.postMessage('change found');
			if (!restartAfterChange) {
				break;
			}
		}
      }
}