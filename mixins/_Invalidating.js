define(["dojo/_base/declare", "dojo/_base/lang"],
	function(declare, lang){
		
	return declare(null, {
		// summary:
		//		Mixin for classes (usually widgets) that watch invalidated properties and delay the rendering
		//		after these properties modifications to the next execution frame. The receiving class must extend
		//		dojo/Stateful and dojo/Evented or dijit/_WidgetBase.
		
		// _invalidatingProperties: String[]
		//		The list of properties to watch for to trigger invalidation. This list must be initialized in the
		//		constructor. Default value is null.
		_invalidatingProperties: null,
		// invalidatedProperties: Object
		//		A hash of invalidated properties.
		invalidatedProperties: {},
		// invalidRenderering: Boolean
		//		Whether the rendering is invalid or not. This is a readonly information, one must call 
		//		invalidateRendering to modify this flag. 
		invalidRendering: false,

		postscript: function(mixin){
			// tags:
			//		protected
			this.inherited(arguments);
			if(this._invalidatingProperties){
				var props = this._invalidatingProperties;
				for(var i = 0; i < props.length; i++){
					this.watch(props[i], lang.hitch(this, this.invalidateRendering));
					if(mixin && props[i] in mixin){
						// if the prop happens to have been passed in the ctor mixin we are invalidated
						this.invalidateRendering(props[i]);
					}
				}
			}
		},
		addInvalidatingProperties: function(/*String[]*/ properties){
			// summary:
			//		Add properties to the watched properties to trigger invalidation. This method must be called in
			//		the constructor. It is typically used by subclasses of a _Invalidating class to add more properties
			//		to watch for.
			// properties:
			//		The list of properties to watch for.
			// tags:
			//		protected
			this._invalidatingProperties = this._invalidatingProperties?this._invalidatingProperties.concat(properties):properties;
		},
		invalidateRendering: function(name){
			// summary:
			//		Invalidating the rendering for the next executation frame.
			// tags:
			//		protected
			if(!this.invalidatedProperties[name]){
				this.invalidatedProperties[name] = true;
			}
			if(!this.invalidRendering){
				this.invalidRendering = true;
				setTimeout(lang.hitch(this, this.validateRendering), 0);
			}
		},
		validateRendering: function(){
			// summary:
			//		Immediately validate the rendering if it has been invalidated. You generally do not call that method yourself.
			// tags:
			//		protected
			if(this.invalidRendering){
				this.refreshRendering();
				this.invalidatedProperties = {};
				this.invalidRendering = false;
				this.emit("refresh-complete", { 	bubbles: true, cancelable: false });
			}
		},
		refreshRendering: function(){
			// summary:
			//		Actually refresh the rendering. Implementation should implement that method.
			// tags:
			//		protected
		}
	});
});
