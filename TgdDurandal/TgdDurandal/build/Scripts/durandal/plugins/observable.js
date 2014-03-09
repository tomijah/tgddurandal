define(["durandal/system","durandal/binder","knockout"],function(e,t,n){function i(e){var t=e[0];return"_"===t||"$"===t}function a(t){return!(!t||void 0===t.nodeType||!e.isNumber(t.nodeType))}function r(e){if(!e||a(e)||e.ko===n||e.jquery)return!1;var t=f.call(e);return-1==v.indexOf(t)&&!(e===!0||e===!1)}function o(e,t){var n=e.__observable__,i=!0;if(!n||!n.__full__){n=n||(e.__observable__={}),n.__full__=!0,p.forEach(function(n){e[n]=function(){i=!1;var e=y[n].apply(t,arguments);return i=!0,e}}),h.forEach(function(n){e[n]=function(){i&&t.valueWillMutate();var a=m[n].apply(e,arguments);return i&&t.valueHasMutated(),a}}),g.forEach(function(n){e[n]=function(){for(var a=0,r=arguments.length;r>a;a++)s(arguments[a]);i&&t.valueWillMutate();var o=m[n].apply(e,arguments);return i&&t.valueHasMutated(),o}}),e.splice=function(){for(var n=2,a=arguments.length;a>n;n++)s(arguments[n]);i&&t.valueWillMutate();var r=m.splice.apply(e,arguments);return i&&t.valueHasMutated(),r};for(var a=0,r=e.length;r>a;a++)s(e[a])}}function s(t){var a,s;if(r(t)&&(a=t.__observable__,!a||!a.__full__)){if(a=a||(t.__observable__={}),a.__full__=!0,e.isArray(t)){var c=n.observableArray(t);o(t,c)}else for(var u in t)i(u)||a[u]||(s=t[u],e.isFunction(s)||l(t,u,s));b&&e.log("Converted",t)}}function c(e,t,n){var i;e(t),i=e.peek(),n?i?i.destroyAll||o(i,e):(i=[],e(i),o(i,e)):s(i)}function l(t,i,a){var r,l,u=t.__observable__||(t.__observable__={});if(void 0===a&&(a=t[i]),e.isArray(a))r=n.observableArray(a),o(a,r),l=!0;else if("function"==typeof a){if(!n.isObservable(a))return null;r=a}else e.isPromise(a)?(r=n.observable(),a.then(function(t){if(e.isArray(t)){var i=n.observableArray(t);o(t,i),t=i}r(t)})):(r=n.observable(a),s(a));return Object.defineProperty(t,i,{configurable:!0,enumerable:!0,get:r,set:n.isWriteableObservable(r)?function(t){t&&e.isPromise(t)?t.then(function(t){c(r,t,e.isArray(t))}):c(r,t,l)}:void 0}),u[i]=r,r}function u(t,i,a){var r,o={owner:t,deferEvaluation:!0};return"function"==typeof a?o.read=a:("value"in a&&e.error('For defineProperty, you must not specify a "value" for the property. You must provide a "get" function.'),"function"!=typeof a.get&&e.error('For defineProperty, the third parameter must be either an evaluator function, or an options object containing a function called "get".'),o.read=a.get,o.write=a.set),r=n.computed(o),t[i]=r,l(t,i,r)}var d,f=Object.prototype.toString,v=["[object Function]","[object String]","[object Boolean]","[object Number]","[object Date]","[object RegExp]"],p=["remove","removeAll","destroy","destroyAll","replace"],h=["pop","reverse","sort","shift","splice"],g=["push","unshift"],m=Array.prototype,y=n.observableArray.fn,b=!1;return d=function(e,t){var i,a,r;return e?(i=e.__observable__,i&&(a=i[t])?a:(r=e[t],n.isObservable(r)?r:l(e,t,r))):null},d.defineProperty=u,d.convertProperty=l,d.convertObject=s,d.install=function(e){var n=t.binding;t.binding=function(e,t,i){i.applyBindings&&!i.skipConversion&&s(e),n(e,t)},b=e.logConversion},d});