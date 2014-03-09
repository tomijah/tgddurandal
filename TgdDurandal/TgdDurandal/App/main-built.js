(function () {
/**
 * almond 0.2.6 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    function onResourceLoad(name, defined, deps){
        if(requirejs.onResourceLoad && name){
            requirejs.onResourceLoad({defined:defined}, {id:name}, deps);
        }
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }

        onResourceLoad(name, defined, args);
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("../Scripts/almond-custom", function(){});

define('durandal/system',["require","jquery"],function(e,t){function n(e){var t="[object "+e+"]";i["is"+e]=function(e){return c.call(e)==t}}var i,r=!1,o=Object.keys,a=Object.prototype.hasOwnProperty,c=Object.prototype.toString,u=!1,s=Array.isArray,l=Array.prototype.slice;if(Function.prototype.bind&&("object"==typeof console||"function"==typeof console)&&"object"==typeof console.log)try{["log","info","warn","error","assert","dir","clear","profile","profileEnd"].forEach(function(e){console[e]=this.call(console[e],console)},Function.prototype.bind)}catch(d){u=!0}e.on&&e.on("moduleLoaded",function(e,t){i.setModuleId(e,t)}),"undefined"!=typeof requirejs&&(requirejs.onResourceLoad=function(e,t){i.setModuleId(e.defined[t.id],t.id)});var f=function(){},v=function(){try{if("undefined"!=typeof console&&"function"==typeof console.log)if(window.opera)for(var e=0;e<arguments.length;)console.log("Item "+(e+1)+": "+arguments[e]),e++;else 1==l.call(arguments).length&&"string"==typeof l.call(arguments)[0]?console.log(l.call(arguments).toString()):console.log.apply(console,l.call(arguments));else Function.prototype.bind&&!u||"undefined"==typeof console||"object"!=typeof console.log||Function.prototype.call.call(console.log,console,l.call(arguments))}catch(t){}},g=function(e){if(e instanceof Error)throw e;throw new Error(e)};i={version:"2.0.1",noop:f,getModuleId:function(e){return e?"function"==typeof e?e.prototype.__moduleId__:"string"==typeof e?null:e.__moduleId__:null},setModuleId:function(e,t){return e?"function"==typeof e?(e.prototype.__moduleId__=t,void 0):("string"!=typeof e&&(e.__moduleId__=t),void 0):void 0},resolveObject:function(e){return i.isFunction(e)?new e:e},debug:function(e){return 1==arguments.length&&(r=e,r?(this.log=v,this.error=g,this.log("Debug:Enabled")):(this.log("Debug:Disabled"),this.log=f,this.error=f)),r},log:f,error:f,assert:function(e,t){e||i.error(new Error(t||"Assert:Failed"))},defer:function(e){return t.Deferred(e)},guid:function(){return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(e){var t=0|16*Math.random(),n="x"==e?t:8|3&t;return n.toString(16)})},acquire:function(){var t,n=arguments[0],r=!1;return i.isArray(n)?(t=n,r=!0):t=l.call(arguments,0),this.defer(function(n){e(t,function(){var e=arguments;setTimeout(function(){e.length>1||r?n.resolve(l.call(e,0)):n.resolve(e[0])},1)},function(e){n.reject(e)})}).promise()},extend:function(e){for(var t=l.call(arguments,1),n=0;n<t.length;n++){var i=t[n];if(i)for(var r in i)e[r]=i[r]}return e},wait:function(e){return i.defer(function(t){setTimeout(t.resolve,e)}).promise()}},i.keys=o||function(e){if(e!==Object(e))throw new TypeError("Invalid object");var t=[];for(var n in e)a.call(e,n)&&(t[t.length]=n);return t},i.isElement=function(e){return!(!e||1!==e.nodeType)},i.isArray=s||function(e){return"[object Array]"==c.call(e)},i.isObject=function(e){return e===Object(e)},i.isBoolean=function(e){return"boolean"==typeof e},i.isPromise=function(e){return e&&i.isFunction(e.then)};for(var p=["Arguments","Function","String","Number","Date","RegExp"],h=0;h<p.length;h++)n(p[h]);return i});
define('durandal/viewEngine',["durandal/system","jquery"],function(e,t){var n;return n=t.parseHTML?function(e){return t.parseHTML(e)}:function(e){return t(e).get()},{viewExtension:".html",viewPlugin:"text",isViewUrl:function(e){return-1!==e.indexOf(this.viewExtension,e.length-this.viewExtension.length)},convertViewUrlToViewId:function(e){return e.substring(0,e.length-this.viewExtension.length)},convertViewIdToRequirePath:function(e){return this.viewPlugin+"!"+e+this.viewExtension},parseMarkup:n,processMarkup:function(e){var t=this.parseMarkup(e);return this.ensureSingleElement(t)},ensureSingleElement:function(e){if(1==e.length)return e[0];for(var n=[],i=0;i<e.length;i++){var r=e[i];if(8!=r.nodeType){if(3==r.nodeType){var o=/\S/.test(r.nodeValue);if(!o)continue}n.push(r)}}return n.length>1?t(n).wrapAll('<div class="durandal-wrapper"></div>').parent().get(0):n[0]},createView:function(t){var n=this,i=this.convertViewIdToRequirePath(t);return e.defer(function(r){e.acquire(i).then(function(e){var i=n.processMarkup(e);i.setAttribute("data-view",t),r.resolve(i)}).fail(function(e){n.createFallbackView(t,i,e).then(function(e){e.setAttribute("data-view",t),r.resolve(e)})})}).promise()},createFallbackView:function(t,n){var i=this,r='View Not Found. Searched for "'+t+'" via path "'+n+'".';return e.defer(function(e){e.resolve(i.processMarkup('<div class="durandal-view-404">'+r+"</div>"))}).promise()}}});
define('durandal/viewLocator',["durandal/system","durandal/viewEngine"],function(e,t){function n(e,t){for(var n=0;n<e.length;n++){var i=e[n],r=i.getAttribute("data-view");if(r==t)return i}}function i(e){return(e+"").replace(/([\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:])/g,"\\$1")}return{useConvention:function(e,t,n){e=e||"viewmodels",t=t||"views",n=n||t;var r=new RegExp(i(e),"gi");this.convertModuleIdToViewId=function(e){return e.replace(r,t)},this.translateViewIdToArea=function(e,t){return t&&"partial"!=t?n+"/"+t+"/"+e:n+"/"+e}},locateViewForObject:function(t,n,i){var r;if(t.getView&&(r=t.getView()))return this.locateView(r,n,i);if(t.viewUrl)return this.locateView(t.viewUrl,n,i);var o=e.getModuleId(t);return o?this.locateView(this.convertModuleIdToViewId(o),n,i):this.locateView(this.determineFallbackViewId(t),n,i)},convertModuleIdToViewId:function(e){return e},determineFallbackViewId:function(e){var t=/function (.{1,})\(/,n=t.exec(e.constructor.toString()),i=n&&n.length>1?n[1]:"";return"views/"+i},translateViewIdToArea:function(e){return e},locateView:function(i,r,o){if("string"==typeof i){var a;if(a=t.isViewUrl(i)?t.convertViewUrlToViewId(i):i,r&&(a=this.translateViewIdToArea(a,r)),o){var u=n(o,a);if(u)return e.defer(function(e){e.resolve(u)}).promise()}return t.createView(a)}return e.defer(function(e){e.resolve(i)}).promise()}}});
define('durandal/binder',["durandal/system","knockout"],function(e,t){function n(t){return void 0===t?{applyBindings:!0}:e.isBoolean(t)?{applyBindings:t}:(void 0===t.applyBindings&&(t.applyBindings=!0),t)}function i(i,s,l,v){if(!s||!l)return r.throwOnErrors?e.error(a):e.log(a,s,v),void 0;if(!s.getAttribute)return r.throwOnErrors?e.error(o):e.log(o,s,v),void 0;var f=s.getAttribute("data-view");try{var d;return i&&i.binding&&(d=i.binding(s)),d=n(d),r.binding(v,s,d),d.applyBindings?(e.log("Binding",f,v),t.applyBindings(l,s)):i&&t.utils.domData.set(s,u,{$data:i}),r.bindingComplete(v,s,d),i&&i.bindingComplete&&i.bindingComplete(s),t.utils.domData.set(s,c,d),d}catch(g){g.message=g.message+";\nView: "+f+";\nModuleId: "+e.getModuleId(v),r.throwOnErrors?e.error(g):e.log(g.message)}}var r,a="Insufficient Information to Bind",o="Unexpected View Type",c="durandal-binding-instruction",u="__ko_bindingContext__";return r={binding:e.noop,bindingComplete:e.noop,throwOnErrors:!1,getBindingInstruction:function(e){return t.utils.domData.get(e,c)},bindContext:function(e,t,n){return n&&e&&(e=e.createChildContext(n)),i(n,t,e,n||(e?e.$data:null))},bind:function(e,t){return i(e,t,e,e)}}});
define('durandal/activator',["durandal/system","knockout"],function(e,t){function n(e){return void 0==e&&(e={}),e.closeOnDeactivate||(e.closeOnDeactivate=v.defaults.closeOnDeactivate),e.beforeActivate||(e.beforeActivate=v.defaults.beforeActivate),e.afterDeactivate||(e.afterDeactivate=v.defaults.afterDeactivate),e.affirmations||(e.affirmations=v.defaults.affirmations),e.interpretResponse||(e.interpretResponse=v.defaults.interpretResponse),e.areSameItem||(e.areSameItem=v.defaults.areSameItem),e}function i(t,n,i){return e.isArray(i)?t[n].apply(t,i):t[n](i)}function a(t,n,i,a,r){if(t&&t.deactivate){e.log("Deactivating",t);var c;try{c=t.deactivate(n)}catch(o){return e.error(o),a.resolve(!1),void 0}c&&c.then?c.then(function(){i.afterDeactivate(t,n,r),a.resolve(!0)},function(t){e.log(t),a.resolve(!1)}):(i.afterDeactivate(t,n,r),a.resolve(!0))}else t&&i.afterDeactivate(t,n,r),a.resolve(!0)}function r(t,n,a,r){if(t)if(t.activate){e.log("Activating",t);var c;try{c=i(t,"activate",r)}catch(o){return e.error(o),a(!1),void 0}c&&c.then?c.then(function(){n(t),a(!0)},function(t){e.log(t),a(!1)}):(n(t),a(!0))}else n(t),a(!0);else a(!0)}function c(t,n,i){return i.lifecycleData=null,e.defer(function(a){if(t&&t.canDeactivate){var r;try{r=t.canDeactivate(n)}catch(c){return e.error(c),a.resolve(!1),void 0}r.then?r.then(function(e){i.lifecycleData=e,a.resolve(i.interpretResponse(e))},function(t){e.error(t),a.resolve(!1)}):(i.lifecycleData=r,a.resolve(i.interpretResponse(r)))}else a.resolve(!0)}).promise()}function o(t,n,a,r){return a.lifecycleData=null,e.defer(function(c){if(t==n())return c.resolve(!0),void 0;if(t&&t.canActivate){var o;try{o=i(t,"canActivate",r)}catch(u){return e.error(u),c.resolve(!1),void 0}o.then?o.then(function(e){a.lifecycleData=e,c.resolve(a.interpretResponse(e))},function(t){e.error(t),c.resolve(!1)}):(a.lifecycleData=o,c.resolve(a.interpretResponse(o)))}else c.resolve(!0)}).promise()}function u(i,u){var v,f=t.observable(null);u=n(u);var s=t.computed({read:function(){return f()},write:function(e){s.viaSetter=!0,s.activateItem(e)}});return s.__activator__=!0,s.settings=u,u.activator=s,s.isActivating=t.observable(!1),s.canDeactivateItem=function(e,t){return c(e,t,u)},s.deactivateItem=function(t,n){return e.defer(function(e){s.canDeactivateItem(t,n).then(function(i){i?a(t,n,u,e,f):(s.notifySubscribers(),e.resolve(!1))})}).promise()},s.canActivateItem=function(e,t){return o(e,f,u,t)},s.activateItem=function(t,n){var i=s.viaSetter;return s.viaSetter=!1,e.defer(function(c){if(s.isActivating())return c.resolve(!1),void 0;s.isActivating(!0);var o=f();return u.areSameItem(o,t,v,n)?(s.isActivating(!1),c.resolve(!0),void 0):(s.canDeactivateItem(o,u.closeOnDeactivate).then(function(l){l?s.canActivateItem(t,n).then(function(l){l?e.defer(function(e){a(o,u.closeOnDeactivate,u,e)}).promise().then(function(){t=u.beforeActivate(t,n),r(t,f,function(e){v=n,s.isActivating(!1),c.resolve(e)},n)}):(i&&s.notifySubscribers(),s.isActivating(!1),c.resolve(!1))}):(i&&s.notifySubscribers(),s.isActivating(!1),c.resolve(!1))}),void 0)}).promise()},s.canActivate=function(){var e;return i?(e=i,i=!1):e=s(),s.canActivateItem(e)},s.activate=function(){var e;return i?(e=i,i=!1):e=s(),s.activateItem(e)},s.canDeactivate=function(e){return s.canDeactivateItem(s(),e)},s.deactivate=function(e){return s.deactivateItem(s(),e)},s.includeIn=function(e){e.canActivate=function(){return s.canActivate()},e.activate=function(){return s.activate()},e.canDeactivate=function(e){return s.canDeactivate(e)},e.deactivate=function(e){return s.deactivate(e)}},u.includeIn?s.includeIn(u.includeIn):i&&s.activate(),s.forItems=function(t){u.closeOnDeactivate=!1,u.determineNextItemToActivate=function(e,t){var n=t-1;return-1==n&&e.length>1?e[1]:n>-1&&n<e.length-1?e[n]:null},u.beforeActivate=function(e){var n=s();if(e){var i=t.indexOf(e);-1==i?t.push(e):e=t()[i]}else e=u.determineNextItemToActivate(t,n?t.indexOf(n):0);return e},u.afterDeactivate=function(e,n){n&&t.remove(e)};var n=s.canDeactivate;s.canDeactivate=function(i){return i?e.defer(function(e){function n(){for(var t=0;t<r.length;t++)if(!r[t])return e.resolve(!1),void 0;e.resolve(!0)}for(var a=t(),r=[],c=0;c<a.length;c++)s.canDeactivateItem(a[c],i).then(function(e){r.push(e),r.length==a.length&&n()})}).promise():n()};var i=s.deactivate;return s.deactivate=function(n){return n?e.defer(function(e){function i(i){s.deactivateItem(i,n).then(function(){r++,t.remove(i),r==c&&e.resolve()})}for(var a=t(),r=0,c=a.length,o=0;c>o;o++)i(a[o])}).promise():i()},s},s}var v,f={closeOnDeactivate:!0,affirmations:["yes","ok","true"],interpretResponse:function(n){return e.isObject(n)&&(n=n.can||!1),e.isString(n)?-1!==t.utils.arrayIndexOf(this.affirmations,n.toLowerCase()):n},areSameItem:function(e,t){return e==t},beforeActivate:function(e){return e},afterDeactivate:function(e,t,n){t&&n&&n(null)}};return v={defaults:f,create:u,isActivator:function(e){return e&&e.__activator__}}});
define('durandal/composition',["durandal/system","durandal/viewLocator","durandal/binder","durandal/viewEngine","durandal/activator","jquery","knockout"],function(e,t,i,n,a,r,o){function c(e){for(var t=[],i={childElements:t,activeView:null},n=o.virtualElements.firstChild(e);n;)1==n.nodeType&&(t.push(n),n.getAttribute(A)&&(i.activeView=n)),n=o.virtualElements.nextSibling(n);return i.activeView||(i.activeView=t[0]),i}function u(){V--,0===V&&setTimeout(function(){for(var t=D.length;t--;)try{D[t]()}catch(i){e.error(i)}D=[]},1)}function l(e){delete e.activeView,delete e.viewElements}function s(t,i,n){if(n)i();else if(t.activate&&t.model&&t.model.activate){var a;try{a=e.isArray(t.activationData)?t.model.activate.apply(t.model,t.activationData):t.model.activate(t.activationData),a&&a.then?a.then(i,function(t){e.error(t),i()}):a||void 0===a?i():(u(),l(t))}catch(r){e.error(r)}}else i()}function d(){var t=this;if(t.activeView&&t.activeView.removeAttribute(A),t.child)try{t.model&&t.model.attached&&(t.composingNewView||t.alwaysTriggerAttach)&&t.model.attached(t.child,t.parent,t),t.attached&&t.attached(t.child,t.parent,t),t.child.setAttribute(A,!0),t.composingNewView&&t.model&&t.model.detached&&o.utils.domNodeDisposal.addDisposeCallback(t.child,function(){try{t.model.detached(t.child,t.parent,t)}catch(i){e.error(i)}})}catch(i){e.error(i)}t.triggerAttach=e.noop}function v(t){if(e.isString(t.transition)){if(t.activeView){if(t.activeView==t.child)return!1;if(!t.child)return!0;if(t.skipTransitionOnSameViewId){var i=t.activeView.getAttribute("data-view"),n=t.child.getAttribute("data-view");return i!=n}}return!0}return!1}function f(e){for(var t=0,i=e.length,n=[];i>t;t++){var a=e[t].cloneNode(!0);n.push(a)}return n}function m(e){var t=f(e.parts),i=b.getParts(t,null,!0),n=b.getParts(e.child);for(var a in i)r(n[a]).replaceWith(i[a])}function g(t){var i,n,a=o.virtualElements.childNodes(t.parent);if(!e.isArray(a)){var r=[];for(i=0,n=a.length;n>i;i++)r[i]=a[i];a=r}for(i=1,n=a.length;n>i;i++)o.removeNode(a[i])}function p(e){o.utils.domData.set(e,E,e.style.display),e.style.display="none"}function h(e){e.style.display=o.utils.domData.get(e,E)}function w(e){var t=e.getAttribute("data-bind");if(!t)return!1;for(var i=0,n=x.length;n>i;i++)if(t.indexOf(x[i])>-1)return!0;return!1}var b,y={},A="data-active-view",D=[],V=0,I="durandal-composition-data",S="data-part",N=["model","view","transition","area","strategy","activationData"],E="durandal-visibility-data",x=["compose:"],O={complete:function(e){D.push(e)}};return b={composeBindings:x,convertTransitionToModuleId:function(e){return"transitions/"+e},defaultTransitionName:null,current:O,addBindingHandler:function(e,t,i){var n,a,r="composition-handler-"+e;t=t||o.bindingHandlers[e],i=i||function(){return void 0},a=o.bindingHandlers[e]={init:function(e,n,a,c,u){if(V>0){var l={trigger:o.observable(null)};b.current.complete(function(){t.init&&t.init(e,n,a,c,u),t.update&&(o.utils.domData.set(e,r,t),l.trigger("trigger"))}),o.utils.domData.set(e,r,l)}else o.utils.domData.set(e,r,t),t.init&&t.init(e,n,a,c,u);return i(e,n,a,c,u)},update:function(e,t,i,n,a){var c=o.utils.domData.get(e,r);return c.update?c.update(e,t,i,n,a):(c.trigger&&c.trigger(),void 0)}};for(n in t)"init"!==n&&"update"!==n&&(a[n]=t[n])},getParts:function(e,t,i){if(t=t||{},!e)return t;void 0===e.length&&(e=[e]);for(var n=0,a=e.length;a>n;n++){var r=e[n];if(r.getAttribute){if(!i&&w(r))continue;var o=r.getAttribute(S);o&&(t[o]=r),!i&&r.hasChildNodes()&&b.getParts(r.childNodes,t)}}return t},cloneNodes:f,finalize:function(t){if(void 0===t.transition&&(t.transition=this.defaultTransitionName),t.child||t.activeView)if(v(t)){var n=this.convertTransitionToModuleId(t.transition);e.acquire(n).then(function(e){t.transition=e,e(t).then(function(){if(t.cacheViews){if(t.activeView){var e=i.getBindingInstruction(t.activeView);e&&void 0!=e.cacheViews&&!e.cacheViews&&o.removeNode(t.activeView)}}else t.child?g(t):o.virtualElements.emptyNode(t.parent);t.triggerAttach(),u(),l(t)})}).fail(function(t){e.error("Failed to load transition ("+n+"). Details: "+t.message)})}else{if(t.child!=t.activeView){if(t.cacheViews&&t.activeView){var a=i.getBindingInstruction(t.activeView);!a||void 0!=a.cacheViews&&!a.cacheViews?o.removeNode(t.activeView):p(t.activeView)}t.child?(t.cacheViews||g(t),h(t.child)):t.cacheViews||o.virtualElements.emptyNode(t.parent)}t.triggerAttach(),u(),l(t)}else t.cacheViews||o.virtualElements.emptyNode(t.parent),t.triggerAttach(),u(),l(t)},bindAndShow:function(e,t,a){t.child=e,t.composingNewView=t.cacheViews?-1==o.utils.arrayIndexOf(t.viewElements,e):!0,s(t,function(){if(t.binding&&t.binding(t.child,t.parent,t),t.preserveContext&&t.bindingContext)t.composingNewView&&(t.parts&&m(t),p(e),o.virtualElements.prepend(t.parent,e),i.bindContext(t.bindingContext,e,t.model));else if(e){var a=t.model||y,r=o.dataFor(e);if(r!=a){if(!t.composingNewView)return o.removeNode(e),n.createView(e.getAttribute("data-view")).then(function(e){b.bindAndShow(e,t,!0)}),void 0;t.parts&&m(t),p(e),o.virtualElements.prepend(t.parent,e),i.bind(a,e)}}b.finalize(t)},a)},defaultStrategy:function(e){return t.locateViewForObject(e.model,e.area,e.viewElements)},getSettings:function(t){var i,r=t(),c=o.utils.unwrapObservable(r)||{},u=a.isActivator(r);if(e.isString(c))return c=n.isViewUrl(c)?{view:c}:{model:c,activate:!0};if(i=e.getModuleId(c))return c={model:c,activate:!0};!u&&c.model&&(u=a.isActivator(c.model));for(var l in c)c[l]=-1!=o.utils.arrayIndexOf(N,l)?o.utils.unwrapObservable(c[l]):c[l];return u?c.activate=!1:void 0===c.activate&&(c.activate=!0),c},executeStrategy:function(e){e.strategy(e).then(function(t){b.bindAndShow(t,e)})},inject:function(i){return i.model?i.view?(t.locateView(i.view,i.area,i.viewElements).then(function(e){b.bindAndShow(e,i)}),void 0):(i.strategy||(i.strategy=this.defaultStrategy),e.isString(i.strategy)?e.acquire(i.strategy).then(function(e){i.strategy=e,b.executeStrategy(i)}).fail(function(t){e.error("Failed to load view strategy ("+i.strategy+"). Details: "+t.message)}):this.executeStrategy(i),void 0):(this.bindAndShow(null,i),void 0)},compose:function(i,n,a,r){V++,r||(n=b.getSettings(function(){return n},i)),n.compositionComplete&&D.push(function(){n.compositionComplete(n.child,n.parent,n)}),D.push(function(){n.composingNewView&&n.model&&n.model.compositionComplete&&n.model.compositionComplete(n.child,n.parent,n)});var o=c(i);n.activeView=o.activeView,n.parent=i,n.triggerAttach=d,n.bindingContext=a,n.cacheViews&&!n.viewElements&&(n.viewElements=o.childElements),n.model?e.isString(n.model)?e.acquire(n.model).then(function(t){n.model=e.resolveObject(t),b.inject(n)}).fail(function(t){e.error("Failed to load composed module ("+n.model+"). Details: "+t.message)}):b.inject(n):n.view?(n.area=n.area||"partial",n.preserveContext=!0,t.locateView(n.view,n.area,n.viewElements).then(function(e){b.bindAndShow(e,n)})):this.bindAndShow(null,n)}},o.bindingHandlers.compose={init:function(){return{controlsDescendantBindings:!0}},update:function(e,t,i,a,r){var c=b.getSettings(t,e);if(c.mode){var u=o.utils.domData.get(e,I);if(!u){var l=o.virtualElements.childNodes(e);u={},"inline"===c.mode?u.view=n.ensureSingleElement(l):"templated"===c.mode&&(u.parts=f(l)),o.virtualElements.emptyNode(e),o.utils.domData.set(e,I,u)}"inline"===c.mode?c.view=u.view.cloneNode(!0):"templated"===c.mode&&(c.parts=u.parts),c.preserveContext=!0}b.compose(e,c,r,!0)}},o.virtualElements.allowedBindings.compose=!0,b});
define('durandal/events',["durandal/system"],function(e){var t=/\s+/,i=function(){},n=function(e,t){this.owner=e,this.events=t};return n.prototype.then=function(e,t){return this.callback=e||this.callback,this.context=t||this.context,this.callback?(this.owner.on(this.events,this.callback,this.context),this):this},n.prototype.on=n.prototype.then,n.prototype.off=function(){return this.owner.off(this.events,this.callback,this.context),this},i.prototype.on=function(e,i,r){var a,o,c;if(i){for(a=this.callbacks||(this.callbacks={}),e=e.split(t);o=e.shift();)c=a[o]||(a[o]=[]),c.push(i,r);return this}return new n(this,e)},i.prototype.off=function(i,n,r){var a,o,c,s;if(!(o=this.callbacks))return this;if(!(i||n||r))return delete this.callbacks,this;for(i=i?i.split(t):e.keys(o);a=i.shift();)if((c=o[a])&&(n||r))for(s=c.length-2;s>=0;s-=2)n&&c[s]!==n||r&&c[s+1]!==r||c.splice(s,2);else delete o[a];return this},i.prototype.trigger=function(e){var i,n,r,a,o,c,s,l;if(!(n=this.callbacks))return this;for(l=[],e=e.split(t),a=1,o=arguments.length;o>a;a++)l[a-1]=arguments[a];for(;i=e.shift();){if((s=n.all)&&(s=s.slice()),(r=n[i])&&(r=r.slice()),r)for(a=0,o=r.length;o>a;a+=2)r[a].apply(r[a+1]||this,l);if(s)for(c=[i].concat(l),a=0,o=s.length;o>a;a+=2)s[a].apply(s[a+1]||this,c)}return this},i.prototype.proxy=function(e){var t=this;return function(i){t.trigger(e,i)}},i.includeIn=function(e){e.on=i.prototype.on,e.off=i.prototype.off,e.trigger=i.prototype.trigger,e.proxy=i.prototype.proxy},i});
define('durandal/app',["durandal/system","durandal/viewEngine","durandal/composition","durandal/events","jquery"],function(e,t,n,i,a){function r(){return e.defer(function(t){return 0==c.length?(t.resolve(),void 0):(e.acquire(c).then(function(n){for(var i=0;i<n.length;i++){var a=n[i];if(a.install){var r=u[i];e.isObject(r)||(r={}),a.install(r),e.log("Plugin:Installed "+c[i])}else e.log("Plugin:Loaded "+c[i])}t.resolve()}).fail(function(t){e.error("Failed to load plugin(s). Details: "+t.message)}),void 0)}).promise()}var o,c=[],u=[];return o={title:"Application",configurePlugins:function(t,n){var i=e.keys(t);n=n||"plugins/",-1===n.indexOf("/",n.length-1)&&(n+="/");for(var a=0;a<i.length;a++){var r=i[a];c.push(n+r),u.push(t[r])}},start:function(){return e.log("Application:Starting"),this.title&&(document.title=this.title),e.defer(function(t){a(function(){r().then(function(){t.resolve(),e.log("Application:Started")})})}).promise()},setRoot:function(i,a,r){var o,c={activate:!0,transition:a};o=!r||e.isString(r)?document.getElementById(r||"applicationHost"):r,e.isString(i)?t.isViewUrl(i)?c.view=i:c.model=i:c.model=i,n.compose(o,c)}},i.includeIn(o),o});
requirejs.config({paths:{text:"../Scripts/text",durandal:"../Scripts/durandal",plugins:"../Scripts/durandal/plugins",transitions:"../Scripts/durandal/transitions"}}),define("jquery",[],function(){return jQuery}),define("knockout",ko),define("lodash",_),define('main',["durandal/app","durandal/system","durandal/viewLocator"],function(n,t,e){t.debug(!0),n.title="Durandal TGD",n.configurePlugins({router:!0,dialog:!0,widget:!0}),n.start().then(function(){e.useConvention(),n.setRoot("viewmodels/shell")})});
define('viewmodels/about',["durandal/system","durandal/app"],function(e,n){var t=function(){var t=this;t.activate=function(){return e.defer(function(e){setTimeout(e.resolve,1e3)}).promise()},t.canDeactivate=function(){return n.showMessage("Are you sure you want to leave this page?","Navigate",["Yes","No"])}};return t});
define('viewmodels/home',{elements:["Lorem ipsum","Tgd","Test"]});
define('plugins/history',["durandal/system","jquery"],function(e,t){function i(e,t,i){if(i){var n=e.href.replace(/(javascript:|#).*$/,"");e.replace(n+"#"+t)}else e.hash="#"+t}var n=/^[#\/]|\s+$/g,a=/^\/+|\/+$/g,r=/msie [\w.]+/,o=/\/$/,s={interval:50,active:!1};return"undefined"!=typeof window&&(s.location=window.location,s.history=window.history),s.getHash=function(e){var t=(e||s).location.href.match(/#(.*)$/);return t?t[1]:""},s.getFragment=function(e,t){if(null==e)if(s._hasPushState||!s._wantsHashChange||t){e=s.location.pathname+s.location.search;var i=s.root.replace(o,"");e.indexOf(i)||(e=e.substr(i.length))}else e=s.getHash();return e.replace(n,"")},s.activate=function(i){s.active&&e.error("History has already been activated."),s.active=!0,s.options=e.extend({},{root:"/"},s.options,i),s.root=s.options.root,s._wantsHashChange=s.options.hashChange!==!1,s._wantsPushState=!!s.options.pushState,s._hasPushState=!!(s.options.pushState&&s.history&&s.history.pushState);var o=s.getFragment(),c=document.documentMode,l=r.exec(navigator.userAgent.toLowerCase())&&(!c||7>=c);s.root=("/"+s.root+"/").replace(a,"/"),l&&s._wantsHashChange&&(s.iframe=t('<iframe src="javascript:0" tabindex="-1" />').hide().appendTo("body")[0].contentWindow,s.navigate(o,!1)),s._hasPushState?t(window).on("popstate",s.checkUrl):s._wantsHashChange&&"onhashchange"in window&&!l?t(window).on("hashchange",s.checkUrl):s._wantsHashChange&&(s._checkUrlInterval=setInterval(s.checkUrl,s.interval)),s.fragment=o;var u=s.location,d=u.pathname.replace(/[^\/]$/,"$&/")===s.root;if(s._wantsHashChange&&s._wantsPushState){if(!s._hasPushState&&!d)return s.fragment=s.getFragment(null,!0),s.location.replace(s.root+s.location.search+"#"+s.fragment),!0;s._hasPushState&&d&&u.hash&&(this.fragment=s.getHash().replace(n,""),this.history.replaceState({},document.title,s.root+s.fragment+u.search))}return s.options.silent?void 0:s.loadUrl()},s.deactivate=function(){t(window).off("popstate",s.checkUrl).off("hashchange",s.checkUrl),clearInterval(s._checkUrlInterval),s.active=!1},s.checkUrl=function(){var e=s.getFragment();return e===s.fragment&&s.iframe&&(e=s.getFragment(s.getHash(s.iframe))),e===s.fragment?!1:(s.iframe&&s.navigate(e,!1),s.loadUrl(),void 0)},s.loadUrl=function(e){var t=s.fragment=s.getFragment(e);return s.options.routeHandler?s.options.routeHandler(t):!1},s.navigate=function(t,n){if(!s.active)return!1;if(void 0===n?n={trigger:!0}:e.isBoolean(n)&&(n={trigger:n}),t=s.getFragment(t||""),s.fragment!==t){s.fragment=t;var a=s.root+t;if(""===t&&"/"!==a&&(a=a.slice(0,-1)),s._hasPushState)s.history[n.replace?"replaceState":"pushState"]({},document.title,a);else{if(!s._wantsHashChange)return s.location.assign(a);i(s.location,t,n.replace),s.iframe&&t!==s.getFragment(s.getHash(s.iframe))&&(n.replace||s.iframe.document.open().close(),i(s.iframe.location,t,n.replace))}return n.trigger?s.loadUrl(t):void 0}},s.navigateBack=function(){s.history.back()},s});
define('plugins/router',["durandal/system","durandal/app","durandal/activator","durandal/events","durandal/composition","plugins/history","knockout","jquery"],function(e,t,n,i,r,a,o,c){function s(e){return e=e.replace(m,"\\$&").replace(g,"(?:$1)?").replace(p,function(e,t){return t?e:"([^/]+)"}).replace(h,"(.*?)"),new RegExp("^"+e+"$")}function u(e){var t=e.indexOf(":"),n=t>0?t-1:e.length;return e.substring(0,n)}function l(e,t){return-1!==e.indexOf(t,e.length-t.length)}function d(e,t){if(!e||!t)return!1;if(e.length!=t.length)return!1;for(var n=0,i=e.length;i>n;n++)if(e[n]!=t[n])return!1;return!0}var f,v,g=/\((.*?)\)/g,p=/(\(\?)?:\w+/g,h=/\*\w+/g,m=/[\-{}\[\]+?.,\\\^$|#\s]/g,y=/\/$/,b=function(){function r(e){return e.router&&e.router.parent==B}function c(e){O&&O.config.isActive&&O.config.isActive(e)}function g(t,n){e.log("Navigation Complete",t,n);var i=e.getModuleId(C);i&&B.trigger("router:navigation:from:"+i),C=t,c(!1),O=n,c(!0);var a=e.getModuleId(C);a&&B.trigger("router:navigation:to:"+a),r(t)||B.updateDocumentTitle(t,n),v.explicitNavigation=!1,v.navigatingBack=!1,B.trigger("router:navigation:complete",t,n,B)}function p(t,n){e.log("Navigation Cancelled"),B.activeInstruction(O),O&&B.navigate(O.fragment,!1),N(!1),v.explicitNavigation=!1,v.navigatingBack=!1,B.trigger("router:navigation:cancelled",t,n,B)}function h(t){e.log("Navigation Redirecting"),N(!1),v.explicitNavigation=!1,v.navigatingBack=!1,B.navigate(t,{trigger:!0,replace:!0})}function m(t,n,i){v.navigatingBack=!v.explicitNavigation&&C!=i.fragment,B.trigger("router:route:activating",n,i,B),t.activateItem(n,i.params).then(function(e){if(e){var a=C;if(g(n,i),r(n)){var o=i.fragment;i.queryString&&(o+="?"+i.queryString),n.router.loadUrl(o)}a==n&&(B.attached(),B.compositionComplete())}else t.settings.lifecycleData&&t.settings.lifecycleData.redirect?h(t.settings.lifecycleData.redirect):p(n,i);f&&(f.resolve(),f=null)}).fail(function(t){e.error(t)})}function w(t,n,i){var r=B.guardRoute(n,i);r?r.then?r.then(function(r){r?e.isString(r)?h(r):m(t,n,i):p(n,i)}):e.isString(r)?h(r):m(t,n,i):p(n,i)}function _(e,t,n){B.guardRoute?w(e,t,n):m(e,t,n)}function x(e){return O&&O.config.moduleId==e.config.moduleId&&C&&(C.canReuseForRoute&&C.canReuseForRoute.apply(C,e.params)||!C.canReuseForRoute&&C.router&&C.router.loadUrl)}function I(){if(!N()){var t=V.shift();V=[],t&&(N(!0),B.activeInstruction(t),x(t)?_(n.create(),C,t):e.acquire(t.config.moduleId).then(function(n){var i=e.resolveObject(n);_(T,i,t)}).fail(function(n){e.error("Failed to load routed module ("+t.config.moduleId+"). Details: "+n.message)}))}}function A(e){V.unshift(e),I()}function S(e,t,n){for(var i=e.exec(t).slice(1),r=0;r<i.length;r++){var a=i[r];i[r]=a?decodeURIComponent(a):null}var o=B.parseQueryString(n);return o&&i.push(o),{params:i,queryParams:o}}function k(t){B.trigger("router:route:before-config",t,B),e.isRegExp(t)?t.routePattern=t.route:(t.title=t.title||B.convertRouteToTitle(t.route),t.moduleId=t.moduleId||B.convertRouteToModuleId(t.route),t.hash=t.hash||B.convertRouteToHash(t.route),t.routePattern=s(t.route)),t.isActive=t.isActive||o.observable(!1),B.trigger("router:route:after-config",t,B),B.routes.push(t),B.route(t.routePattern,function(e,n){var i=S(t.routePattern,e,n);A({fragment:e,queryString:n,config:t,params:i.params,queryParams:i.queryParams})})}function D(t){if(e.isArray(t.route))for(var n=t.isActive||o.observable(!1),i=0,r=t.route.length;r>i;i++){var a=e.extend({},t);a.route=t.route[i],a.isActive=n,i>0&&delete a.nav,k(a)}else k(t);return B}var C,O,V=[],N=o.observable(!1),T=n.create(),B={handlers:[],routes:[],navigationModel:o.observableArray([]),activeItem:T,isNavigating:o.computed(function(){var e=T(),t=N(),n=e&&e.router&&e.router!=B&&e.router.isNavigating()?!0:!1;return t||n}),activeInstruction:o.observable(null),__router__:!0};return i.includeIn(B),T.settings.areSameItem=function(e,t,n,i){return e==t?d(n,i):!1},B.parseQueryString=function(e){var t,n;if(!e)return null;if(n=e.split("&"),0==n.length)return null;t={};for(var i=0;i<n.length;i++){var r=n[i];if(""!==r){var a=r.split("=");t[a[0]]=a[1]&&decodeURIComponent(a[1].replace(/\+/g," "))}}return t},B.route=function(e,t){B.handlers.push({routePattern:e,callback:t})},B.loadUrl=function(t){var n=B.handlers,i=null,r=t,o=t.indexOf("?");if(-1!=o&&(r=t.substring(0,o),i=t.substr(o+1)),B.relativeToParentRouter){var c=this.parent.activeInstruction();r=c.params.join("/"),r&&"/"==r.charAt(0)&&(r=r.substr(1)),r||(r=""),r=r.replace("//","/").replace("//","/")}r=r.replace(y,"");for(var s=0;s<n.length;s++){var u=n[s];if(u.routePattern.test(r))return u.callback(r,i),!0}return e.log("Route Not Found"),B.trigger("router:route:not-found",t,B),O&&a.navigate(O.fragment,{trigger:!1,replace:!0}),v.explicitNavigation=!1,v.navigatingBack=!1,!1},B.updateDocumentTitle=function(e,n){n.config.title?document.title=t.title?n.config.title+" | "+t.title:n.config.title:t.title&&(document.title=t.title)},B.navigate=function(e,t){return e&&-1!=e.indexOf("://")?(window.location.href=e,!0):(v.explicitNavigation=!0,a.navigate(e,t))},B.navigateBack=function(){a.navigateBack()},B.attached=function(){B.trigger("router:navigation:attached",C,O,B)},B.compositionComplete=function(){N(!1),B.trigger("router:navigation:composition-complete",C,O,B),I()},B.convertRouteToHash=function(e){if(B.relativeToParentRouter){var t=B.parent.activeInstruction(),n=t.config.hash+"/"+e;return a._hasPushState&&(n="/"+n),n=n.replace("//","/").replace("//","/")}return a._hasPushState?e:"#"+e},B.convertRouteToModuleId=function(e){return u(e)},B.convertRouteToTitle=function(e){var t=u(e);return t.substring(0,1).toUpperCase()+t.substring(1)},B.map=function(t,n){if(e.isArray(t)){for(var i=0;i<t.length;i++)B.map(t[i]);return B}return e.isString(t)||e.isRegExp(t)?(n?e.isString(n)&&(n={moduleId:n}):n={},n.route=t):n=t,D(n)},B.buildNavigationModel=function(t){for(var n=[],i=B.routes,r=t||100,a=0;a<i.length;a++){var o=i[a];o.nav&&(e.isNumber(o.nav)||(o.nav=++r),n.push(o))}return n.sort(function(e,t){return e.nav-t.nav}),B.navigationModel(n),B},B.mapUnknownRoutes=function(t,n){var i="*catchall",r=s(i);return B.route(r,function(o,c){var s=S(r,o,c),u={fragment:o,queryString:c,config:{route:i,routePattern:r},params:s.params,queryParams:s.queryParams};if(t)if(e.isString(t))u.config.moduleId=t,n&&a.navigate(n,{trigger:!1,replace:!0});else if(e.isFunction(t)){var l=t(u);if(l&&l.then)return l.then(function(){B.trigger("router:route:before-config",u.config,B),B.trigger("router:route:after-config",u.config,B),A(u)}),void 0}else u.config=t,u.config.route=i,u.config.routePattern=r;else u.config.moduleId=o;B.trigger("router:route:before-config",u.config,B),B.trigger("router:route:after-config",u.config,B),A(u)}),B},B.reset=function(){return O=C=void 0,B.handlers=[],B.routes=[],B.off(),delete B.options,B},B.makeRelative=function(t){return e.isString(t)&&(t={moduleId:t,route:t}),t.moduleId&&!l(t.moduleId,"/")&&(t.moduleId+="/"),t.route&&!l(t.route,"/")&&(t.route+="/"),t.fromParent&&(B.relativeToParentRouter=!0),B.on("router:route:before-config").then(function(e){t.moduleId&&(e.moduleId=t.moduleId+e.moduleId),t.route&&(e.route=""===e.route?t.route.substring(0,t.route.length-1):t.route+e.route)}),B},B.createChildRouter=function(){var e=b();return e.parent=B,e},B};return v=b(),v.explicitNavigation=!1,v.navigatingBack=!1,v.targetIsThisWindow=function(e){var t=c(e.target).attr("target");return!t||t===window.name||"_self"===t||"top"===t&&window===window.top?!0:!1},v.activate=function(t){return e.defer(function(n){if(f=n,v.options=e.extend({routeHandler:v.loadUrl},v.options,t),a.activate(v.options),a._hasPushState)for(var i=v.routes,r=i.length;r--;){var o=i[r];o.hash=o.hash.replace("#","")}c(document).delegate("a","click",function(e){if(a._hasPushState){if(!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&v.targetIsThisWindow(e)){var t=c(this).attr("href");null==t||"#"===t.charAt(0)||/^[a-z]+:/i.test(t)||(v.explicitNavigation=!0,e.preventDefault(),a.navigate(t))}}else v.explicitNavigation=!0}),a.options.silent&&f&&(f.resolve(),f=null)}).promise()},v.deactivate=function(){a.deactivate()},v.install=function(){o.bindingHandlers.router={init:function(){return{controlsDescendantBindings:!0}},update:function(e,t,n,i,a){var c=o.utils.unwrapObservable(t())||{};if(c.__router__)c={model:c.activeItem(),attached:c.attached,compositionComplete:c.compositionComplete,activate:!1};else{var s=o.utils.unwrapObservable(c.router||i.router)||v;c.model=s.activeItem(),c.attached=s.attached,c.compositionComplete=s.compositionComplete,c.activate=!1}r.compose(e,c,a)}},o.virtualElements.allowedBindings.router=!0},v});
define('viewmodels/shell',["durandal/app","plugins/router"],function(e,t){return{router:t,activeTitle:ko.computed(function(){var e=_.find(t.navigationModel(),function(e){return e.isActive()});return e?e.title:""}),activate:function(){return t.map([{route:"",moduleId:"viewmodels/home",title:"Home",nav:!0},{route:"about",moduleId:"viewmodels/about",title:"About",nav:!0}]).buildNavigationModel(),t.activate()}}});
define('text',{load: function(id){throw new Error("Dynamic load not allowed: " + id);}});
define('text!views/about.html',[],function () { return '<div>\r\n    <h3>About</h3>\r\n    <p>\r\n        Lorem ipsum\r\n    </p>\r\n</div>';});

define('text!views/home.html',[],function () { return '<div>\r\n    <h3>Home</h3>\r\n    <ul class="list-group" data-bind="foreach: elements">\r\n        <li class="list-group-item" data-bind="text: $data"></li>\r\n    </ul>\r\n</div>';});

define('text!views/shell.html',[],function () { return '<div>\r\n    <h2 data-bind="text: activeTitle"></h2>\r\n    <ul class="nav nav-pills" data-bind="foreach: router.navigationModel">\r\n        <li data-bind="css: { active: isActive }">\r\n            <a data-bind="attr: { href: hash }, html: title"></a>\r\n        </li>\r\n    </ul>\r\n    <div class="pull-right" data-bind="if: router.isNavigating">\r\n                <span class="glyphicon glyphicon-time"></span> Loading view... \r\n            </div>\r\n    <div data-bind="router: { transition: \'entrance\' }"></div>\r\n</div>';});

define('plugins/dialog',["durandal/system","durandal/app","durandal/composition","durandal/activator","durandal/viewEngine","jquery","knockout"],function(t,e,i,n,o,a,r){function s(e){return t.defer(function(i){t.isString(e)?t.acquire(e).then(function(e){i.resolve(t.resolveObject(e))}).fail(function(i){t.error("Failed to load dialog module ("+e+"). Details: "+i.message)}):i.resolve(e)}).promise()}var c,l={},u=0,d=function(t,e,i){this.message=t,this.title=e||d.defaultTitle,this.options=i||d.defaultOptions};return d.prototype.selectOption=function(t){c.close(this,t)},d.prototype.getView=function(){return o.processMarkup(d.defaultViewMarkup)},d.setViewUrl=function(t){delete d.prototype.getView,d.prototype.viewUrl=t},d.defaultTitle=e.title||"Application",d.defaultOptions=["Ok"],d.defaultViewMarkup=['<div data-view="plugins/messageBox" class="messageBox">','<div class="modal-header">','<h3 data-bind="text: title"></h3>',"</div>",'<div class="modal-body">','<p class="message" data-bind="text: message"></p>',"</div>",'<div class="modal-footer" data-bind="foreach: options">','<button class="btn" data-bind="click: function () { $parent.selectOption($data); }, text: $data, css: { \'btn-primary\': $index() == 0, autofocus: $index() == 0 }"></button>',"</div>","</div>"].join("\n"),c={MessageBox:d,currentZIndex:1050,getNextZIndex:function(){return++this.currentZIndex},isOpen:function(){return u>0},getContext:function(t){return l[t||"default"]},addContext:function(t,e){e.name=t,l[t]=e;var i="show"+t.substr(0,1).toUpperCase()+t.substr(1);this[i]=function(e,i){return this.show(e,i,t)}},createCompositionSettings:function(t,e){var i={model:t,activate:!1,transition:!1};return e.attached&&(i.attached=e.attached),e.compositionComplete&&(i.compositionComplete=e.compositionComplete),i},getDialog:function(t){return t?t.__dialog__:void 0},close:function(t){var e=this.getDialog(t);if(e){var i=Array.prototype.slice.call(arguments,1);e.close.apply(e,i)}},show:function(e,o,a){var r=this,c=l[a||"default"];return t.defer(function(t){s(e).then(function(e){var a=n.create();a.activateItem(e,o).then(function(n){if(n){var o=e.__dialog__={owner:e,context:c,activator:a,close:function(){var i=arguments;a.deactivateItem(e,!0).then(function(n){n&&(u--,c.removeHost(o),delete e.__dialog__,0===i.length?t.resolve():1===i.length?t.resolve(i[0]):t.resolve.apply(t,i))})}};o.settings=r.createCompositionSettings(e,c),c.addHost(o),u++,i.compose(o.host,o.settings)}else t.resolve(!1)})})}).promise()},showMessage:function(e,i,n){return t.isString(this.MessageBox)?c.show(this.MessageBox,[e,i||d.defaultTitle,n||d.defaultOptions]):c.show(new this.MessageBox(e,i,n))},install:function(t){e.showDialog=function(t,e,i){return c.show(t,e,i)},e.showMessage=function(t,e,i){return c.showMessage(t,e,i)},t.messageBox&&(c.MessageBox=t.messageBox),t.messageBoxView&&(c.MessageBox.prototype.getView=function(){return t.messageBoxView})}},c.addContext("default",{blockoutOpacity:.2,removeDelay:200,addHost:function(t){var e=a("body"),i=a('<div class="modalBlockout"></div>').css({"z-index":c.getNextZIndex(),opacity:this.blockoutOpacity}).appendTo(e),n=a('<div class="modalHost"></div>').css({"z-index":c.getNextZIndex()}).appendTo(e);if(t.host=n.get(0),t.blockout=i.get(0),!c.isOpen()){t.oldBodyMarginRight=e.css("margin-right"),t.oldInlineMarginRight=e.get(0).style.marginRight;var o=a("html"),r=e.outerWidth(!0),s=o.scrollTop();a("html").css("overflow-y","hidden");var l=a("body").outerWidth(!0);e.css("margin-right",l-r+parseInt(t.oldBodyMarginRight,10)+"px"),o.scrollTop(s)}},removeHost:function(t){if(a(t.host).css("opacity",0),a(t.blockout).css("opacity",0),setTimeout(function(){r.removeNode(t.host),r.removeNode(t.blockout)},this.removeDelay),!c.isOpen()){var e=a("html"),i=e.scrollTop();e.css("overflow-y","").scrollTop(i),t.oldInlineMarginRight?a("body").css("margin-right",t.oldBodyMarginRight):a("body").css("margin-right","")}},attached:function(t){a(t).css("visibility","hidden")},compositionComplete:function(t,e,i){var n=c.getDialog(i.model),o=a(t),r=o.find("img").filter(function(){var t=a(this);return!(this.style.width&&this.style.height||t.attr("width")&&t.attr("height"))});o.data("predefinedWidth",o.get(0).style.width);var s=function(){setTimeout(function(){o.data("predefinedWidth")||o.css({width:""});var t=o.outerWidth(!1),e=o.outerHeight(!1),i=a(window).height(),r=Math.min(e,i);o.css({"margin-top":(-r/2).toString()+"px","margin-left":(-t/2).toString()+"px"}),o.data("predefinedWidth")||o.outerWidth(t),e>i?o.css("overflow-y","auto"):o.css("overflow-y",""),a(n.host).css("opacity",1),o.css("visibility","visible"),o.find(".autofocus").first().focus()},1)};s(),r.load(s),o.hasClass("autoclose")&&a(n.blockout).click(function(){n.close()})}}),c});
define('plugins/http',["jquery","knockout"],function(t,e){return{callbackParam:"callback",get:function(e,i){return t.ajax(e,{data:i})},jsonp:function(e,i,n){return-1==e.indexOf("=?")&&(n=n||this.callbackParam,e+=-1==e.indexOf("?")?"?":"&",e+=n+"=?"),t.ajax({url:e,dataType:"jsonp",data:i})},post:function(i,n){return t.ajax({url:i,data:e.toJSON(n),type:"POST",contentType:"application/json",dataType:"json"})}}});
define('plugins/observable',["durandal/system","durandal/binder","knockout"],function(e,t,n){function i(e){var t=e[0];return"_"===t||"$"===t}function a(t){return!(!t||void 0===t.nodeType||!e.isNumber(t.nodeType))}function r(e){if(!e||a(e)||e.ko===n||e.jquery)return!1;var t=f.call(e);return-1==v.indexOf(t)&&!(e===!0||e===!1)}function o(e,t){var n=e.__observable__,i=!0;if(!n||!n.__full__){n=n||(e.__observable__={}),n.__full__=!0,p.forEach(function(n){e[n]=function(){i=!1;var e=y[n].apply(t,arguments);return i=!0,e}}),h.forEach(function(n){e[n]=function(){i&&t.valueWillMutate();var a=m[n].apply(e,arguments);return i&&t.valueHasMutated(),a}}),g.forEach(function(n){e[n]=function(){for(var a=0,r=arguments.length;r>a;a++)s(arguments[a]);i&&t.valueWillMutate();var o=m[n].apply(e,arguments);return i&&t.valueHasMutated(),o}}),e.splice=function(){for(var n=2,a=arguments.length;a>n;n++)s(arguments[n]);i&&t.valueWillMutate();var r=m.splice.apply(e,arguments);return i&&t.valueHasMutated(),r};for(var a=0,r=e.length;r>a;a++)s(e[a])}}function s(t){var a,s;if(r(t)&&(a=t.__observable__,!a||!a.__full__)){if(a=a||(t.__observable__={}),a.__full__=!0,e.isArray(t)){var c=n.observableArray(t);o(t,c)}else for(var u in t)i(u)||a[u]||(s=t[u],e.isFunction(s)||l(t,u,s));b&&e.log("Converted",t)}}function c(e,t,n){var i;e(t),i=e.peek(),n?i?i.destroyAll||o(i,e):(i=[],e(i),o(i,e)):s(i)}function l(t,i,a){var r,l,u=t.__observable__||(t.__observable__={});if(void 0===a&&(a=t[i]),e.isArray(a))r=n.observableArray(a),o(a,r),l=!0;else if("function"==typeof a){if(!n.isObservable(a))return null;r=a}else e.isPromise(a)?(r=n.observable(),a.then(function(t){if(e.isArray(t)){var i=n.observableArray(t);o(t,i),t=i}r(t)})):(r=n.observable(a),s(a));return Object.defineProperty(t,i,{configurable:!0,enumerable:!0,get:r,set:n.isWriteableObservable(r)?function(t){t&&e.isPromise(t)?t.then(function(t){c(r,t,e.isArray(t))}):c(r,t,l)}:void 0}),u[i]=r,r}function u(t,i,a){var r,o={owner:t,deferEvaluation:!0};return"function"==typeof a?o.read=a:("value"in a&&e.error('For defineProperty, you must not specify a "value" for the property. You must provide a "get" function.'),"function"!=typeof a.get&&e.error('For defineProperty, the third parameter must be either an evaluator function, or an options object containing a function called "get".'),o.read=a.get,o.write=a.set),r=n.computed(o),t[i]=r,l(t,i,r)}var d,f=Object.prototype.toString,v=["[object Function]","[object String]","[object Boolean]","[object Number]","[object Date]","[object RegExp]"],p=["remove","removeAll","destroy","destroyAll","replace"],h=["pop","reverse","sort","shift","splice"],g=["push","unshift"],m=Array.prototype,y=n.observableArray.fn,b=!1;return d=function(e,t){var i,a,r;return e?(i=e.__observable__,i&&(a=i[t])?a:(r=e[t],n.isObservable(r)?r:l(e,t,r))):null},d.defineProperty=u,d.convertProperty=l,d.convertObject=s,d.install=function(e){var n=t.binding;t.binding=function(e,t,i){i.applyBindings&&!i.skipConversion&&s(e),n(e,t)},b=e.logConversion},d});
define('plugins/serializer',["durandal/system"],function(e){return{typeAttribute:"type",space:void 0,replacer:function(e,t){if(e){var n=e[0];if("_"===n||"$"===n)return void 0}return t},serialize:function(t,n){return n=void 0===n?{}:n,(e.isString(n)||e.isNumber(n))&&(n={space:n}),JSON.stringify(t,n.replacer||this.replacer,n.space||this.space)},getTypeId:function(e){return e?e[this.typeAttribute]:void 0},typeMap:{},registerType:function(){var t=arguments[0];if(1==arguments.length){var n=t[this.typeAttribute]||e.getModuleId(t);this.typeMap[n]=t}else this.typeMap[t]=arguments[1]},reviver:function(e,t,n,i){var r=n(t);if(r){var a=i(r);if(a)return a.fromJSON?a.fromJSON(t):new a(t)}return t},deserialize:function(e,t){var n=this;t=t||{};var i=t.getTypeId||function(e){return n.getTypeId(e)},r=t.getConstructor||function(e){return n.typeMap[e]},a=t.reviver||function(e,t){return n.reviver(e,t,i,r)};return JSON.parse(e,a)}}});
define('plugins/widget',["durandal/system","durandal/composition","jquery","knockout"],function(e,t,n,i){function r(e,n){var r=i.utils.domData.get(e,c);r||(r={parts:t.cloneNodes(i.virtualElements.childNodes(e))},i.virtualElements.emptyNode(e),i.utils.domData.set(e,c,r)),n.parts=r.parts}var a={},o={},s=["model","view","kind"],c="durandal-widget-data",u={getSettings:function(t){var n=i.utils.unwrapObservable(t())||{};if(e.isString(n))return{kind:n};for(var r in n)n[r]=-1!=i.utils.arrayIndexOf(s,r)?i.utils.unwrapObservable(n[r]):n[r];return n},registerKind:function(e){i.bindingHandlers[e]={init:function(){return{controlsDescendantBindings:!0}},update:function(t,n,i,a,o){var s=u.getSettings(n);s.kind=e,r(t,s),u.create(t,s,o,!0)}},i.virtualElements.allowedBindings[e]=!0,t.composeBindings.push(e+":")},mapKind:function(e,t,n){t&&(o[e]=t),n&&(a[e]=n)},mapKindToModuleId:function(e){return a[e]||u.convertKindToModulePath(e)},convertKindToModulePath:function(e){return"widgets/"+e+"/viewmodel"},mapKindToViewId:function(e){return o[e]||u.convertKindToViewPath(e)},convertKindToViewPath:function(e){return"widgets/"+e+"/view"},createCompositionSettings:function(e,t){return t.model||(t.model=this.mapKindToModuleId(t.kind)),t.view||(t.view=this.mapKindToViewId(t.kind)),t.preserveContext=!0,t.activate=!0,t.activationData=t,t.mode="templated",t},create:function(e,n,i,r){r||(n=u.getSettings(function(){return n},e));var a=u.createCompositionSettings(e,n);t.compose(e,a,i)},install:function(e){if(e.bindingName=e.bindingName||"widget",e.kinds)for(var n=e.kinds,a=0;a<n.length;a++)u.registerKind(n[a]);i.bindingHandlers[e.bindingName]={init:function(){return{controlsDescendantBindings:!0}},update:function(e,t,n,i,a){var o=u.getSettings(t);r(e,o),u.create(e,o,a,!0)}},t.composeBindings.push(e.bindingName+":"),i.virtualElements.allowedBindings[e.bindingName]=!0}};return u});
define('transitions/entrance',["durandal/system","durandal/composition","jquery"],function(e,t,n){var i=100,r={marginRight:0,marginLeft:0,opacity:1},o={marginLeft:"",marginRight:"",opacity:"",display:""},a=function(t){return e.defer(function(e){function a(){e.resolve()}function c(){t.keepScrollPosition||n(document).scrollTop(0)}function u(){c(),t.triggerAttach();var e={marginLeft:l?"0":"20px",marginRight:l?"0":"-20px",opacity:0,display:"block"},i=n(t.child);i.css(e),i.animate(r,{duration:s,easing:"swing",always:function(){i.css(o),a()}})}if(t.child){var s=t.duration||500,l=!!t.fadeOnly;t.activeView?n(t.activeView).fadeOut({duration:i,always:u}):u()}else n(t.activeView).fadeOut(i,a)}).promise()};return a});
require(["main"]);
}());