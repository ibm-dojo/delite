/** @module delite/Widget */
define([
	"dcl/dcl",
	"./features",
	"ibm-decor/Invalidating",
	"./CustomElement",
	"requirejs-dplugins/css!./css/common.css"
], function (
	dcl,
	has,
	Invalidating,
	CustomElement
) {
	// Used to generate unique id for each widget
	var cnt = 0;

	/**
	 * Base class for all widgets, i.e. custom elements that appear visually.
	 *
	 * Provides stubs for widget lifecycle methods for subclasses to extend, like `initializeRendering()`,
	 * `afterInitializeRendering()`, and `destroy()`, and also public API methods like `observe()`.
	 * @mixin module:delite/Widget
	 * @augments module:delite/CustomElement
	 * @augments module:decor/Invalidating
	 */
	var Widget = dcl([CustomElement, Invalidating], /** @lends module:delite/Widget# */ {
		declaredClass: "delite/Widget",

		/**
		 * Root CSS class of the widget (ex: "d-text-box")
		 * @member {string}
		 * @protected
		 */
		baseClass: "",

		/**
		 * This widget or a widget it contains has focus, or is "active" because
		 * it was recently clicked.
		 * @member {boolean}
		 * @default false
		 * @protected
		 */
		focused: false,

		/**
		 * Unique id for this widget, separate from id attribute (which may or may not be set).
		 * Useful when widget creates subnodes that need unique id's.
		 * @member {number}
		 * @protected
		 */
		widgetId: 0,

		/**
		 * Controls the layout direction of the widget, for example whether the arrow of
		 * a Combobox appears to the right or the left of the input field.
		 *
		 * Values are "ltr" and "rtl", or "" which means that the value is inherited from the
		 * setting on the document root (`<html>`).
		 *
		 * @member {string}
		 */
		dir: "",

		/**
		 * Actual direction of the widget, which can be set explicitly via `dir` property or inherited from the
		 * setting on the document root (`<html>`).
		 * Value is either "ltr" or "rtl".
		 * @member {string}
		 * @readonly
		 */
		effectiveDir: "ltr",

		//////////// INITIALIZATION METHODS ///////////////////////////////////////

		constructor: function () {
			this.widgetId = "d-" + (++cnt);
		},

		// Setup deliver() as a way to force the widget to render before it's attached to the document.
		deliver: dcl.after(function () {
			// Avoid situation where rendering the widget sets attributes on the root node, and then later on,
			// CustomElement thinks those attributes were specified by the user, and removes them.
			this.applyAttributes();

			// Render the widget.
			this.initializeInvalidating();
		}),

		// Override decor/Sateful#processConstructorParameters() for special handle of style etc.
		processConstructorParameters: function (args) {
			if (args.length) {
				var params = args[0];
				for (var name in params || {}) {
					if (name === "style") {
						this.style.cssText = params.style;
					} else if ((name === "class" || name === "className") && this.setClassComponent) {
						this.setClassComponent("user", params[name]);
					} else {
						this[name] = params[name];
					}
				}
			}
		},

		computeProperties: function (props) {
			if ("dir" in props) {
				if ((/^(ltr|rtl)$/i).test(this.dir)) {
					this.effectiveDir = this.dir.toLowerCase();
				} else {
					this.effectiveDir = this.getInheritedDir();
				}
			}
		},

		shouldInitializeRendering: function (oldVals) {
			// render the template on widget creation and also whenever app changes template prop
			return !this.rendered || "template" in oldVals;
		},

		/**
		 * Construct the UI for this widget, filling in subnodes and/or text inside of this.
		 * Most widgets will leverage delite/handlebars! to set `template`, rather than defining this method.
		 * @protected
		 */
		initializeRendering: dcl.advise({
			before: function () {
				this.rendered = false;
				this.beforeInitializeRendering();
			},

			around: function () {
				return function () {
					// Tear down old rendering (if there is one).
					if (this._templateHandle) {
						this._templateHandle.destroy();
						delete this._templateHandle;
					}

					// initializeRendering the widget.
					if (this.template) {
						this._templateHandle = this.template(this.ownerDocument);
					}
				};
			},

			after: function () {
				this.afterInitializeRendering();
				this.rendered = true;
			}
		}),

		/**
		 * Return the direction setting for the page.
		 * @returns {string} "ltr" or "rtl"
		 * @protected
		 */
		getInheritedDir: function () {
			return ((this.ownerDocument.body && this.ownerDocument.body.dir) ||
				this.ownerDocument.documentElement.dir || "ltr").toLowerCase();
		},

		// Override Invalidating#refreshRendering() to execute the template's refreshRendering() code, etc.
		refreshRendering: function (oldVals, justRendered) {
			if (this._templateHandle && !justRendered) {
				// Refresh the template based on changed values, but not right after the template is rendered,
				// because that would be redundant.
				this._templateHandle.refresh(oldVals);
			}

			if ("baseClass" in oldVals) {
				this.removeClass(oldVals.baseClass);
				this.addClass(this.baseClass);
			}
			if ("effectiveDir" in oldVals) {
				this.toggleClass("d-rtl", this.effectiveDir === "rtl");
			}
			if ("dir" in oldVals) {
				this.style.direction = this.dir;
			}
		},

		connectedCallback: function () {
			this.initializeInvalidating();
		},

		/**
		 * Processing before `initializeRendering()`.
		 *
		 * This method is automatically chained, so subclasses generally do not need to use `dcl.superCall()`,
		 * `dcl.advise()`, etc.
		 * @protected
		 */
		beforeInitializeRendering: function () {
		},

		/**
		 * Value returned by delite/handlebars! or compatible template engine.
		 * Specifies how to build the widget DOM initially and also how to update the DOM when
		 * widget properties change.
		 * @member {Function}
		 * @protected
		 */
		template: null,

		/**
		 * Helper method to set a class (or classes) on a given node, removing the class (or classes) set
		 * by the previous call to `setClassComponent()` *for the specified component and node*.  Used mainly by
		 * template.js to set classes without overwriting classes set by the user or other code (ex: CssState).
		 * @param {string} component - Specifies the category.
		 * @param {string} value - Class (or classes) to set.
		 * @param {HTMLElement} [node] - The node to set the property on; defaults to widget root node.
		 * @protected
		 */
		setClassComponent: function (component, value, node) {
			value = value && value.trim();
			if (!node) { node = this; }
			var oldValProp = "_" + component + "Class";
			if (node[oldValProp]) {
				node.classList.remove.apply(node.classList, node[oldValProp].split(/ +/));
			}
			if (value) {
				node.classList.add.apply(node.classList, value.split(/ +/));
			}
			node[oldValProp] = value;
		},

		/**
		 * Helper method to set/remove an attribute on a node based on the given value:
		 *
		 * - If value is null/blank, the attribute is removed.  Useful for attributes like aria-valuenow.
		 * - If value is boolean, the attribute is set to "true" or "false".  Useful for attributes like aria-selected.
		 * - If value is a number, it's converted to a string.
		 *
		 * When called for this widget's root node, sets attribute on this widget's root node even if this widget
		 * overrides `setAttribute()` etc. (like delite/FormWidget).  But when called on a nested custom element,
		 * calls that element's `setAttribute()` method.
		 *
		 * @param {Element} node - The node to set the property on.
		 * @param {string} name - Name of the property.
		 * @param {string} value - Value of the property.
		 * @protected
		 */
		setOrRemoveAttribute: function (node, name, value) {
			if (value === undefined || value === null || value === "") {
				if (node === this) {
					HTMLElement.prototype.removeAttribute.call(node, name);
				} else {
					node.removeAttribute(name);
				}
			} else {
				if (node === this) {
					HTMLElement.prototype.setAttribute.call(node, name, "" + value);
				} else {
					node.setAttribute(name, "" + value);
				}
			}
		},

		/**
		 * Processing after the DOM fragment is created.
		 *
		 * Called after the DOM fragment has been created, but not necessarily
		 * added to the document.  Do not include any operations which rely on
		 * node dimensions or placement.
		 *
		 * This method is automatically chained, so subclasses generally do not need to use `dcl.superCall()`,
		 * `dcl.advise()`, etc.
		 * @protected
		 */
		afterInitializeRendering: function () {
		},

		/**
		 * Returns the parent widget of this widget, or null if there is no parent widget.
		 */
		getParent: function () {
			return this.parentNode ? this.getEnclosingWidget(this.parentNode) : null;
		},

		// Override CustomElement#on() to handle on("focus", ...) when the widget conceptually gets focus.
		on: dcl.superCall(function (sup) {
			return function (type, func, node) {
				// Treat on(focus, "...") like on("focusin", ...) since
				// conceptually when widget.focusNode gets focus, it means the widget itself got focus.
				// Ideally we would set up a wrapper function to ignore focus changes between nodes inside the widget,
				// but evt.relatedTarget in null on FF.
				type = {focus: "focusin", blur: "focusout"}[type] || type;

				return sup.call(this, type, func, node);
			};
		}),

		/**
		 * Place this widget somewhere in the dom, and allow chaining.
		 *
		 * @param {string|Element|DocumentFragment} reference - Element, DocumentFragment,
		 * or id of Element to place this widget relative to.
		 * @param {string|number} [position] Numeric index or a string with the values:
		 * - number - place this widget as n'th child of `reference` node
		 * - "first" - place this widget as first child of `reference` node
		 * - "last" - place this widget as last child of `reference` node
		 * - "before" - place this widget as previous sibling of `reference` node
		 * - "after" - place this widget as next sibling of `reference` node
		 * - "replace" - replace specified reference node with this widget
		 * - "only" - replace all children of `reference` node with this widget
		 * @returns {module:delite/Widget} This widget, for chaining.
		 * @protected
		 * @example
		 * // create a Button with no srcNodeRef, and place it in the body:
		 * var button = new Button({ label:"click" }).placeAt(document.body);
		 * @example
		 * // place a new button as the first element of some div
		 * var button = new Button({ label:"click" }).placeAt("wrapper","first");
		 * @example
		 * // create a contentpane and add it to a TabContainer
		 * var tc = document.getElementById("myTabs");
		 * new ContentPane({ href:"foo.html", title:"Wow!" }).placeAt(tc)
		 */
		placeAt: function (reference, position) {
			if (typeof reference === "string") {
				reference = this.ownerDocument.getElementById(reference);
			}

			if (position === "replace") {
				reference.parentNode.replaceChild(this, reference);
			} else if (position === "only") {
				// SVG nodes, strict elements, and DocumentFragments don't support innerHTML
				for (var c; (c = reference.lastChild);) {
					reference.removeChild(c);
				}
				reference.appendChild(this);
			} else if (/^(before|after)$/.test(position)) {
				reference.parentNode.insertBefore(this, position === "before" ? reference : reference.nextSibling);
			} else {
				// Note: insertBefore(node, null) is equivalent to appendChild().  Second "null" arg needed only on IE.
				var parent = reference.containerNode || reference,
					children = parent.children || Array.prototype.filter.call(parent.childNodes, function (node) {
						return node.nodeType === 1;	// no .children[] on DocumentFragment :-(
					});
				parent.insertBefore(this, children[position === "first" ? 0 : position] || null);
			}

			return this;
		},


		/**
		 * Returns the widget whose DOM tree contains the specified DOMNode, or null if
		 * the node is not contained within the DOM tree of any widget
		 * @param {Element} node
		 */
		getEnclosingWidget: function (node) {
			do {
				if (node.nodeType === 1 && node.initializeRendering) {
					return node;
				}
			} while ((node = node.parentNode));
			return null;
		},

		/**
		 * Toggle class helper method.
		 *
		 * @param {string} value Single or space-separated string representing the classes to toggled.
		 * @param {boolean} [force]
		 *		If force evaluates to true, add the specified class name, and if it evaluates to false, remove it.
		 * @returns {module:delite/Widget} This widget, for chaining.
		 */
		toggleClass: function (value, force) {
			value.split(" ").forEach(function (singleValue) {
				this.classList.toggle(singleValue, force);
			}, this);
			return this;
		},

		/**
		 * Adds the specified class values.
		 * If these classes already exist in the element's class attribute they are ignored.
		 *
		 * @param {string} value Single or space-separated string representing the classes to be added.
		 * @returns {module:delite/Widget} This widget, for chaining.
		 */
		addClass: function (value) {
			if (value) {
				this.classList.add.apply(this.classList, value.trim().split(/ +/));
			}
			return this;
		},

		/**
		 * Remove one or multiple classes.
		 *
		 * @param {string} value Single or space-separated string representing the classes to be removed.
		 * @returns {module:delite/Widget} This widget, for chaining.
		 */
		removeClass: function (value) {
			if (value) {
				this.classList.remove.apply(this.classList, value.trim().split(/ +/));
			}
			return this;
		},

		/**
		 * Determine if this widget contains the given class.
		 *
		 * @param {string} value The class name to search for.
		 * @returns {boolean} True if this widget contains the given class. False otherwise.
		 */
		hasClass: function (className) {
			return this.classList.has(className);
		}
	});

	// Setup automatic chaining for lifecycle methods, except for initializeRendering().
	// destroy() is chained in Destroyable.js.
	dcl.chainAfter(Widget, "beforeInitializeRendering");
	dcl.chainAfter(Widget, "afterInitializeRendering");

	return Widget;
});
