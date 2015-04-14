var EXPORTED_SYMBOLS = ['ostypes'];

// no need to define core or import cutils as all the globals of the worker who importScripts'ed it are availble here

if (ctypes.voidptr_t.size == 4 /* 32-bit */) {
	var is64bit = false;
} else if (ctypes.voidptr_t.size == 8 /* 64-bit */) {
	var is64bit = true;
} else {
	throw new Error('huh??? not 32 or 64 bit?!?!');
}

//var ifdef_UNICODE = true;

var macTypes = function() {
	
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
	this.kevent = ctypes.StructType('kevent', [ // https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man2/kqueue.2.html
		{ ident: this.uintptr_t },
		{ filter: this.int16_t },
		{ flags: this.uint16_t },
		{ fflags: this.uint32_t },
		{ data: this.intptr_t },
		{ udata: this.void.ptr }
	]);
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
	
	// CRAZY ADVANCED STRUCT TYPE
	this.AlertStdAlertParamRec = ctypes.StructType("AlertStdAlertParamRec", [
		{ movable: this.Boolean },
		{ helpButton: this.Boolean },
		{ filterProc: this.ModalFilterUPP },
		{ defaultText: this.ConstStringPtr },
		{ cancelText: this.ConstStringPtr },
		{ otherText: this.ConstStringPtr },
		{ defaultButton: this.SInt16 },
		{ cancelButton: this.SInt16 },
		{ position: this.UInt16 }
	]);
}

var macInit = function() {
	var self = this;
	
	this.IS64BIT = is64bit;
	
	this.TYPE = new macTypes();

	// CONSTANTS
	this.CONST = {
		kCFUserNotificationStopAlertLevel: 0,
		kCFUserNotificationNoteAlertLevel: 1,
		kCFUserNotificationCautionAlertLevel: 2,
		kCFUserNotificationPlainAlertLevel: 3,
		
		// start - kqueue - https://github.com/j4cbo/chiral/blob/3c66a8bb64e541c0f63b04b78ec2d0ffdf5b473c/chiral/os/kqueue.py#L122
		EVFILT_READ: -1,
		EVFILT_WRITE: -2,
		EVFILT_AIO: -3,
		EVFILT_VNODE: -4,
		EVFILT_PROC: -5,
		EVFILT_SIGNAL: -6,
		EVFILT_TIMER: -7,
		EVFILT_MACHPORT: -8,
		EVFILT_FS: -9,

		EV_ADD: 0x0001,		// add event to kq (implies enable)
		EV_DELETE: 0x0002,	// delete event from kq
		EV_ENABLE: 0x0004,	// enable event
		EV_DISABLE: 0x0008,	// disable event (not reported)
		EV_ONESHOT: 0x0010,	// only report one occurrence
		EV_CLEAR: 0x0020,	// clear event state after reporting
		EV_SYSFLAGS: 0xF000,	// reserved by system
		EV_FLAG0: 0x1000,	// filter-specific flag
		EV_FLAG1: 0x2000,	// filter-specific flag
		EV_EOF: 0x8000,		// EOF detected
		EV_ERROR: 0x4000,	// error, data contains errno
		
		// https://github.com/jonnybest/taskcoach/blob/f930e55fa895315e9e9688994aa8dbc10b09b1e5/taskcoachlib/filesystem/fs_darwin.py#L35
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
		CFUserNotificationDisplayNotice: function() {
			/* https://developer.apple.com/library/mac/documentation/CoreFoundation/Reference/CFUserNotificationRef/index.html#//apple_ref/c/func/CFUserNotificationDisplayNotice
			 * SInt32 CFUserNotificationDisplayNotice (
			 *   CFTimeInterval timeout,
			 *   CFOptionFlags flags,
			 *   CFURLRef iconURL,
			 *   CFURLRef soundURL,
			 *   CFURLRef localizationURL,
			 *   CFStringRef alertHeader,
			 *   CFStringRef alertMessage,
			 *   CFStringRef defaultButtonTitle
			 * ); 
			 */
			return lib('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation').declare('CFUserNotificationDisplayNotice', this.ABI,
				self.SInt32,			// return
				self.CFTimeInterval,	// timeout
				self.CFOptionFlags,		// flags
				self.CFURLRef,			// iconURL
				self.CFURLRef,			// soundURL
				self.CFURLRef,			// localizationURL
				self.CFStringRef,		// alertHeader
				self.CFStringRef,		// alertMessage
				self.CFStringRef		// defaultButtonTitle
			);
		},
		CFRelease: function() {
			/* https://developer.apple.com/library/mac/documentation/CoreFoundation/Reference/CFTypeRef/#//apple_ref/c/func/CFRelease
			 * void CFRelease (
			 *   CFTypeRef cf
			 * ); 
			 */
			var CFRelease = lib('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation').declare('CFRelease', self.ABI,
				self.VOID,		// return
				self.CFTypeRef	// cf
			);
		},
		CFStringCreateWithCharacters: function() {
			/* https://developer.apple.com/library/mac/documentation/CoreFoundation/Reference/CFStringRef/#//apple_ref/c/func/CFStringCreateWithCharacters
			 * CFStringRef CFStringCreateWithCharacters (
			 *   CFAllocatorRef alloc,
			 *   const UniChar *chars,
			 *   CFIndex numChars
			 * ); 
			 */
			var CFStringCreateWithCharacters = lib('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation').declare('CFStringCreateWithCharacters', self.ABI,
				self.CFStringRef,		// return
				self.CFAllocatorRef,	// alloc
				self.UniChar.ptr,		// *chars
				self.CFIndex			// numChars
			);
		},
		close: function() {
			/* https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man2/close.2.html#//apple_ref/doc/man/2/close
			 * int close (
			 *   int fildes
			 * ); 
			 */
			return lib('libc.dylib').declare('close', self.TYPE.ABI,
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
			return lib('libc.dylib').declare('kevent', self.TYPE.ABI,
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
			return lib('libc.dylib').declare('kqueue', self.TYPE.ABI,
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
			return lib('libc.dylib').declare('open', self.TYPE.ABI,
				self.TYPE.int,		// return
				self.TYPE.char.ptr,	// *path
				self.TYPE.int		// oflag
			);
		},
		StandardAlert: function() {
			return lib('/System/Library/Frameworks/Carbon.framework/Carbon').declare('StandardAlert', self.ABI,
				self.OSErr,
				self.AlertType,
				self.ConstStr255Param,
				self.ConstStr255Param,
				self.AlertStdAlertParamRec.ptr,
				self.SInt16.ptr
			);
		}
	};
	// end - predefine your declares here
	// end - function declares
	
	this.HELPER = {
		Str255: function(str) {
			return String.fromCharCode(str.length) + str;
		},
		makeCFStr: function(jsStr) {
			// js str is just a string
			// returns a CFStr that must be released with CFRelease when done
			return self.API('CFStringCreateWithCharacters')(null, jsStr, jsStr.length);
		},
		EV_SET: function EV_SET(kev_address, ident, filter, flags, fflags, data, udata_jsStr) {
			// macro
			// docs say args are: &kev, ident, filter, flags, fflags, data, udata // docs are here: https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man2/kqueue.2.html
			console.info('kev_address:', kev_address.toString(), uneval(kev_address));
			console.info('kev_address.contents:', kev_address.contents.toString(), uneval(kev_address.contents));
			kev_address.contents.addressOfField('ident').contents = ident;
			kev_address.contents.addressOfField('filter').contents = filter;
			kev_address.contents.addressOfField('flags').contents = flags;
			kev_address.contents.addressOfField('fflags').contents = fflags;
			kev_address.contents.addressOfField('data').contents = data;
			kev_address.contents.addressOfField('udata').contents = udata_jsStr; //ostypes.TYPE.char.array()(udata_jsStr);
		}
	};
}

var ostypes = new macInit();
