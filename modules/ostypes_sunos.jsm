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
  // ABIs
  this.ABI = ctypes.default_abi;
  this.CALLBACK_ABI = ctypes.default_abi;
  
  // Re-defining c types
  this.int = ctypes.int;
  this.unsigned_int = ctypes.unsigned_int;
  this.char = ctypes.char;
  this.void_t = ctypes.void_t;
  this.voidptr_t = ctypes.voidptr_t;
  this.short = ctypes.short;
  this.unsigned_short = ctypes.unsigned_short;
  this.long = ctypes.long;
  this.longlong_t = ctypes.long_long;
  this.unsigned_long = ctypes.unsigned_long;
  this.u_longlong_t = ctypes.unsigned_long_long;
  this.uintptr_t  = ctypes.uintptr_t;
  this.ushort_t  = ctypes.unsigned_short;
  this.void = ctypes.void_t;
  
  // SIMPLE TYPES
  this.suseconds_t  = ctypes.long;
  this.time_t = ctypes.long;
  this.mode_t = ctypes.unsigned_int;
  this.ino_t = is64bit ? ctypes.unsigned_long_long : ctypes.unsigned_long;
  this.dev_t = ctypes.unsigned_long;
  this.nlink_t = ctypes.short;
  this.uid_t = ctypes.unsigned_int;
  this.gid_t = ctypes.unsigned_int;
  this.off_t = is64bit? ctypes.long_long : ctypes.long;
  this.blkcnt_t = ctypes.long; 
  this.pthread_t = ctypes.unsigned_int;
  
  this.FILE = ctypes.StructType('FILE', [ // http://tigcc.ticalc.org/doc/stdio.html#FILE
    { fpos: this.char.ptr },                               /* Current position of file pointer (absolute address) */
    { base: this.void.ptr },                           /* Pointer to the base of the file */
    { handle: this.unsigned_short },             /* File handle */
    { flags: this.short },                                   /* Flags (see FileFlags) */
    { unget: this.short },                                 /* 1-byte buffer for ungetc (b15=1 if non-empty) */
    { alloc: this.unsigned_long },                  /* Number of currently allocated bytes for the file */
    { buffincrement: this.unsigned_short }  /* Number of bytes allocated at once */
  ]);
  
  this.timespec_t = ctypes.StructType('timespec_t', [
    { tv_sec: this.time_t },
    { tv_nsec: this.suseconds_t }
  ]);

  this.timestruc_t = this.timespec_t;
  
  this.file_obj = ctypes.StructType('file_obj', [
    { fo_atime: this.timestruc_t }, /* Access time from stat(2) */
    { fo_mtime: this.timestruc_t }, /* Modification time from stat(2) */
    { fo_ctime: this.timestruc_t }, /* Change time from stat(2) */
    { fo_pad: this.uintptr_t }, /* For future expansion */
    { fo_name: this.char.ptr }, /* Null terminated file name */
  ]);
  
  this.fileinfo = ctypes.StructType('fileinfo', [
    { fobj: this.file_obj },
    { events: this.int },
    { port: this.int }
  ]);
    
  this.port_event_t = ctypes.StructType('port_event_t', [
    { portev_events: this.int },  /* event data is source specific */
    { portev_source: this.ushort_t }, /* event source */
    { portev_pad: this.ushort_t },    /* port internal use */
    { portev_object: this.uintptr_t },  /* source specific object */
    { portev_user: this.void.ptr }  /* user cookie */
  ]);
  
  this.stat = ctypes.StructType('stat', [ // http://opensolarisforum.org/man/man2/stat.html
    { st_mode: this.mode_t }, /* File mode (see mknod(2)) */
    { st_ino: this.ino_t  }, /* Inode number */
    { st_dev: this.dev_t  },   /* ID of device containing */
    /* a directory entry for this file */
    { st_rdev: this.dev_t },   /* ID of device */
    /* This entry is defined only for */
    /* char special or block special files */
    { st_nlink: this.nlink_t },       /* Number of links */
    { st_uid: this.uid_t },           /* User ID of the file’s owner */
    { st_gid: this.gid_t },           /* Group ID of the file’s group */
    { st_size: this.off_t },       /* File size in bytes */
    { st_atime: this.time_t },        /* Time of last access */
    { st_mtime: this.time_t },        /* Time of last data modification */
    { st_ctime: this.time_t },       /* Time of last file status change */
    /* Times measured in seconds since */
    /* 00:00:00 UTC, Jan. 1, 1970 */
    { st_blksize: this.long },     /* Preferred I/O block size */
    { st_blocks: this.blkcnt_t },    /* Number of 512 byte blocks allocated*/
    { st_fstype: this.char }    /* Null-terminated type of filesystem */
  ]);
  
  this.start_routine = ctypes.FunctionType(this.CALLBACK_ABI, this.void.ptr, [this.void.ptr]);

  this.pthread_attr_t = ctypes.StructType('pthread_attr_t', [
    { _pthread_attr_tp: this.void.ptr }
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
      return lib().declare("close", self.TYPE.ABI, 
        self.TYPE.int, // return
        self.TYPE.int // filedes
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
      return lib().declare('fgets', self.TYPE.ABI, 
        self.TYPE.char.ptr, // return
        self.TYPE.char.ptr, 
        self.TYPE.int, 
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
      return lib().declare('port_associate', self.TYPE.ABI,
        self.TYPE.int,           // return        
        self.TYPE.int,           // port
        self.TYPE.int,           // source 
        self.TYPE.uintptr_t, // object
        self.TYPE.int,           // events
        self.TYPE.void.ptr // user
      );
    },
    port_create: function() { 
      /* https://docs.oracle.com/cd/E19253-01/816-5168/6mbb3hri5/index.html
      * int port_create(
      *   void
      * );
      */
      return lib().declare('port_create', self.TYPE.ABI, 
        self.TYPE.int // return
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
      return lib().declare("port_dissociate", self.TYPE.ABI, 
        self.TYPE.int,         // return
        self.TYPE.int,          // port
        self.TYPE.int,          // source
        self.TYPE.uintptr_t // object
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
      return lib().declare('port_get', self.TYPE.ABI, 
        self.TYPE.int,  // return
        self.TYPE.int,  // port
        self.TYPE.port_event_t.ptr, // pe
        self.TYPE.timespec_t.ptr    // timeout
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
      return lib().declare('pthread_create', self.TYPE.ABI,
        self.TYPE.int, // return
        self.TYPE.pthread_t.ptr,    // restrict thread
        self.TYPE.pthread_attr_t.ptr, // restrict attr
        self.TYPE.start_routine.ptr,        // unknown
        self.TYPE.void.ptr               // restrict arg                    
      );
    },
    stat: function() {
     /* https://en.wikipedia.org/wiki/Stat_%28system_call%29
      * int stat(
      *   const char *filename, 
      *   struct stat *buf
      * );
      */
      return lib().declare('stat', self.TYPE.ABI,
        self.TYPE.int,              // return    
        self.TYPE.char.ptr,      // filename
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

    FILE_ACCESS: 0x00000001,
    FILE_MODIFIED: 0x00000002,
    FILE_ATTRIB: 0x00000004,
    FILE_NOFOLLOW: 0x10000000,
    FILE_DELETE: 0x00000010,
    FILE_RENAME_TO: 0x00000020,
    FILE_RENAME_FROM: 0x00000040,
    UNMOUNTED: 0x20000000,
    MOUNTEDOVER: 0x40000000,

    get FILE_EXCEPTION() {
      return this.UNMOUNTED | this.FILE_DELETE | this.FILE_RENAME_TO | this. FILE_RENAME_FROM | this.MOUNTEDOVER;
    }
  };
};
var ostypes = new sunosInit();
