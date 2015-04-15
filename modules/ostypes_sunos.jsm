//  A skeleton with needed masks, structures and methods. 
// Please convert it to your skeleton and rearange keys in an alphabetical way! Thanks!
// https://blogs.oracle.com/praks/entry/file_events_notification
let lib = ctypes.open("libc.so");
let masks = {
  PORT_SOURCE_AIO: 1,
  PORT_SOURCE_TIMER: 2,
  PORT_SOURCE_USER: 3,
  PORT_SOURCE_FD: 4,
  PORT_SOURCE_ALERT: 5,
  PORT_SOURCE_MQ: 6,
  PORT_SOURCE_FILE: 7,
  PORT_SOURCE_POSTWAIT: 8,
  
  /* port_alert() flags */
  PORT_ALERT_SET: 0x01,
  PORT_ALERT_UPDATE: 0x02,
  PORT_ALERT_INVALID: 0x03,
  
  FILE_ACCESS:               0x00000001,
  FILE_MODIFIED:          0x00000002,
  FILE_ATTRIB:                0x00000004,
  FILE_NOFOLLOW:        0x10000000,
  FILE_DELETE:               0x00000010,
  FILE_RENAME_TO:      0x00000020,
  FILE_RENAME_FROM: 0x00000040,
  UNMOUNTED:             0x20000000,
  MOUNTEDOVER:          0x40000000,
  
  get FILE_EXCEPTION() {
    return this.UNMOUNTED | this.FILE_DELETE | this.FILE_RENAME_TO | this. FILE_RENAME_FROM | this.MOUNTEDOVER;
  }
};
let structures = { 
  port_event: ctypes.StructType("port_event", [
    { portev_events: ctypes.int },                      /* event data is source specific */
    { portev_source: ctypes.unsigned_short }, /* event source */
    { portev_pad: ctypes.unsigned_short },    /* port internal use */
    { portev_object: ctypes.uintptr_t },            /* source specific object */
    { portev_user: ctypes.void_t.ptr }              /* user cookie */
  ]),
  timespec: ctypes.StructType("timespec", [
    { tv_sec: ctypes.long },
    { tv_nsec: ctypes.long }
  ]),
  timestruc_t: (function(){ return this.timespec; })(),
  file_obj: ctypes.StructType("file_obj", [
    { fo_atime: this.timestruc_t },    /* Access time from stat(2) */
    { fo_mtime: this.timestruc_t },   /* Modification time from stat(2) */
    { fo_ctime: this.timestruc_t },     /* Change time from stat(2) */
    { fo_pad: ctypes.uintptr_t },       /* For future expansion */
    { fo_name: ctypes.char.ptr },      /* Null terminated file name */
  ]),
  fileinfo: ctypes.StructType("fileinfo", [
    { fobj: this.file_obj },
    { events: ctypes.int },
    { port: ctypes.int }
  ]),
  _pthread_attr_t: ctypes.StructType("pthread_attr_t", [
    { _pthread_attr_tp: ctypes.void_t }
  ]),
  stat: {} //  http://opensolarisforum.org/man/man2/stat.html
  //https://pastebin.mozilla.org/8830161 not sure about stat structure - there are a few defined.
};
let methods = {
  close: lib.declare("close", ctypes.default_abi, ctypes.int, ctypes.int), // https://en.wikipedia.org/wiki/Close_%28system_call%29
  fgets: lib.declare("fgets", ctypes.default_abi, ctypes.char.ptr, ctypes.char.ptr, ctypes.int /*, FILE.ptr - unknown type yet*/), // https://docs.oracle.com/cd/E19253-01/816-5168/6mbb3hr8o/index.html
  port_associate: lib.declare("port_associate", ctypes.default_abi, ctypes.int, ctypes.int, ctypes.int, ctypes.uintptr_t, ctypes.int, ctypes.void_t.ptr), // https://docs.oracle.com/cd/E19253-01/816-5168/6mbb3hri4/index.html
  port_create: lib.declare("port_create", ctypes.default_abi, ctypes.int), // https://docs.oracle.com/cd/E19253-01/816-5168/6mbb3hri5/index.html
  port_dissociate: lib.declare("port_dissociate", ctypes.default_abi, cytypes.int, ctypes.int, ctypes.int, ctypes.uintptr_t), // https://docs.oracle.com/cd/E19253-01/816-5168/6mbb3hri4/index.html
  port_get: lib.declare("port_get", ctypes.default_abi, ctypes.int, ctypes.int,  structures.port_event.ptr, structures.timespec.ptr),  // https://docs.oracle.com/cd/E19253-01/816-5168/6mbb3hri7/index.html
  pthread_create: lib.declare("pthread_create", ctypes.default_abi, ctypes.int, ctypes.unsigned_int.ptr, structures._pthread_attr_t, ctypes.void_t.ptr, ctypes.void_t.ptr), // https://docs.oracle.com/cd/E19253-01/816-5168/6mbb3hrld/index.html
  stat: lib.declare("stat", ctypes.default_abi, ctypes.int, ctypes.char.ptr, structures.stat.ptr) // https://en.wikipedia.org/wiki/Stat_%28system_call%29
}
