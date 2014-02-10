define([
	"dcl/dcl",
	"dojo/_base/lang",
	"dojo/dom-construct", // domConstruct.destroy
	"dojo/on",
	"./Destroyable",
	"./Stateful"
], function (dcl, lang, domConstruct, on, Destroyable, Stateful) {

	// module:
	//		delite/CustomElement

	var div = document.createElement("div");

	return dcl([Stateful, Destroyable], {
		// summary:
		//		Base class for all custom elements.
		//		Use this class rather that Widget for non-visual custom elements.
		//
		//		Custom elements can provide custom setters/getters for properties, which are called automatically
		//		when the value is set.  For an attribute XXX, define methods _setXXXAttr() and/or _getXXXAttr().

		_getProps: function () {
			// Override _Stateful._getProps() to ignore properties from the HTML*Element superclasses, like "style".
			// You would need to explicitly declare style: "" in your widget to get it here.
			// Intentionally skips privates and methods, because it seems wasteful to have a custom
			// setter for every method; not sure that would work anyway.
			//
			// Also sets up this._propCaseMap, a mapping from lowercase property name to actual name,
			// ex: iconclass --> iconClass, which does include the methods, but again doesn't
			// include props like "style" that are merely inherited from HTMLElement.

			var list = [], proto = this, ctor,
				pcm = this._propCaseMap = {};

			do {
				Object.keys(proto).forEach(function (prop) {
					if (!/^_/.test(prop)) {
						if (typeof proto[prop] !== "function") {
							list.push(prop);
						}
						pcm[prop.toLowerCase()] = prop;
					}
				});

				proto = Object.getPrototypeOf(proto);
				ctor = proto && proto.constructor;
			} while (proto && ctor !== this._baseElement);

			return list;
		},

		createdCallback: dcl.advise({
			before: function () {
				// Get parameters that were specified declaratively on the widget DOMNode.
				this._declaredParams = this._mapAttributes();

				// FF has a native watch() method that overrides our Stateful.watch() method and breaks custom setters,
				// so that any command like this.label = "hello" sets label to undefined instead.  Try to workaround.
				this.watch = Stateful.prototype.watch;
			},

			after: function () {
				this._created = true;

				// Now that creation has finished, apply parameters that were specified declaratively.
				// This is consistent with the timing that parameters are applied for programmatic creation.
				dcl.mix(this, this._declaredParams);
			}
		}),

		_mapAttributes: function () {
			// summary:
			//		Get declaratively specified attributes to widget properties
			var pcm = this._propCaseMap,
				attr,
				idx = 0,
				props = {};

			// inner functions useful to reduce cyclomatic complexity when using jshint
			function stringToObject(value) {
				var obj;

				try {
					// TODO: remove this code if it isn't being used, so we don't scare people that are afraid of eval.
					/* jshint evil:true */
					// This will only be executed when complex parameters are used in markup
					// <my-tag constraints="max: 3, min: 2"></my-tag>
					// This can be avoided by using such complex parameters only programmatically or by not using
					// them at all.
					// This is harmless if you make sure the JavaScript code that is passed to the attribute
					// is harmless.
					obj = eval("(" + (value[0] === "{" ? "" : "{") + value + (value[0] === "{" ? "" : "}") + ")");
				}
				catch (e) {
					throw new SyntaxError("Error in attribute conversion to object: " + e.message +
						"\nAttribute Value: '" + value + "'");
				}
				return obj;
			}

			function setTypedValue(widget, name, value) {
				switch (typeof widget[name]) {
				case "string":
					props[name] = value;
					break;
				case "number":
					props[name] = value - 0;
					break;
				case "boolean":
					props[name] = value !== "false";
					break;
				case "object":
					var obj = lang.getObject(value, false);
					if (obj) {
						// it's a global, ex: store="myStore"
						props[name] = obj;
					} else {
						// it's an expression, ex: constraints="min: 10, max: 100"
						props[name] = (widget[name] instanceof Array)
							? (value
							? value.split(/\s+/)
							: [])
							: stringToObject(value);
					}
					break;
				case "function":
					/* jshint evil:true */
					// This will only be executed if you have properties that are of function type if your widget
					// and that you set them in your tag attributes:
					// <my-tag whatever="myfunc"></my-tag>
					// This can be avoided by setting the function progammatically or by not setting it at all.
					// This is harmless if you make sure the JavaScript code that is passed to the attribute
					// is harmless.
					props[name] = lang.getObject(value, false) || new Function(value);
				}
				delete widget[name]; // make sure custom setters fire
			}

			var attrsToRemove = [];
			while ((attr = this.attributes[idx++])) {
				// Map all attributes except for things like onclick="..." since the browser already handles them.
				var name = attr.name.toLowerCase();	// note: will be lower case already except for IE9
				if (name in pcm) {
					setTypedValue(this, pcm[name]/* convert to correct case for widget */, attr.value);
					attrsToRemove.push(name);
				}
			}

			// Remove attributes that were processed, but do it in a separate loop so we don't modify this.attributes
			// while we are looping through it.   (See CustomElement-attr.html test failure on IE10.)
			attrsToRemove.forEach(this.removeAttribute, this);

			return props;
		},

		destroy: function () {
			// summary:
			//		Release resources used by this custom element and its descendants.
			//		After calling this method, the element can no longer be used,
			//		and should be removed from the document.

			// Destroy descendants
			this.findCustomElements(this).forEach(function (w) {
				if (w.destroy) {
					w.destroy();
				}
			});

			// Destroy this
			domConstruct.destroy(this);
		},

		emit: function (/*String*/ type, /*Object?*/ eventObj) {
			// summary:
			//		Signal that a synthetic event occurred, ex:
			//	|	myWidget.emit("attrmodified-selectedChildWidget", {}).
			//
			//		Emits an event of specified type, based on eventObj.
			//		Also calls onType() method, if present, and returns value from that method.
			//		Modifies eventObj by adding missing parameters (bubbles, cancelable, widget).
			// tags:
			//		protected

			// Specify fallback values for bubbles, cancelable in case they are not set in eventObj.
			// Also set pointer to widget, although since we can't add a pointer to the widget for native events
			// (see #14729), maybe we shouldn't do it here?
			eventObj = eventObj || {};
			if (eventObj.bubbles === undefined) {
				eventObj.bubbles = true;
			}
			if (eventObj.cancelable === undefined) {
				eventObj.cancelable = true;
			}

			// Emit event, but (for the case of the Widget subclass)
			// avoid spurious emit()'s as parent sets properties on child during startup/destroy
			if (this._started !== false && !this._beingDestroyed) {
				// Call onType() method if one exists.   But skip functions like onchange and onclick
				// because the browser will call them automatically when the event is emitted.
				var ret, callback = this["on" + type];
				if (callback && !("on" + type.toLowerCase() in div)) {
					ret = callback.call(this, eventObj);
				}

				// Emit the event
				on.emit(this, type, eventObj);
			}

			return ret;
		},

		on: function (/*String|Function*/ type, /*Function*/ func) {
			// summary:
			//		Call specified function when event occurs, ex: myWidget.on("click", function () { ... }).
			// type:
			//		Name of event (ex: "click") or extension event like touch.press.
			// description:
			//		Call specified function when event `type` occurs, ex: `myWidget.on("click", function () { ... })`.
			//		Note that the function is not run in any particular scope, so if (for example) you want it to run
			//		in the widget's scope you must do `myWidget.on("click", myWidget.func.bind(myWidget))`.

			return this.own(on(this, type, func))[0];
		},

		defer: function (fcn, delay) {
			// summary:
			//		Wrapper to setTimeout to avoid deferred functions executing
			//		after the originating widget has been destroyed.
			//		Returns an object handle with a remove method (that returns null) (replaces clearTimeout).
			// fcn: Function
			//		Function reference.
			// delay: Number?
			//		Delay, defaults to 0.
			// tags:
			//		protected

			var timer = setTimeout(
				(function () {
					if (!timer) {
						return;
					}
					timer = null;
					if (!this._destroyed) {
						lang.hitch(this, fcn)();
					}
				}).bind(this),
				delay || 0
			);
			return {
				remove: function () {
					if (timer) {
						clearTimeout(timer);
						timer = null;
					}
					return null; // so this works well: handle = handle.remove();
				}
			};
		},

		// Utility functions previously in registry.js

		findCustomElements: function (root) {
			// summary:
			//		Search subtree under root returning custom elements found.
			// root: Element?
			//		Node to search under.

			// TODO: In dijit this didn't search for nested widgets (ie: widgets inside other widgets).

			var outAry = [];

			function getChildrenHelper(root) {
				for (var node = root.firstChild; node; node = node.nextSibling) {
					if (node.nodeType === 1 && node.createdCallback) {
						outAry.push(node);
					} else {
						getChildrenHelper(node);
					}
				}
			}

			getChildrenHelper(root || this.ownerDocument.body);
			return outAry;
		}
	});
});
