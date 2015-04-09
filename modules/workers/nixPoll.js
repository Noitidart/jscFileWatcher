/*jshint node:true, esnext: true, moz: true, worker: true*/
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


self.onmessage = msg => pollThis(msg.data);

function pollThis(fd) { // we must an option to stop the loop!
  var count = 1024 * ostypes.TYPE.inotify_event.size; //size_t
  var buf = ctypes.char.array(count)();
  var length = ostypes.API('read')(fd, buf.address(), count);
  //var changes = new Set(); // Look L34
  if (length === -1) {
    self.postMessage('error');
    throw new Error('read failed');
  } else {
    let i = 0;
    while (i < length) {
      let casted = ctypes.cast(buf.addressOfElement(0), ostypes.TYPE.inotify_event.ptr).contents; // Dunno how to get a field "len"
      i += ostypes.TYPE.inotify_event.size; // its compulsory to have this field len to sum up the stuff
      self.postMessage('change found', casted); // I dont know whether we want to trigger a callback with each time or send a set with changes. What do you think is better?
    }
    console.log('ok loop done of pollThis of nixPoll. Starting a new loop');
    pollThis(fd);
  }
}
