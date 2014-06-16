/** @module delite/Store */
define(["dcl/dcl", "dojo/when", "./Invalidating"], function (dcl, when, Invalidating) {

	var isStoreInvalidated = function (props) {
		return props.store || props.query || props.startIndex || props.endIndex;
	};

	var setStoreValidate = function (props) {
		props.store = props.query = props.startIndex = props.endIndex = false;
	};

	/**
	 * Mixin for widgets for store management that creates widget render items from store items after
	 * querying the store. The receiving class must extend delite/Stateful and dojo/Evented or
	 * delite/Widget.
	 *
	 * Classes extending this mixin automatically create render items that are consumable by the widget
	 * from store items after querying the store. This happens each time the widget store, query or
	 * queryOptions properties are set. If that store is Observable it will be observed and render items
	 * will be automatically updated, added or deleted from the items property based on store notifications.
	 *
	 * @mixin module:delite/Store
	 * @augments module:delite/Invalidating
	 */
	return dcl(Invalidating, /** @lends module:delite/Store# */{
		/**
		 * The store that contains the items to display.
		 * @member {dstore/Store}
		 * @default null
		 */
		store: null,

		/**
		 * A query filter to apply to the store.
		 * @member {Object}
		 * @default {}
		 */
		query: {},

		/**
		 * Range start index. If 0 and `endIndex` is Infinity no ranging will occur. Ranging is applied after tracking.
		 * @member {number}
		 * @default {0}
		 */
		startIndex: 0,

		/**
		 * Range end index. If Infinity and `startIndex` is 0 no ranging will occur. Ranging is applied after tracking.
		 * @member {number}
		 * @default {Infinity}
		 */
		endIndex: Infinity,

		/**
		 * A function that processes the store/collection and returns a new collection (to sort it,
		 * filter it etc...). This processing is applied before potentially tracking the store for modifications 
		 * (if Observable).
		 * Changing this function on the instance will not automatically refresh the class.
		 * @default identity function
		 */
		processStore: function (store) { return store; },

		/**
		 * The render items corresponding to the store items for this widget. This is filled from the store and
		 * is not supposed to be modified directly. Initially null. 
		 * @member {Object[]}
		 * @default null
		 */
		renderItems: null,

		preCreate: function () {
			// we want to be able to wait for potentially several of those properties to be set before
			// actually firing the store request
			this.addInvalidatingProperties({
					"store": "invalidateProperty",
					"query": "invalidateProperty"
				}
			);
		},

		/**
		 * Creates a store item based from the widget internal item.
		 * @param {Object} renderItem - The render item.
		 * @returns {Object}
		 */
		renderItemToItem: function (renderItem) {
			return renderItem;
		},

		/**
		 * Returns the widget internal item for a given store item. By default it returns the store
		 * item itself.
		 * @param {Object} item - The store item.
		 * @returns {Object}
		 * @protected
		 */
		itemToRenderItem: function (item) {
			return item;
		},

		/**
		 * This method is called once the query has been executed to initial the renderItems array
		 * with the list of initial render items.
		 *
		 * This method sets the renderItems property to the render items array passed as parameter. Once
		 * done, it fires a 'query-success' event.
		 * @param {Object[]} renderItems - The array of initial render items to be set in the renderItems property.
		 * @protected
		 */
		initItems: function (renderItems) {
			this.renderItems = renderItems;
			this.emit("query-success", { renderItems: renderItems, cancelable: false, bubbles: true });
		},

		/**
		 * If the store parameters are invalidated, queries the store, creates the render items and calls initItems() 
		 * when ready. If an error occurs a 'query-error' event will be fired.
		 * @param props
		 * @protected
		 */
		refreshProperties: function (props) {
			if (isStoreInvalidated(props)) {
				setStoreValidate(props);
				this.queryStoreAndInitItems(this.processStore);
			}
		},

		/**
		 * Queries the store, creates the render items and calls initItems() when ready. If an error occurs
		 * a 'query-error' event will be fired.
		 *
		 * This method is not supposed to be called by application developer.
		 * It will be called automatically when modifying the store related properties or by the subclass
		 * if needed.
		 * @param processStore - A function that processes the store/collection and returns a new collection
		 * (to sort it, filter it etc...), applied before tracking.
		 * @returns {Promise} If store to be processed is not null a promise that will be resolved when the loading 
		 * process will be finished.
		 * @protected
		 */
		queryStoreAndInitItems: function (processStore) {
			this._untrack();
			if (this.store != null) {
				var collection = processStore.call(this, this.store.filter(this.query));
				if (collection.track) {
					// user asked us to observe the store
					var tracked = this._tracked = collection.track();
					tracked.on("add", this._itemAdded.bind(this));
					tracked.on("update", this._itemUpdated.bind(this));
					tracked.on("remove", this._itemRemoved.bind(this));
				}
				if (this.startIndex !== 0 || this.endIndex !== Infinity) {
					collection = collection.range(this.startIndex, this.endIndex);
				}
				return this.fetch(collection);
			} else {
				this.initItems([]);
			}
		},

		/**
		 * Called to process the items returned after querying the store.
		 * @param {dstore/Collection} collection - Items to be displayed.
		 */
		fetch: function (collection) {
			return when(collection.map(function (item) {
				// if we have a mapping function between store item and some intermediary items use it
				return this.itemToRenderItem(item);
			}, this)).then(this.initItems.bind(this), this._queryError.bind(this));
		},

		_queryError: function (error) {
			console.log(error);
			this.emit("query-error", { error: error, cancelable: false, bubbles: true });
		},

		_untrack: function () {
			if (this._tracked) {
				this._tracked.tracking.remove();
				this._tracked = null;
			}
		},
		
		_isIndexInRange: function (index) {
			return index >= this.startIndex && index <= this.endIndex;
		},

		destroy: function () {
			this._untrack();
		},

		/**
		 * This method is called when an item is removed from an observable store. The default
		 * implementation actually removes a renderItem from the renderItems array. This can be redefined but
		 * must not be called directly.
		 * @param {number} index - The index of the render item to remove in the range.
		 * @param {Object[]} renderItems - The array of render items to remove the render item from.
		 * @protected
		 */
		itemRemoved: function (index, renderItems) {
			renderItems.splice(index, 1);
		},

		/**
		 * This method is called when an item is added in an observable store. The default
		 * implementation actually adds the renderItem to the renderItems array. This can be redefined but
		 * must not be called directly.
		 * @param {number} index - The index where to add the render item in the range.
		 * @param {Object} renderItem - The render item to be added.
		 * @param {Object[]} renderItems - The array of render items to add the render item to.
		 * @protected
		 */
		itemAdded: function (index, renderItem, renderItems) {
			renderItems.splice(index, 0, renderItem);
		},

		/**
		 * This method is called when an item is updated in an observable store. The default
		 * implementation actually updates the renderItem in the renderItems array. This can be redefined but
		 * must not be called directly.
		 * @param {number} index - The index of the render item to update in the range.
		 * @param {Object} renderItem - The render item data the render item must be updated with.
		 * @param {Object[]} renderItems - The array of render items to render item to be updated is part of.
		 * @protected
		 */
		itemUpdated: function (index, renderItem, renderItems) {
			// we want to keep the same item object and mixin new values into old object
			dcl.mix(renderItems[index], renderItem);
		},

		/**
		 * This method is called when an item is moved in an observable store. The default
		 * implementation actually moves the renderItem in the renderItems array. This can be redefined but
		 * must not be called directly.
		 * @param {number} previousIndex - The previous index of the render item in the range.
		 * @param {number} newIndex - The new index of the render item in the range.
		 * @param {Object} renderItem - The render item to be moved.
		 * @param {Object[]} renderItems - The array of render items to render item to be moved is part of.
		 * @protected
		 */
		itemMoved: function (previousIndex, newIndex, renderItem, renderItems) {
			// we want to keep the same item object and mixin new values into old object
			this.itemRemoved(previousIndex - this.startIndex, renderItems);
			this.itemAdded(newIndex - this.startIndex, renderItem, renderItems);
		},

		/**
		 * When the store is observed and an item is removed in the store this method is called to remove the
		 * corresponding render item. This can be redefined but must not be called directly.
		 * @param {Event} event - The "remove" `dstore/Observable` event.
		 * @protected
		 */
		_itemRemoved: function (event) {
			if (event.previousIndex !== undefined && this._isIndexInRange(event.previousIndex)) {
				this.itemRemoved(event.previousIndex - this.startIndex, this.renderItems);
				this.renderItems = this.renderItems;
			}
			// if no previousIndex the items is removed outside of the range we monitor so we don't care
		},

		/**
		 * When the store is observed and an item is updated in the store this method is called to update the
		 * corresponding render item.  This can be redefined but must not be called directly.
		 * @param {Event} event - The "update" `dstore/Observable` event.
		 * @private
		 */
		_itemUpdated: function (event) {
			if (event.index === undefined) {
				// this is actually a remove
				if (this._isIndexInRange(event.previousIndex)) {
					this.itemRemoved(event.previousIndex - this.startIndex, this.renderItems);
				}
			} else if (event.previousIndex === undefined) {
				// this is actually a add
				if (this._isIndexInRange(event.index)) {
					this.itemAdded(event.index - this.startIndex, this.itemToRenderItem(event.target), this.renderItems);
				}
			} else if (event.index !== event.previousIndex) {
				if (this._isIndexInRange(event.index)) {
					if (this._isIndexInRange(event.previousIndex)) {
						// this is a move
						this.itemMoved(event.previousIndex - this.startIndex, event.index,
							this.itemToRenderItem(event.target), this.renderItems);
					} else {
						// this a add for our range
						this.itemAdded(event.index - this.startIndex, this.itemToRenderItem(event.target),
							this.renderItems);
					}
				} else if (this._isIndexInRange(event.previousIndex)) {
					// this a remove for our range
					this.itemRemoved(event.previousIndex - this.startIndex, this.renderItems);
				}
			} else {
				if (this._isIndexInRange(event.index)) {
					// we want to keep the same item object and mixin new values into old object
					this.itemUpdated(event.index - this.startIndex, this.itemToRenderItem(event.target),
						this.renderItems);
				}
			}
			// set back the modified items property
			this.renderItems = this.renderItems;
		},

		/**
		 * When the store is observed and an item is added in the store this method is called to add the
		 * corresponding render item. This can be redefined but must not be called directly.
		 * @param {Event} event - The "add" `dstore/Observable` event.
		 * @private
		 */
		_itemAdded: function (event) {
			if (event.index !== undefined && this._isIndexInRange(event.index)) {
				this.itemAdded(event.index - this.startIndex, this.itemToRenderItem(event.target), this.renderItems);
				// set back the modified items property
				this.renderItems = this.renderItems;
			}
			// if no index the item is added outside of the range we monitor so we don't care
		}
	});
});
