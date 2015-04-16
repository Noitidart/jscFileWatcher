/*jshint esnext: true, moz: true*/
'use strict';
var EXPORTED_SYMBOLS = ['ostypes'];

if (ctypes.voidptr_t.size === 4 /* 32-bit */) {
  var is64bit = false;
} else if (ctypes.voidptr_t.size === 8 /* 64-bit */) {
  var is64bit = true;
} else {
  throw new Error('huh??? not 32 or 64 bit?!?!');
}

var sunosTypes = function() {
  this.FILE = ctypes.StructType('FILE', [ // http://tigcc.ticalc.org/doc/stdio.html#FILE
    { fpos: ctypes.char.ptr },                               /* Current position of file pointer (absolute address) */
    { base: ctypes.void_t.ptr },                           /* Pointer to the base of the file */
    { handle: ctypes.unsigned_short },             /* File handle */
    { flags: ctypes.short },                                   /* Flags (see FileFlags) */
    { unget: ctypes.short },                                 /* 1-byte buffer for ungetc (b15=1 if non-empty) */
    { alloc: ctypes.unsigned_long },                  /* Number of currently allocated bytes for the file */
    { buffincrement: ctypes.unsigned_short }  /* Number of bytes allocated at once */
  ]);
  
  this.timespec = ctypes.StructType('timespec', [
    { tv_sec: ctypes.long },
    { tv_nsec: ctypes.long }
  ]);

  this.timestruc_t = this.timespec;
  
  this.file_obj = ctypes.StructType('file_obj', [
    { fo_atime: this.timestruc_t },    /* Access time from stat(2) */
    { fo_mtime: this.timestruc_t },   /* Modification time from stat(2) */
    { fo_ctime: this.timestruc_t },     /* Change time from stat(2) */
    { fo_pad: ctypes.uintptr_t },       /* For future expansion */
    { fo_name: ctypes.char.ptr },      /* Null terminated file name */
  ]);
  
  this.fileinfo = ctypes.StructType('fileinfo', [
    { fobj: this.file_obj },
    { events: ctypes.int },
    { port: ctypes.int }
  ]);
  
  this.port_event = ctypes.StructType('port_event', [
    { portev_events: ctypes.int },                      /* event data is source specific */
    { portev_source: ctypes.unsigned_short }, /* event source */
    { portev_pad: ctypes.unsigned_short },    /* port internal use */
    { portev_object: ctypes.uintptr_t },            /* source specific object */
    { portev_user: ctypes.void_t.ptr }              /* user cookie */
  ]);

  this.stat = ctypes.StructType('stat', [ // http://opensolarisforum.org/man/man2/stat.html
    { st_mode: ctypes.unsigned_int },          /* File mode (see mknod(2)) */
    { st_ino: is64bit ? ctypes.unsigned_long_long : ctypes.unsigned_long }, /* Inode number */
    { st_dev: ctypes.unsigned_long },   /* ID of device containing */
    /* a directory entry for this file */
    { st_rdev: ctypes.unsigned_long },   /* ID of device */
    /* This entry is defined only for */
    /* char special or block special files */
    { st_nlink: ctypes.short },       /* Number of links */
    { st_uid: ctypes.unsigned_int },           /* User ID of the file’s owner */
    { st_gid: ctypes.unsigned_int  },           /* Group ID of the file’s group */
    { st_size: is64bit? ctypes.long_long : ctypes.long },       /* File size in bytes */
    { st_atime: ctypes.long },        /* Time of last access */
    { st_mtime: ctypes.long },        /* Time of last data modification */
    { st_ctime: ctypes.long },       /* Time of last file status change */
    /* Times measured in seconds since */
    /* 00:00:00 UTC, Jan. 1, 1970 */
    { st_blksize: ctypes.long },     /* Preferred I/O block size */
    { st_blocks: ctypes.long },    /* Number of 512 byte blocks allocated*/
    { st_fstype: ctypes.char }    /* Null-terminated type of filesystem */
  ]);
  
  this._pthread_attr_t = ctypes.StructType('pthread_attr_t', [
    { _pthread_attr_tp: ctypes.void_t.ptr }
  ]);
};

var sunosInit = function() {
  var self = this;
  
  this.TYPE = new sunosTypes();
  
  var lib = function() {
    var cache;
    return function() {
      return cache || (cache = ctypes.open('libc.so'));
    };
  }();
  var _api = {};
  this.API = function(declaration) { // it means ensureDeclared and return declare. if its not declared it declares it. else it returns the previously declared.
    if (!(declaration in _api)) {
      _api[declaration] = preDec[declaration](); //if declaration is not in preDec then dev messed up
    }
    return _api[declaration];
  };
  var preDec = { //stands for pre-declare (so its just lazy stuff) //this must be pre-populated by dev // do it alphabateized by key so its ez to look through
    close: function() {
     /* https://en.wikipedia.org/wiki/Close_%28system_call%29
      * int close(
      *   int fd
      * );
      */
      return lib().declare("close", ctypes.default_abi, 
        ctypes.int, // return
        ctypes.int // filedes
      );
    },
    fgets: function() {
     /* https://docs.oracle.com/cd/E19253-01/816-5168/6mbb3hr8o/index.html
      * char *fgets(
      *   char *s,
      *   int n,
      *   FILE *stream
      * );
      */
      return lib().declare('fgets', ctypes.default_abi, 
        ctypes.char.ptr, // return
        ctypes.char.ptr, 
        ctypes.int, 
        self.TYPE.FILE.ptr
      );
    }, 
    port_associate: function() {
     /* https://docs.oracle.com/cd/E19253-01/816-5168/6mbb3hri4/index.html
      * int port_associate(
      *   int port, 
      *   int source, 
      *   uintptr_t object,
      *   int events, 
      *   void *user
      * );
      */
      return lib().declare('port_associate', ctypes.default_abi,
        ctypes.int,           // return        
        ctypes.int,           // port
        ctypes.int,           // source 
        ctypes.uintptr_t, // object
        ctypes.int,           // events
        ctypes.void_t.ptr // user
      );
    },
    port_create: function() { 
      /* https://docs.oracle.com/cd/E19253-01/816-5168/6mbb3hri5/index.html
      * int port_create(
      *   void
      * );
      */
      return lib().declare('port_create', ctypes.default_abi, 
        ctypes.int // return
      );
    },
    port_dissociate: function() {
     /* https://docs.oracle.com/cd/E19253-01/816-5168/6mbb3hri4/index.html
      * int port_dissociate(
      *   int port, 
      *   int source, 
      *   uintptr_t object
      * );
      */
      return lib().declare("port_dissociate", ctypes.default_abi, 
         ctypes.int,         // return
         ctypes.int,          // port
         ctypes.int,          // source
         ctypes.uintptr_t // object
        );
    },
    port_get: function() {
     /* https://docs.oracle.com/cd/E19253-01/816-5168/6mbb3hri7/index.html
      * int port_get(
      *   int port, 
      *   port_event_t *pe,
      *   const timespec_t *timeout
      * );
      */
      return lib().declare('port_get', ctypes.default_abi, 
         ctypes.int,                        // return
         ctypes.int,                        // port
         self.TYPE.port_event.ptr, // pe
         self.TYPE.timespec.ptr    // timeout
        );
    },
    pthread_create: function() {
     /* https://docs.oracle.com/cd/E19253-01/816-5168/6mbb3hrld/index.html
      * int pthread_create(
      *   pthread_t *restrict thread,
      *   const pthread_attr_t *restrict attr,
      *   void *(*start_routine)(void*), 
      *   void *restrict arg
      *);
      */
      return lib().declare('pthread_create', ctypes.default_abi,
        ctypes.int, // return
        ctypes.unsigned_int.ptr,    // restrict thread
        self.TYPE._pthread_attr_t.ptr, // restrict attr
        ctypes.void_t.ptr,               // unknown
        ctypes.void_t.ptr               // restrict arg                    
      );
    },
    stat: function() {
     /* https://en.wikipedia.org/wiki/Stat_%28system_call%29
      * int stat(
      *   const char *filename, 
      *   struct stat *buf
      * );
      */
      return lib().declare('stat', ctypes.default_abi,
        ctypes.int,              // return    
        ctypes.char.ptr,      // filename
        self.TYPE.stat.ptr  // buf
      );
    }
  };
  
  this.CONST = {
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
};
var ostypes = new sunosInit();
