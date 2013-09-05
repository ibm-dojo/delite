// Generated from ../common/transitions/flip.less for theme transitions

define(function(){ return '\
.duiFlip {\
  -webkit-transition-property: none;\
  transition-property: none;\
  -webkit-transition-duration: 0s;\
  transition-duration: 0s;\
}\
.duiFlip.duiTransition {\
  -webkit-transition-property: all;\
  transition-property: all;\
  -webkit-transition-duration: 0.2s;\
  transition-duration: 0.2s;\
  -webkit-transition-timing-function: linear;\
  transition-timing-function: linear;\
}\
.duiFlip.duiOut {\
  opacity: 1;\
  -webkit-transform: scale(1, 1) skew(0, 0) !important;\
  transform: scale(1, 1) skew(0, 0) !important;\
}\
.duiFlip.duiOut.duiTransition {\
  opacity: 0;\
  -webkit-transform: scale(0, 0.8) skew(0, 30deg) !important;\
  transform: scale(0, 0.8) skew(0, 30deg) !important;\
}\
.duiFlip.duiIn {\
  opacity: 0;\
  -webkit-transform: scale(0, 0.8) skew(0, -30deg) !important;\
  transform: scale(0, 0.8) skew(0, -30deg) !important;\
}\
.duiFlip.duiIn.duiTransition {\
  -webkit-transition-delay: 0.2s;\
  transition-delay: 0.2s;\
  opacity: 1;\
  -webkit-transform: scale(1, 1) skew(0, 0) !important;\
  transform: scale(1, 1) skew(0, 0) !important;\
}\
.dj_android.dj_tablet .duiFlip.duiTransition {\
  -webkit-transition-duration: 0.4s;\
  transition-duration: 0.4s;\
}\
.dj_android.dj_tablet .duiFlip.duiIn.duiTransition {\
  -webkit-transition-delay: 0.4s;\
  transition-delay: 0.4s;\
}\
'; } );
