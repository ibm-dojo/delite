// Helper methods for automated testing

define([
	"dojo/Deferred", "dojo/promise/all",
	"dojo/dom-attr", "dojo/dom-class", "dojo/dom-geometry", "dojo/dom-style",
	"dojo/_base/kernel", "dojo/on", "dojo/query",
	"delite/a11y"	// isTabNavigable, _isElementShown
], function (Deferred, all, domAttr, domClass, domGeometry, domStyle, kernel, on, query, a11y) {


// Globals used by onFocus()
	var curFocusNode, focusListener, focusCallback, focusCallbackDelay;

	return {

		isVisible: function isVisible(/*DomNode*/ node) {
			// summary:
			//		Return true if node/widget is visible
			var p;

			return (domStyle.get(node, "display") !== "none") &&
				(domStyle.get(node, "visibility") !== "hidden") &&
				(p = domGeometry.position(node, true), p.y + p.h >= 0 && p.x + p.w >= 0 && p.h && p.w);
		},

		isHidden: function isHidden(/*DomNode*/ node) {
			// summary:
			//		Return true if node/widget is hidden
			var p;

			return (domStyle.get(node, "display") === "none") ||
				(domStyle.get(node, "visibility") === "hidden") ||
				(p = domGeometry.position(node, true), p.y + p.h < 0 || p.x + p.w < 0 || p.h <= 0 || p.w <= 0);
		},

		innerText: function innerText(/*DomNode*/ node) {
			// summary:
			//		Browser portable function to get the innerText of specified DOMNode
			return (node.textContent || "").trim();
		},

		tabOrder: function tabOrder(/*DomNode?*/ root) {
			// summary:
			//		Return all tab-navigable elements under specified node in the order that
			//		they will be visited (by repeated presses of the tab key)

			var elems = [];

			function walkTree(/*DOMNode*/ parent) {
				query("> *", parent).forEach(function (child) {
					// Skip hidden elements
					if (!a11y._isElementShown(child)) {
						return;
					}

					if (a11y.isTabNavigable(child)) {
						elems.push({
							elem: child,
							tabIndex: domClass.contains(child, "tabIndex") ? domAttr.get(child, "tabIndex") : 0,
							pos: elems.length
						});
					}
					if (child.nodeName.toUpperCase() !== "SELECT") {
						walkTree(child);
					}
				});
			}

			walkTree(root || document.body);

			elems.sort(function (a, b) {
				return a.tabIndex !== b.tabIndex ? a.tabIndex - b.tabIndex : a.pos - b.pos;
			});
			return elems.map(function (elem) {
				return elem.elem;
			});
		},


		onFocus: function onFocus(func, delay) {
			// summary:
			//		Wait for the next change of focus, and then delay ms (so widget has time to react to focus event),
			//		then call func(node) with the currently focused node.  Note that if focus changes again during
			//		delay, newest focused node is passed to func.

			if (!focusListener) {
				focusListener = on(document, "focusin", function (evt) {
					// Track most recently focused node; note it may change again before delay completes
					curFocusNode = evt.target;

					// If a handler was specified to fire after the next focus event (plus delay),
					// set timeout to run it.
					if (focusCallback) {
						var callback = focusCallback;
						focusCallback = null;
						setTimeout(function () {
							callback(curFocusNode);		// return current focus, may be different than 10ms earlier
						}, focusCallbackDelay);	// allow time for focus to change again, see #8285
					}
				});
			}

			focusCallback = func;
			focusCallbackDelay = delay || 10;
		},

		waitForLoad: function () {
			// summary:
			//		Returns Promise that fires when all widgets have finished initializing.
			//		Call this after the parser has finished running.

			var d = new Deferred();

			// Deferred fires when all widgets with an onLoadDeferred have fired
			var widgets = query("[widgetId]").filter(function (w) {
					return w.onLoadDeferred;
				}),
				deferreds = widgets.map(function (w) {
					return w.onLoadDeferred;
				});
			console.log("Waiting for " + widgets.length + " widgets: " +
				widgets.map(function (w) {
					return w.id;
				}).join(", "));
			all(deferreds).then(function () {
				console.log("All widgets loaded.");
				d.resolve(widgets);
			});

			return d.promise;
		}

	};

});
