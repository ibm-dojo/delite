/** @module delite/on */
define(function () {
	/**
	 * Call specified function when event occurs.
	 * @param {Element} [node] - Element to attach handler to.
	 * @param {string} type - Name of event (ex: "click").
	 * @param {Function} callback - Callback function.
	 * @returns {Object} Handle with `remove()` method to cancel the listener.
	 */
	return function (node, type, callback) {
		var capture = false;

		// Shim support for focusin/focusout.
		var captures = { focusin: "focus", focusout: "blur" };
		if (type in captures) {
			type = captures[type];
			capture = true;
		}

		// Shim support for event.key, and fix some wrong event.key values on FF and Android 4.2.
		if (/^key(down|press|up)$/.test(type)) {
			var origFunc = callback;
			callback = function (event) {
				var key = event.key || event.keyIdentifier || String.fromCharCode(event.charCode);

				var fixedKey = {
					// mappings for event.keyIdentifier differences from event.key for special keys
					"U+0020": "Spacebar",
					"U+0008": "Backspace",
					"U+0009": "Tab",
					"U+001B": "Esc",

					// fix for FF 34
					" ": "Spacebar",

					// fix for Android 4.2
					"U+00007F": "Backspace"
				}[key] || key.replace(/^U\+0*(.*)$/, function (all, hexString) {
					// fix event.keyIdentifier for normal printable characters, ex: "U+0041" --> "A" or "a"
					var code = parseInt(hexString, 16);
					if (code >= 65 && code <= 90 && !event.shiftKey) {
						code += 32;	// uppercase --> lowercase
					}
					return String.fromCharCode(code);
				});

				if (event.key !== fixedKey) {
					event.key = fixedKey;
				}

				origFunc(event);
			};
		}

		node.addEventListener(type, callback, capture);

		return {
			remove: function () {
				node.removeEventListener(type, callback, capture);
			}
		};
	};
});