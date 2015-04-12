var EXPORTED_SYMBOLS = ['ostypes'];

if (ctypes.voidptr_t.size == 4 /* 32-bit */) {
	var is64bit = false;
} else if (ctypes.voidptr_t.size == 8 /* 64-bit */) {
	var is64bit = true;
} else {
	throw new Error('huh??? not 32 or 64 bit?!?!');
}

//var ifdef_UNICODE = true;

var bsdTypes = function() {
	
	// ABIs
	this.CALLBACK_ABI = ctypes.default_abi;
	this.ABI = ctypes.default_abi;
	
	// C TYPES - also simple types but just not really specific to os - i even define these here, in case i want to change everything global. if i had done ctypes.uint32_t in places, i couldn't do a global change, but with ostypes.TYPE.uint32_t i can do global change
	this.char = ctypes.char;
	this.int = ctypes.int;
	this.int16_t = ctypes.int16_t;
	this.int64_t = ctypes.int64_t;
	this.intptr_t = ctypes.intptr_t;
	this.long = ctypes.long;
	this.short = ctypes.short;
	this.uint16_t = ctypes.uint16_t;
	this.uint32_t = ctypes.uint32_t;
	this.uintptr_t = ctypes.uintptr_t
	this.uint64_t = ctypes.uint64_t;
	
	// ADV C TYPES
	this.time_t = this.long; // https://github.com/j4cbo/chiral/blob/3c66a8bb64e541c0f63b04b78ec2d0ffdf5b473c/chiral/os/kqueue.py#L34 AND also based on this github search https://github.com/search?utf8=%E2%9C%93&q=time_t+ctypes&type=Code&ref=searchresults AND based on this answer here: http://stackoverflow.com/a/471287/1828637
	
	// SIMPLE TYPES
	this.Boolean = ctypes.unsigned_char;
	this.CFIndex = ctypes.long;
	this.CFOptionFlags = ctypes.unsigned_long;
	this.CFTimeInterval = ctypes.double;
	this.CFTypeRef = ctypes.voidptr_t;
	this.ConstStr255Param = ctypes.unsigned_char.ptr;
	this.ConstStringPtr = ctypes.unsigned_char.ptr;
	this.OpaqueDialogPtr = ctypes.StructType("OpaqueDialogPtr");
	this.SInt16 = ctypes.short;
	this.SInt32 = ctypes.long;
	this.UInt16 = ctypes.unsigned_short;
	this.UInt32 = ctypes.unsigned_long;
	this.UniChar = ctypes.jschar;
	this.void = ctypes.void_t;
	this.VOID = ctypes.void_t;
	
	// ADVANCED TYPES
	this.AlertType = this.SInt16;
	this.DialogItemIndex = this.SInt16;
	this.DialogPtr = this.OpaqueDialogPtr.ptr;
	this.EventKind = this.UInt16;
	this.EventModifiers = this.UInt16;
	this.OSErr = this.SInt16;
		
	// SUPER ADVANCED TYPES
	this.DialogRef = this.DialogPtr;

	// SIMPLE STRUCTS
	this.__CFAllocator = ctypes.StructType('__CFAllocator');
	this.__CFString = ctypes.StructType('__CFString');
	this.__CFURL = ctypes.StructType('__CFURL');
	/*
	if (is64bit) {
		this.kevent = ctypes.StructType('kevent64_s', [ // https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man2/kqueue.2.html
			{ ident: this.uint64_t },
			{ filter: this.int16_t },
			{ flags: this.uint16_t },
			{ fflags: this.uint32_t },
			{ data: this.int64_t },
			{ udata: this.uint64_t },
			{ ext: this.uint64_t.array(2) }
		]);
	} else {
	*/
		this.kevent = ctypes.StructType('kevent', [ // https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man2/kqueue.2.html
			{ ident: this.uintptr_t },
			{ filter: this.int16_t },
			{ flags: this.uint16_t },
			{ fflags: this.uint32_t },
			{ data: this.intptr_t },
			{ udata: this.void.ptr }
		]);
	/*
	}
	*/
	this.Point = ctypes.StructType('Point', [
		{ v: this.short },
		{ h: this.short }
	]);
	this.timespec = ctypes.StructType('timespec', [ // http://www.opensource.apple.com/source/text_cmds/text_cmds-69/sort/timespec.h
		{ tv_sec: this.time_t },
		{ tv_nsec: this.long }
	]);

	// ADV STRUCTS
	this.CFAllocatorRef = this.__CFAllocator.ptr;
	this.CFStringRef = this.__CFString.ptr;
	this.CFURLRef = this.__CFURL.ptr;
	this.EventRecord = ctypes.StructType("EventRecord", [
		{ what: this.EventKind },
		{ message: ctypes.unsigned_long },
		{ when: this.UInt32 },
		{ where: this.Point },
		{ modifiers: this.EventModifiers }
	]);
	
	// SIMPLE FUNCTION TYPES
	this.ModalFilterProcPtr = ctypes.FunctionType(this.ABI, this.Boolean, [this.DialogRef, this.EventRecord.ptr, this.DialogItemIndex.ptr]).ptr;
	
	// ADVANCED FUNCTION TYPES
	this.ModalFilterUPP = this.ModalFilterProcPtr;
	
}

var bsdInit = function() {
	var self = this;
	
	this.IS64BIT = is64bit;
	
	this.TYPE = new bsdTypes();

	// CONSTANTS
	this.CONST = {
		
		// start - kqueue - http://fxr.watson.org/fxr/source/sys/event.h
		EVFILT_READ: -1,
		EVFILT_WRITE: -2,
		EVFILT_AIO: -3,
		EVFILT_VNODE: -4,
		EVFILT_PROC: -5,
		EVFILT_SIGNAL: -6,
		EVFILT_TIMER: -7,
		EVFILT_PROCDESC: -8,
		EVFILT_FS: -9,
		EVFILT_LIO: -10,
   	EVFILT_USER: -11,   
   	EVFILT_SENDFILE: -12,
   	EVFILT_SYSCOUNT: 12,

		EV_ADD: 0x0001,
   	EV_DELETE: 0x0002,
   	EV_ENABLE: 0x0004,
  	EV_DISABLE: 0x0008,
   	EV_FORCEONESHOT: 0x0100,

		EV_ONESHOT: 0x0010,
   	EV_CLEAR: 0x0020,
   	EV_RECEIPT: 0x0040,
   	EV_DISPATCH: 0x0080,

   	EV_SYSFLAGS: 0xF000,
   	EV_DROP: 0x1000,
   	EV_FLAG1: 0x2000,

   	EV_EOF: 0x8000,     
  	EV_ERROR: 0x4000,
		
		NUM_EVENT_FDS: 1,
		NUM_EVENT_SLOTS: 1,
		
		NOTE_DELETE: 0x00000001,
		NOTE_WRITE: 0x00000002,
		NOTE_EXTEND: 0x00000004,
		NOTE_ATTRIB: 0x00000008,
		NOTE_LINK: 0x00000010,
		NOTE_RENAME: 0x00000020,
		NOTE_REVOKE: 0x00000040,
		
		// end - kqueue
	};
	
	var _lib = {}; // cache for lib
	var lib = function(path) {
		//ensures path is in lib, if its in lib then its open, if its not then it adds it to lib and opens it. returns lib
		//path is path to open library
		//returns lib so can use straight away

		if (!(path in _lib)) {
			//need to open the library
			//default it opens the path, but some things are special like libc in mac is different then linux or like x11 needs to be located based on linux version
			switch (path) {
				default:
					try {
						_lib[path] = ctypes.open(path);
					} catch (e) {
						//console.error('Integration Level 1: Could not get open path:', path, 'e:' + e);
						throw new Error('Integration Level 1: Could not get open path:"' + path + '" e: "' + e + '"');
					}
			}
		}
		return _lib[path];
	};
	
	// start - function declares
	var _api = {};
	this.API = function(declaration) { // it means ensureDeclared and return declare. if its not declared it declares it. else it returns the previously declared.
		if (!(declaration in _api)) {
			_api[declaration] = preDec[declaration](); //if declaration is not in preDec then dev messed up
		}
		return _api[declaration];
	};

	// start - predefine your declares here
	var preDec = { //stands for pre-declare (so its just lazy stuff) //this must be pre-populated by dev // do it alphabateized by key so its ez to look through
		close: function() {
			/* https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man2/close.2.html#//apple_ref/doc/man/2/close
			 * int close (
			 *   int fildes
			 * ); 
			 */
			return lib('libc.so.7').declare('close', self.TYPE.ABI,
				self.TYPE.int,	// return
				self.TYPE.int	// fildes
			);
		},
		kevent: function() {
			/* https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man2/kqueue.2.html
			 * int kevent (
			 *   int kq,
			 *   const struct kevent *changelist,
			 *   int nchanges,
			 *   struct kevent *eventlist,
			 *   int nevents,
			 *   const struct timespec *timeout
			 * ); 
			 */
			return lib('libc.so.7').declare('kevent', self.TYPE.ABI,
				self.TYPE.int,			// return
				self.TYPE.int,			// kq
				self.TYPE.kevent.ptr,	// *changelist
				self.TYPE.int,			// nchanges
				self.TYPE.kevent.ptr,	// *eventlist
				self.TYPE.int,			// nevents
				self.TYPE.timespec.ptr	// *timeout
			);
		},
		kqueue: function() {
			/* https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man2/kqueue.2.html
			 * int kqueue (
			 *   void
			 * ); 
			 */
			return lib('libc.so.7').declare('kqueue', self.TYPE.ABI,
				self.TYPE.int	// return
			);
		},
		open: function() {
			/* https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man2/open.2.html
			 * int open (
			 *   const char *path
			 *   int oflag
			 * ); 
			 */
			return lib('libc.so.7').declare('open', self.TYPE.ABI,
				self.TYPE.int,		// return
				self.TYPE.char.ptr,	// *path
				self.TYPE.int		// oflag
			);
		}
		
	};
	// end - predefine your declares here
	// end - function declares
	
	this.HELPER = {

	
	};
}

var ostypes = new bsdInit();
