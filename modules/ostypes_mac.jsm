var EXPORTED_SYMBOLS = ['ostypes'];

var gen = {
	name: 'jscFileWatcher',
	id: 'jscFileWatcher@jetpack',
	path: {
		chrome: 'chrome://jscfilewatcher/content/',
		locale: 'chrome://jscfilewatcher/locale/'
	},
	aData: 0
};

importScripts(gen.path.chrome + 'modules/cutils.jsm'); // used by HELPER functions

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
	
	// SIMPLE TYPES
	his.Boolean = ctypes.unsigned_char;
	this.CFIndex = ctypes.long;
	this.CFOptionFlags = ctypes.unsigned_long;
	this.CFTimeInterval = ctypes.double;
	this.CFTypeRef = ctypes.voidptr_t;
	this.ConstStr255Param = ctypes.unsigned_char.ptr;
	this.ConstStringPtr = ctypes.unsigned_char.ptr;
	this.OpaqueDialogPtr = ctypes.StructType("OpaqueDialogPtr");
	this.SInt16 = ctypes.short;
	this.SInt32 = ctypes.long;
	this.UInt32 = ctypes.unsigned_long;
	this.UniChar = ctypes.jschar;
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
	this.Point = ctypes.StructType("Point", [
		{ v: ctypes.short },
		{ h: ctypes.short }
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

var winInit = function() {
	var self = this;
	
	this.IS64BIT = is64bit;
	
	this.TYPE = new macTypes();

	// CONSTANTS
	this.CONST = {
		kCFUserNotificationStopAlertLevel: 0,
		kCFUserNotificationNoteAlertLevel: 1,
		kCFUserNotificationCautionAlertLevel: 2,
		kCFUserNotificationPlainAlertLevel: 3
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
		StandardAlert: function() {
			return lib('/System/Library/Frameworks/Carbon.framework/Carbon').declare('StandardAlert', self.ABI,
				self.OSErr,
				self.AlertType,
				self.ConstStr255Param,
				self.ConstStr255Param,
				self.AlertStdAlertParamRec.ptr,
				self.SInt16.ptr
			);
		},
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
		}
	};
}

var ostypes = new macInit();