// Generated from ../common/transitions/fade.less for theme transitions

define(function(){ return '\
.duiFade {\
  -webkit-transition-property: none;\
  transition-property: none;\
  -webkit-transition-duration: 0s;\
  transition-duration: 0s;\
}\
.duiFade.duiTransition {\
  -webkit-transition-property: opacity;\
  transition-property: opacity;\
  -webkit-transition-duration: 0.6s;\
  transition-duration: 0.6s;\
}\
.duiFade.duiOut {\
  opacity: 1;\
}\
.duiFade.duiOut.duiTransition {\
  -webkit-transition-timing-function: ease-out;\
  transition-timing-function: ease-out;\
  opacity: 0;\
}\
.duiFade.duiIn {\
  opacity: 0;\
}\
.duiFade.duiIn.duiTransition {\
  -webkit-transition-timing-function: ease-in;\
  transition-timing-function: ease-in;\
  opacity: 1;\
}\
'; } );
