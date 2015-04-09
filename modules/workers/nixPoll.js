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
importScripts(core.path.chrome + 'modules/ostypes_nix.jsm');

var cOS = 'linux';

self.onmessage = function (msg) {
	// msg must be fd
	pollThis(msg.data, true);
};


function pollThis(fd, restartAfterChange) {
	console.log('ok in pollThis of nixPoll');
    var count = ostypes.TYPE.inotify_event.size; //size_t
    var buf = ctypes.ArrayType(ostypes.TYPE.char, count)(); // docs page here http://linux.die.net/man/7/inotify says sizeof(struct inotify_event) + NAME_MAX + 1 will be sufficient to read at least one event.
    console.log('starting the loop, fd:', fd, 'count:', count);
    var length = ostypes.API('read')(fd, buf, count);
    if (cutils.jscEqual(length, -1)) {
      console.error('read failed with -1 and errno: ' + ctypes.errno);
      throw new Error('read failed with -1 and errno: ' + ctypes.errno);
    } else if (!cutils.jscEqual(length, 0)) {
      // then its > 0 as its not -1
      // something happend, read struc
      let i = 0;
      while (i < length) {
		let casted = ctypes.cast(buf.addressOfElement(i), ostypes.TYPE.inotify_event.ptr).contents;
		console.log('casted:', casted.toString());
		let file_name = casted.addressOfField('name').contents.readString();
		console.info('file_name:', file_name);
        i += count + (+casted.addressOfField('len').contents.readString());
		self.postMessage('change found');
		if (!restartAfterChange) {
		  break;
		}
      }
    }
    pollThis(fd);
	  // maybe close fd here? not sure if we need to if terminate
	  console.log('ok loop done of pollThis of nixPoll');
}
