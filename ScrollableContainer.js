define([
	"dcl/dcl",
	"dojo/dom",
	"dojo/dom-style",
	"dojo/_base/fx",
	"dojo/fx/easing",
	// "./mobile/Container",
	"./register",
	"./Widget",
	"./Container",
	"./themes/load!ScrollableContainer"
], function(dcl, dom, domStyle, baseFx, easing, register, Widget, Container){

	// module:
	//		dui/ScrollableContainer

	var ScrollableContainer = dcl([Widget, Container], {
		// summary:
		//		A container widget with scrolling capabilities.
		// description:
		//		Container is a container widget which can scroll its content.

		// scrollDir: String
		//		v: vertical, h: horizontal, vh: both, f: flip
		scrollDir: "v",
		
		// baseClass: String
		//		The name of the CSS class of this widget.
		baseClass: "duiScrollableContainer",
		
		buildRendering: function(){
			this.containerNode = this;
			dom.setSelectable(this.containerNode, false);
			
			if(this.scrollDir.indexOf("v") != -1){ 
				domStyle.set(this.containerNode, "overflowY", "scroll"); 
			} 
			if(this.scrollDir.indexOf("h") != -1 || 
				this.scrollDir.indexOf("f") != -1){ 
				domStyle.set(this.containerNode, "overflowX", "scroll"); 
			} 
		},
		
		scrollTo: function(y, /*Number?*/duration){
			// summary:
			//		Scrolls to the given position.
			// to:
			//		The scroll destination position. An object with x and/or y.
			//		ex. {x:0, y:-5}, {y:-29}, etc.
			// duration:
			//		Duration of scrolling in milliseconds.
			
			// TODO: depending on whether we will want to support horizontal scroll
			// in addition to vertical scroll, we will transform the "to" argument into 
			// an object with x and/or y properties.
			var self = this;
			var domNode = this.containerNode;
			if(duration <= 0){ // shortcut
				domNode.scrollTop = y;
				return;
			}
			var animation = function(y){
				if(self._animation && self._animation.status() == "playing"){
					self._animation.stop();
				}
				var	anim = new baseFx.Animation({
					beforeBegin: function(){
						if(this.curve){
							delete this.curve;
						}
						anim.curve = new baseFx._Line(domNode.scrollTop, y);
					},
					onAnimate: function(val){
						domNode.scrollTop = val;
					},
					easing: easing.expoInOut, // TODO: IMPROVEME
					duration: duration,
					rate: 20 // TODO: IMPROVEME
				});
				self._animation = anim;

				return anim; // dojo/_base/fx/Animation
			};
			animation(to).play();
		}
	});
	
	return register("d-scrollable-container", [HTMLElement, ScrollableContainer]);
});