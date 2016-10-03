/**
 * Tracks which nodes are currently "active".
 * A node is considered active if it or a descendant node has focus,
 * or if a non-focusable descendant was the most recent node
 * to get a touchstart/mousedown/pointerdown event.
 *
 * Emits non-bubbling `delite-activated` and `delite-deactivated` events on nodes
 * as they become active, or stop being active, as defined above.
 *
 * Call `activationTracker.on("active-stack", callback)` to track the stack of currently active nodes.
 *
 * Call `activationTracker.on("deactivated", func)` or `activationTracker.on("activated", ...)` to monitor when
 * when nodes become active/inactive.
 *
 * @module delite/activationTracker
 * */
define([
	"dcl/advise",
	"dcl/dcl",
	"requirejs-dplugins/jquery!attributes/classes",	// hasClass()
	"decor/Evented",
	"./on",
	"dpointer/events",		// so can just monitor for "pointerdown"
	"requirejs-domready/domReady!"
], function (advise, dcl, $, Evented, on) {

	// Time of the last touch/mouse and focusin events
	var lastPointerDownTime;
	var lastFocusinTime;

	// Last node that got pointerdown or focusin event, and the time it happened.
	var lastPointerDownOrFocusInNode;
	var lastPointerDownOrFocusInTime;

	var ActivationTracker = dcl(Evented, /** @lends module:delite/activationTracker */ {
		/**
		 * List of currently active widgets (focused widget and its ancestors).
		 * @property {Element[]} activeStack
		 */
		activeStack: [],

		/**
		 * Registers listeners on the specified window to detect when the user has
		 * touched / mouse-downed / focused somewhere.  This is called automatically.
		 *
		 * @param {Window} [targetWindow]
		 * @returns {Object} Handle with `remove()` method to deregister.
		 * @private
		 */
		registerWin: function (targetWindow) {
			// Listen for blur and focus events on targetWindow's document.
			var _this = this,
				doc = targetWindow.document,
				body = doc && doc.body;

			function pointerDownHandler(evt) {
				// workaround weird IE bug where the click is on an orphaned node
				// (first time clicking a Select/DropDownButton inside a TooltipDialog).
				// actually, strangely this is happening on latest chrome too.
				if (evt && evt.target && evt.target.parentNode == null) {
					return;
				}

				lastPointerDownTime = (new Date()).getTime();

				_this._pointerDownOrFocusHandler(evt.target, "mouse");
			}

			function focusHandler(evt) {
				// When you refocus the browser window, IE gives an event with an empty srcElement
				if (!evt.target.tagName) {
					return;
				}

				// IE reports that nodes like <body> have gotten focus, even though they don't have a
				// tabindex setting.  Ignore those events.
				var tag = evt.target.tagName.toLowerCase();
				if (tag === "#document" || tag === "body") {
					return;
				}

				_this._focusHandler(evt.target);
			}

			function blurHandler(evt) {
				_this._blurHandler(evt.target);
			}

			if (body) {
				// Listen for touches or mousedowns.
				body.addEventListener("pointerdown", pointerDownHandler, true);
				body.addEventListener("focus", focusHandler, true);	// need true since focus doesn't bubble
				body.addEventListener("blur", blurHandler, true);	// need true since blur doesn't bubble

				return {
					remove: function () {
						body.removeEventListener("pointerdown", pointerDownHandler, true);
						body.removeEventListener("focus", focusHandler, true);
						body.removeEventListener("blur", blurHandler, true);
					}
				};
			}
		},

		/**
		 * Called when focus leaves a node.
		 * Usually ignored, _unless_ it *isn't* followed by touching another node,
		 * which indicates that we tabbed off the last field on the page,
		 * in which case every widget is marked inactive.
		 * @param {Element} node
		 * @private
		 */
		_blurHandler: function (node) { // jshint unused: vars
			var now = (new Date()).getTime();

			// IE9+ and chrome have a problem where focusout events come after the corresponding focusin event.
			// For chrome problem see https://bugs.dojotoolkit.org/ticket/17668.
			// IE problem happens when moving focus from the Editor's <iframe> to a normal DOMNode.
			if (now < lastFocusinTime + 100) {
				return;
			}

			// Unset timer to zero-out widget stack; we'll reset it below if appropriate.
			if (this._clearActiveWidgetsTimer) {
				clearTimeout(this._clearActiveWidgetsTimer);
			}

			if (now < lastPointerDownOrFocusInTime + 500) {
				// This blur event is coming late (after the call to _pointerDownOrFocusHandler() rather than before.
				// So let _pointerDownOrFocusHandler() handle setting the widget stack.
				// See https://bugs.dojotoolkit.org/ticket/17668
				return;
			}

			// If the blur event isn't followed (or preceded) by a focus or pointerdown event,
			// mark all widgets as inactive.
			this._clearActiveWidgetsTimer = setTimeout(function () {
				delete this._clearActiveWidgetsTimer;
				this._setStack([]);
			}.bind(this), 0);
		},

		/**
		 * Callback when node is focused or pointerdown'd.
		 * @param {Element} node - The node.
		 * @param {string} by - "mouse" if the focus/pointerdown was caused by a mouse down event.
		 * @private
		 */
		_pointerDownOrFocusHandler: function (node, by) {
			if (this._clearActiveWidgetsTimer) {
				// forget the recent blur event
				clearTimeout(this._clearActiveWidgetsTimer);
				delete this._clearActiveWidgetsTimer;
			}

			// compute stack of active widgets (ex: ComboButton --> Menu --> MenuItem)
			var newStack = [];
			try {
				while (node) {
					if (node._popupParent) {
						node = node._popupParent;
					} else if (node.tagName && node.tagName.toLowerCase() === "body") {
						// is this the root of the document or just the root of an iframe?
						if (node === document.body) {
							// node is the root of the main document
							break;
						}
						// otherwise, find the iframe this node refers to (can't access it via parentNode,
						// need to do this trick instead). window.frameElement is supported in IE/FF/Webkit
						node = node.ownerDocument.defaultView.frameElement;
					} else {
						// Ignore clicks on disabled widgets (actually focusing a disabled widget still works,
						// to support MenuItem).
						if (by === "mouse" && node.disabled) {
							newStack = [];
						} else {
							newStack.unshift(node);
						}
						node = node.parentNode;
					}
				}
			} catch (e) { /* squelch */
			}

			this._setStack(newStack, by);

			// Keep track of most recent focusin or pointerdown event.
			lastPointerDownOrFocusInTime = (new Date()).getTime();
			lastPointerDownOrFocusInNode = node;
		},

		/**
		 * Callback when node is focused.
		 * @param {Element} node
		 * @private
		 */
		_focusHandler: function (node) {
			if (!node) {
				return;
			}

			if (node.nodeType === 9) {
				// Ignore focus events on the document itself.  This is here so that
				// (for example) clicking the up/down arrows of a spinner
				// (which don't get focus) won't cause that widget to blur. (FF issue)
				return;
			}

			// Keep track of time of last focusin event.
			lastFocusinTime = (new Date()).getTime();

			// Also, if clicking a node causes its ancestor to be focused, ignore the focus event.
			// Example in the activationTracker.html functional test on IE, where clicking the spinner buttons
			// focuses the <fieldset> holding the spinner.
			if ((new Date()).getTime() < lastPointerDownTime + 100 &&
					node.contains(lastPointerDownOrFocusInNode.parentNode)) {
				return;
			}

			// There was probably a blur event right before this event, but since we have a new focus,
			// forget about the blur
			if (this._clearFocusTimer) {
				clearTimeout(this._clearFocusTimer);
				delete this._clearFocusTimer;
			}

			this._pointerDownOrFocusHandler(node);
		},

		/**
		 * The stack of active nodes has changed.  Send out appropriate events and record new stack.
		 * @param {Element} newStack - Array of nodes, starting from the top (outermost) node.
		 * @param {string} by - "mouse" if the focus/pointerdown was caused by a mouse down event.
		 * @private
		 */
		_setStack: function (newStack, by) {
			var oldStack = this.activeStack, lastOldIdx = oldStack.length - 1, lastNewIdx = newStack.length - 1;

			if (newStack[lastNewIdx] === oldStack[lastOldIdx]) {
				// no changes, return now to avoid spurious notifications about changes to activeStack
				return;
			}

			this.activeStack = newStack;
			this.emit("active-stack", newStack);

			var node, i;

			// for all elements that have become deactivated
			for (i = lastOldIdx; i >= 0 && oldStack[i] !== newStack[i]; i--) {
				node = oldStack[i];
				on.emit(node, "delite-deactivated", {bubbles: false, by: by});
				this.emit("deactivated", node, by);
			}

			// for all elements that have become activated
			for (i++; i <= lastNewIdx; i++) {
				node = newStack[i];
				on.emit(node, "delite-activated", {bubbles: false, by: by});
				this.emit("activated", node, by);
			}
		}
	});

	// Create singleton for top window
	var singleton = new ActivationTracker();
	singleton.registerWin(window);

	return singleton;
});
