(function () {/**
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

define('durandal/system',["require","jquery"],function(e,t){function n(e){var t="[object "+e+"]";i["is"+e]=function(e){return u.call(e)==t}}var i,r=!1,o=Object.keys,a=Object.prototype.hasOwnProperty,u=Object.prototype.toString,s=!1,c=Array.isArray,l=Array.prototype.slice;if(Function.prototype.bind&&("object"==typeof console||"function"==typeof console)&&"object"==typeof console.log)try{["log","info","warn","error","assert","dir","clear","profile","profileEnd"].forEach(function(e){console[e]=this.call(console[e],console)},Function.prototype.bind)}catch(d){s=!0}e.on&&e.on("moduleLoaded",function(e,t){i.setModuleId(e,t)}),"undefined"!=typeof requirejs&&(requirejs.onResourceLoad=function(e,t){i.setModuleId(e.defined[t.id],t.id)});var f=function(){},v=function(){try{if("undefined"!=typeof console&&"function"==typeof console.log)if(window.opera)for(var e=0;e<arguments.length;)console.log("Item "+(e+1)+": "+arguments[e]),e++;else 1==l.call(arguments).length&&"string"==typeof l.call(arguments)[0]?console.log(l.call(arguments).toString()):console.log.apply(console,l.call(arguments));else Function.prototype.bind&&!s||"undefined"==typeof console||"object"!=typeof console.log||Function.prototype.call.call(console.log,console,l.call(arguments))}catch(t){}},g=function(e){if(e instanceof Error)throw e;throw new Error(e)};i={version:"2.0.1",noop:f,getModuleId:function(e){return e?"function"==typeof e?e.prototype.__moduleId__:"string"==typeof e?null:e.__moduleId__:null},setModuleId:function(e,t){return e?"function"==typeof e?(e.prototype.__moduleId__=t,void 0):("string"!=typeof e&&(e.__moduleId__=t),void 0):void 0},resolveObject:function(e){return i.isFunction(e)?new e:e},debug:function(e){return 1==arguments.length&&(r=e,r?(this.log=v,this.error=g,this.log("Debug:Enabled")):(this.log("Debug:Disabled"),this.log=f,this.error=f)),r},log:f,error:f,assert:function(e,t){e||i.error(new Error(t||"Assert:Failed"))},defer:function(e){return t.Deferred(e)},guid:function(){return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(e){var t=0|16*Math.random(),n="x"==e?t:8|3&t;return n.toString(16)})},acquire:function(){var t,n=arguments[0],r=!1;return i.isArray(n)?(t=n,r=!0):t=l.call(arguments,0),this.defer(function(n){e(t,function(){var e=arguments;setTimeout(function(){e.length>1||r?n.resolve(l.call(e,0)):n.resolve(e[0])},1)},function(e){n.reject(e)})}).promise()},extend:function(e){for(var t=l.call(arguments,1),n=0;n<t.length;n++){var i=t[n];if(i)for(var r in i)e[r]=i[r]}return e},wait:function(e){return i.defer(function(t){setTimeout(t.resolve,e)}).promise()}},i.keys=o||function(e){if(e!==Object(e))throw new TypeError("Invalid object");var t=[];for(var n in e)a.call(e,n)&&(t[t.length]=n);return t},i.isElement=function(e){return!(!e||1!==e.nodeType)},i.isArray=c||function(e){return"[object Array]"==u.call(e)},i.isObject=function(e){return e===Object(e)},i.isBoolean=function(e){return"boolean"==typeof e},i.isPromise=function(e){return e&&i.isFunction(e.then)};for(var p=["Arguments","Function","String","Number","Date","RegExp"],h=0;h<p.length;h++)n(p[h]);return i});
define('durandal/viewEngine',["durandal/system","jquery"],function(e,t){var n;return n=t.parseHTML?function(e){return t.parseHTML(e)}:function(e){return t(e).get()},{viewExtension:".html",viewPlugin:"text",isViewUrl:function(e){return-1!==e.indexOf(this.viewExtension,e.length-this.viewExtension.length)},convertViewUrlToViewId:function(e){return e.substring(0,e.length-this.viewExtension.length)},convertViewIdToRequirePath:function(e){return this.viewPlugin+"!"+e+this.viewExtension},parseMarkup:n,processMarkup:function(e){var t=this.parseMarkup(e);return this.ensureSingleElement(t)},ensureSingleElement:function(e){if(1==e.length)return e[0];for(var n=[],i=0;i<e.length;i++){var r=e[i];if(8!=r.nodeType){if(3==r.nodeType){var o=/\S/.test(r.nodeValue);if(!o)continue}n.push(r)}}return n.length>1?t(n).wrapAll('<div class="durandal-wrapper"></div>').parent().get(0):n[0]},createView:function(t){var n=this,i=this.convertViewIdToRequirePath(t);return e.defer(function(r){e.acquire(i).then(function(e){var i=n.processMarkup(e);i.setAttribute("data-view",t),r.resolve(i)}).fail(function(e){n.createFallbackView(t,i,e).then(function(e){e.setAttribute("data-view",t),r.resolve(e)})})}).promise()},createFallbackView:function(t,n){var i=this,r='View Not Found. Searched for "'+t+'" via path "'+n+'".';return e.defer(function(e){e.resolve(i.processMarkup('<div class="durandal-view-404">'+r+"</div>"))}).promise()}}});
define('durandal/viewLocator',["durandal/system","durandal/viewEngine"],function(e,t){function n(e,t){for(var n=0;n<e.length;n++){var i=e[n],r=i.getAttribute("data-view");if(r==t)return i}}function i(e){return(e+"").replace(/([\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:])/g,"\\$1")}return{useConvention:function(e,t,n){e=e||"viewmodels",t=t||"views",n=n||t;var r=new RegExp(i(e),"gi");this.convertModuleIdToViewId=function(e){return e.replace(r,t)},this.translateViewIdToArea=function(e,t){return t&&"partial"!=t?n+"/"+t+"/"+e:n+"/"+e}},locateViewForObject:function(t,n,i){var r;if(t.getView&&(r=t.getView()))return this.locateView(r,n,i);if(t.viewUrl)return this.locateView(t.viewUrl,n,i);var o=e.getModuleId(t);return o?this.locateView(this.convertModuleIdToViewId(o),n,i):this.locateView(this.determineFallbackViewId(t),n,i)},convertModuleIdToViewId:function(e){return e},determineFallbackViewId:function(e){var t=/function (.{1,})\(/,n=t.exec(e.constructor.toString()),i=n&&n.length>1?n[1]:"";return"views/"+i},translateViewIdToArea:function(e){return e},locateView:function(i,r,o){if("string"==typeof i){var a;if(a=t.isViewUrl(i)?t.convertViewUrlToViewId(i):i,r&&(a=this.translateViewIdToArea(a,r)),o){var u=n(o,a);if(u)return e.defer(function(e){e.resolve(u)}).promise()}return t.createView(a)}return e.defer(function(e){e.resolve(i)}).promise()}}});
define('durandal/binder',["durandal/system","knockout"],function(e,t){function n(t){return void 0===t?{applyBindings:!0}:e.isBoolean(t)?{applyBindings:t}:(void 0===t.applyBindings&&(t.applyBindings=!0),t)}function i(i,s,l,d){if(!s||!l)return r.throwOnErrors?e.error(o):e.log(o,s,d),void 0;if(!s.getAttribute)return r.throwOnErrors?e.error(a):e.log(a,s,d),void 0;var f=s.getAttribute("data-view");try{var v;return i&&i.binding&&(v=i.binding(s)),v=n(v),r.binding(d,s,v),v.applyBindings?(e.log("Binding",f,d),t.applyBindings(l,s)):i&&t.utils.domData.set(s,c,{$data:i}),r.bindingComplete(d,s,v),i&&i.bindingComplete&&i.bindingComplete(s),t.utils.domData.set(s,u,v),v}catch(g){g.message=g.message+";\nView: "+f+";\nModuleId: "+e.getModuleId(d),r.throwOnErrors?e.error(g):e.log(g.message)}}var r,o="Insufficient Information to Bind",a="Unexpected View Type",u="durandal-binding-instruction",c="__ko_bindingContext__";return r={binding:e.noop,bindingComplete:e.noop,throwOnErrors:!1,getBindingInstruction:function(e){return t.utils.domData.get(e,u)},bindContext:function(e,t,n){return n&&e&&(e=e.createChildContext(n)),i(n,t,e,n||(e?e.$data:null))},bind:function(e,t){return i(e,t,e,e)}}});
define('durandal/activator',["durandal/system","knockout"],function(e,t){function n(e){return void 0==e&&(e={}),e.closeOnDeactivate||(e.closeOnDeactivate=s.defaults.closeOnDeactivate),e.beforeActivate||(e.beforeActivate=s.defaults.beforeActivate),e.afterDeactivate||(e.afterDeactivate=s.defaults.afterDeactivate),e.affirmations||(e.affirmations=s.defaults.affirmations),e.interpretResponse||(e.interpretResponse=s.defaults.interpretResponse),e.areSameItem||(e.areSameItem=s.defaults.areSameItem),e}function i(t,n,i){return e.isArray(i)?t[n].apply(t,i):t[n](i)}function r(t,n,i,r,o){if(t&&t.deactivate){e.log("Deactivating",t);var a;try{a=t.deactivate(n)}catch(u){return e.error(u),r.resolve(!1),void 0}a&&a.then?a.then(function(){i.afterDeactivate(t,n,o),r.resolve(!0)},function(t){e.log(t),r.resolve(!1)}):(i.afterDeactivate(t,n,o),r.resolve(!0))}else t&&i.afterDeactivate(t,n,o),r.resolve(!0)}function o(t,n,r,o){if(t)if(t.activate){e.log("Activating",t);var a;try{a=i(t,"activate",o)}catch(u){return e.error(u),r(!1),void 0}a&&a.then?a.then(function(){n(t),r(!0)},function(t){e.log(t),r(!1)}):(n(t),r(!0))}else n(t),r(!0);else r(!0)}function a(t,n,i){return i.lifecycleData=null,e.defer(function(r){if(t&&t.canDeactivate){var o;try{o=t.canDeactivate(n)}catch(a){return e.error(a),r.resolve(!1),void 0}o.then?o.then(function(e){i.lifecycleData=e,r.resolve(i.interpretResponse(e))},function(t){e.error(t),r.resolve(!1)}):(i.lifecycleData=o,r.resolve(i.interpretResponse(o)))}else r.resolve(!0)}).promise()}function u(t,n,r,o){return r.lifecycleData=null,e.defer(function(a){if(t==n())return a.resolve(!0),void 0;if(t&&t.canActivate){var u;try{u=i(t,"canActivate",o)}catch(c){return e.error(c),a.resolve(!1),void 0}u.then?u.then(function(e){r.lifecycleData=e,a.resolve(r.interpretResponse(e))},function(t){e.error(t),a.resolve(!1)}):(r.lifecycleData=u,a.resolve(r.interpretResponse(u)))}else a.resolve(!0)}).promise()}function c(i,c){var s,l=t.observable(null);c=n(c);var d=t.computed({read:function(){return l()},write:function(e){d.viaSetter=!0,d.activateItem(e)}});return d.__activator__=!0,d.settings=c,c.activator=d,d.isActivating=t.observable(!1),d.canDeactivateItem=function(e,t){return a(e,t,c)},d.deactivateItem=function(t,n){return e.defer(function(e){d.canDeactivateItem(t,n).then(function(i){i?r(t,n,c,e,l):(d.notifySubscribers(),e.resolve(!1))})}).promise()},d.canActivateItem=function(e,t){return u(e,l,c,t)},d.activateItem=function(t,n){var i=d.viaSetter;return d.viaSetter=!1,e.defer(function(a){if(d.isActivating())return a.resolve(!1),void 0;d.isActivating(!0);var u=l();return c.areSameItem(u,t,s,n)?(d.isActivating(!1),a.resolve(!0),void 0):(d.canDeactivateItem(u,c.closeOnDeactivate).then(function(f){f?d.canActivateItem(t,n).then(function(f){f?e.defer(function(e){r(u,c.closeOnDeactivate,c,e)}).promise().then(function(){t=c.beforeActivate(t,n),o(t,l,function(e){s=n,d.isActivating(!1),a.resolve(e)},n)}):(i&&d.notifySubscribers(),d.isActivating(!1),a.resolve(!1))}):(i&&d.notifySubscribers(),d.isActivating(!1),a.resolve(!1))}),void 0)}).promise()},d.canActivate=function(){var e;return i?(e=i,i=!1):e=d(),d.canActivateItem(e)},d.activate=function(){var e;return i?(e=i,i=!1):e=d(),d.activateItem(e)},d.canDeactivate=function(e){return d.canDeactivateItem(d(),e)},d.deactivate=function(e){return d.deactivateItem(d(),e)},d.includeIn=function(e){e.canActivate=function(){return d.canActivate()},e.activate=function(){return d.activate()},e.canDeactivate=function(e){return d.canDeactivate(e)},e.deactivate=function(e){return d.deactivate(e)}},c.includeIn?d.includeIn(c.includeIn):i&&d.activate(),d.forItems=function(t){c.closeOnDeactivate=!1,c.determineNextItemToActivate=function(e,t){var n=t-1;return-1==n&&e.length>1?e[1]:n>-1&&n<e.length-1?e[n]:null},c.beforeActivate=function(e){var n=d();if(e){var i=t.indexOf(e);-1==i?t.push(e):e=t()[i]}else e=c.determineNextItemToActivate(t,n?t.indexOf(n):0);return e},c.afterDeactivate=function(e,n){n&&t.remove(e)};var n=d.canDeactivate;d.canDeactivate=function(i){return i?e.defer(function(e){function n(){for(var t=0;t<o.length;t++)if(!o[t])return e.resolve(!1),void 0;e.resolve(!0)}for(var r=t(),o=[],a=0;a<r.length;a++)d.canDeactivateItem(r[a],i).then(function(e){o.push(e),o.length==r.length&&n()})}).promise():n()};var i=d.deactivate;return d.deactivate=function(n){return n?e.defer(function(e){function i(i){d.deactivateItem(i,n).then(function(){o++,t.remove(i),o==a&&e.resolve()})}for(var r=t(),o=0,a=r.length,u=0;a>u;u++)i(r[u])}).promise():i()},d},d}var s,l={closeOnDeactivate:!0,affirmations:["yes","ok","true"],interpretResponse:function(n){return e.isObject(n)&&(n=n.can||!1),e.isString(n)?-1!==t.utils.arrayIndexOf(this.affirmations,n.toLowerCase()):n},areSameItem:function(e,t){return e==t},beforeActivate:function(e){return e},afterDeactivate:function(e,t,n){t&&n&&n(null)}};return s={defaults:l,create:c,isActivator:function(e){return e&&e.__activator__}}});
define('durandal/composition',["durandal/system","durandal/viewLocator","durandal/binder","durandal/viewEngine","durandal/activator","jquery","knockout"],function(e,t,n,i,r,o,a){function c(e){for(var t=[],n={childElements:t,activeView:null},i=a.virtualElements.firstChild(e);i;)1==i.nodeType&&(t.push(i),i.getAttribute(x)&&(n.activeView=i)),i=a.virtualElements.nextSibling(i);return n.activeView||(n.activeView=t[0]),n}function u(){A--,0===A&&setTimeout(function(){for(var t=I.length;t--;)try{I[t]()}catch(n){e.error(n)}I=[]},1)}function s(e){delete e.activeView,delete e.viewElements}function l(t,n,i){if(i)n();else if(t.activate&&t.model&&t.model.activate){var r;try{r=e.isArray(t.activationData)?t.model.activate.apply(t.model,t.activationData):t.model.activate(t.activationData),r&&r.then?r.then(n,function(t){e.error(t),n()}):r||void 0===r?n():(u(),s(t))}catch(o){e.error(o)}}else n()}function d(){var t=this;if(t.activeView&&t.activeView.removeAttribute(x),t.child)try{t.model&&t.model.attached&&(t.composingNewView||t.alwaysTriggerAttach)&&t.model.attached(t.child,t.parent,t),t.attached&&t.attached(t.child,t.parent,t),t.child.setAttribute(x,!0),t.composingNewView&&t.model&&t.model.detached&&a.utils.domNodeDisposal.addDisposeCallback(t.child,function(){try{t.model.detached(t.child,t.parent,t)}catch(n){e.error(n)}})}catch(n){e.error(n)}t.triggerAttach=e.noop}function f(t){if(e.isString(t.transition)){if(t.activeView){if(t.activeView==t.child)return!1;if(!t.child)return!0;if(t.skipTransitionOnSameViewId){var n=t.activeView.getAttribute("data-view"),i=t.child.getAttribute("data-view");return n!=i}}return!0}return!1}function v(e){for(var t=0,n=e.length,i=[];n>t;t++){var r=e[t].cloneNode(!0);i.push(r)}return i}function g(e){var t=v(e.parts),n=b.getParts(t,null,!0),i=b.getParts(e.child);for(var r in n)o(i[r]).replaceWith(n[r])}function p(t){var n,i,r=a.virtualElements.childNodes(t.parent);if(!e.isArray(r)){var o=[];for(n=0,i=r.length;i>n;n++)o[n]=r[n];r=o}for(n=1,i=r.length;i>n;n++)a.removeNode(r[n])}function m(e){a.utils.domData.set(e,k,e.style.display),e.style.display="none"}function h(e){e.style.display=a.utils.domData.get(e,k)}function w(e){var t=e.getAttribute("data-bind");if(!t)return!1;for(var n=0,i=_.length;i>n;n++)if(t.indexOf(_[n])>-1)return!0;return!1}var b,y={},x="data-active-view",I=[],A=0,S="durandal-composition-data",D="data-part",V=["model","view","transition","area","strategy","activationData"],k="durandal-visibility-data",_=["compose:"],O={complete:function(e){I.push(e)}};return b={composeBindings:_,convertTransitionToModuleId:function(e){return"transitions/"+e},defaultTransitionName:null,current:O,addBindingHandler:function(e,t,n){var i,r,o="composition-handler-"+e;t=t||a.bindingHandlers[e],n=n||function(){return void 0},r=a.bindingHandlers[e]={init:function(e,i,r,c,u){if(A>0){var s={trigger:a.observable(null)};b.current.complete(function(){t.init&&t.init(e,i,r,c,u),t.update&&(a.utils.domData.set(e,o,t),s.trigger("trigger"))}),a.utils.domData.set(e,o,s)}else a.utils.domData.set(e,o,t),t.init&&t.init(e,i,r,c,u);return n(e,i,r,c,u)},update:function(e,t,n,i,r){var c=a.utils.domData.get(e,o);return c.update?c.update(e,t,n,i,r):(c.trigger&&c.trigger(),void 0)}};for(i in t)"init"!==i&&"update"!==i&&(r[i]=t[i])},getParts:function(e,t,n){if(t=t||{},!e)return t;void 0===e.length&&(e=[e]);for(var i=0,r=e.length;r>i;i++){var o=e[i];if(o.getAttribute){if(!n&&w(o))continue;var a=o.getAttribute(D);a&&(t[a]=o),!n&&o.hasChildNodes()&&b.getParts(o.childNodes,t)}}return t},cloneNodes:v,finalize:function(t){if(void 0===t.transition&&(t.transition=this.defaultTransitionName),t.child||t.activeView)if(f(t)){var i=this.convertTransitionToModuleId(t.transition);e.acquire(i).then(function(e){t.transition=e,e(t).then(function(){if(t.cacheViews){if(t.activeView){var e=n.getBindingInstruction(t.activeView);e&&void 0!=e.cacheViews&&!e.cacheViews&&a.removeNode(t.activeView)}}else t.child?p(t):a.virtualElements.emptyNode(t.parent);t.triggerAttach(),u(),s(t)})}).fail(function(t){e.error("Failed to load transition ("+i+"). Details: "+t.message)})}else{if(t.child!=t.activeView){if(t.cacheViews&&t.activeView){var r=n.getBindingInstruction(t.activeView);!r||void 0!=r.cacheViews&&!r.cacheViews?a.removeNode(t.activeView):m(t.activeView)}t.child?(t.cacheViews||p(t),h(t.child)):t.cacheViews||a.virtualElements.emptyNode(t.parent)}t.triggerAttach(),u(),s(t)}else t.cacheViews||a.virtualElements.emptyNode(t.parent),t.triggerAttach(),u(),s(t)},bindAndShow:function(e,t,r){t.child=e,t.composingNewView=t.cacheViews?-1==a.utils.arrayIndexOf(t.viewElements,e):!0,l(t,function(){if(t.binding&&t.binding(t.child,t.parent,t),t.preserveContext&&t.bindingContext)t.composingNewView&&(t.parts&&g(t),m(e),a.virtualElements.prepend(t.parent,e),n.bindContext(t.bindingContext,e,t.model));else if(e){var r=t.model||y,o=a.dataFor(e);if(o!=r){if(!t.composingNewView)return a.removeNode(e),i.createView(e.getAttribute("data-view")).then(function(e){b.bindAndShow(e,t,!0)}),void 0;t.parts&&g(t),m(e),a.virtualElements.prepend(t.parent,e),n.bind(r,e)}}b.finalize(t)},r)},defaultStrategy:function(e){return t.locateViewForObject(e.model,e.area,e.viewElements)},getSettings:function(t){var n,o=t(),c=a.utils.unwrapObservable(o)||{},u=r.isActivator(o);if(e.isString(c))return c=i.isViewUrl(c)?{view:c}:{model:c,activate:!0};if(n=e.getModuleId(c))return c={model:c,activate:!0};!u&&c.model&&(u=r.isActivator(c.model));for(var s in c)c[s]=-1!=a.utils.arrayIndexOf(V,s)?a.utils.unwrapObservable(c[s]):c[s];return u?c.activate=!1:void 0===c.activate&&(c.activate=!0),c},executeStrategy:function(e){e.strategy(e).then(function(t){b.bindAndShow(t,e)})},inject:function(n){return n.model?n.view?(t.locateView(n.view,n.area,n.viewElements).then(function(e){b.bindAndShow(e,n)}),void 0):(n.strategy||(n.strategy=this.defaultStrategy),e.isString(n.strategy)?e.acquire(n.strategy).then(function(e){n.strategy=e,b.executeStrategy(n)}).fail(function(t){e.error("Failed to load view strategy ("+n.strategy+"). Details: "+t.message)}):this.executeStrategy(n),void 0):(this.bindAndShow(null,n),void 0)},compose:function(n,i,r,o){A++,o||(i=b.getSettings(function(){return i},n)),i.compositionComplete&&I.push(function(){i.compositionComplete(i.child,i.parent,i)}),I.push(function(){i.composingNewView&&i.model&&i.model.compositionComplete&&i.model.compositionComplete(i.child,i.parent,i)});var a=c(n);i.activeView=a.activeView,i.parent=n,i.triggerAttach=d,i.bindingContext=r,i.cacheViews&&!i.viewElements&&(i.viewElements=a.childElements),i.model?e.isString(i.model)?e.acquire(i.model).then(function(t){i.model=e.resolveObject(t),b.inject(i)}).fail(function(t){e.error("Failed to load composed module ("+i.model+"). Details: "+t.message)}):b.inject(i):i.view?(i.area=i.area||"partial",i.preserveContext=!0,t.locateView(i.view,i.area,i.viewElements).then(function(e){b.bindAndShow(e,i)})):this.bindAndShow(null,i)}},a.bindingHandlers.compose={init:function(){return{controlsDescendantBindings:!0}},update:function(e,t,n,r,o){var c=b.getSettings(t,e);if(c.mode){var u=a.utils.domData.get(e,S);if(!u){var s=a.virtualElements.childNodes(e);u={},"inline"===c.mode?u.view=i.ensureSingleElement(s):"templated"===c.mode&&(u.parts=v(s)),a.virtualElements.emptyNode(e),a.utils.domData.set(e,S,u)}"inline"===c.mode?c.view=u.view.cloneNode(!0):"templated"===c.mode&&(c.parts=u.parts),c.preserveContext=!0}b.compose(e,c,o,!0)}},a.virtualElements.allowedBindings.compose=!0,b});
define('durandal/events',["durandal/system"],function(e){var t=/\s+/,n=function(){},i=function(e,t){this.owner=e,this.events=t};return i.prototype.then=function(e,t){return this.callback=e||this.callback,this.context=t||this.context,this.callback?(this.owner.on(this.events,this.callback,this.context),this):this},i.prototype.on=i.prototype.then,i.prototype.off=function(){return this.owner.off(this.events,this.callback,this.context),this},n.prototype.on=function(e,n,r){var o,a,c;if(n){for(o=this.callbacks||(this.callbacks={}),e=e.split(t);a=e.shift();)c=o[a]||(o[a]=[]),c.push(n,r);return this}return new i(this,e)},n.prototype.off=function(n,i,r){var o,a,c,s;if(!(a=this.callbacks))return this;if(!(n||i||r))return delete this.callbacks,this;for(n=n?n.split(t):e.keys(a);o=n.shift();)if((c=a[o])&&(i||r))for(s=c.length-2;s>=0;s-=2)i&&c[s]!==i||r&&c[s+1]!==r||c.splice(s,2);else delete a[o];return this},n.prototype.trigger=function(e){var n,i,r,o,a,c,s,u;if(!(i=this.callbacks))return this;for(u=[],e=e.split(t),o=1,a=arguments.length;a>o;o++)u[o-1]=arguments[o];for(;n=e.shift();){if((s=i.all)&&(s=s.slice()),(r=i[n])&&(r=r.slice()),r)for(o=0,a=r.length;a>o;o+=2)r[o].apply(r[o+1]||this,u);if(s)for(c=[n].concat(u),o=0,a=s.length;a>o;o+=2)s[o].apply(s[o+1]||this,c)}return this},n.prototype.proxy=function(e){var t=this;return function(n){t.trigger(e,n)}},n.includeIn=function(e){e.on=n.prototype.on,e.off=n.prototype.off,e.trigger=n.prototype.trigger,e.proxy=n.prototype.proxy},n});
define('durandal/app',["durandal/system","durandal/viewEngine","durandal/composition","durandal/events","jquery"],function(e,t,n,i,r){function o(){return e.defer(function(t){return 0==u.length?(t.resolve(),void 0):(e.acquire(u).then(function(n){for(var i=0;i<n.length;i++){var r=n[i];if(r.install){var o=c[i];e.isObject(o)||(o={}),r.install(o),e.log("Plugin:Installed "+u[i])}else e.log("Plugin:Loaded "+u[i])}t.resolve()}).fail(function(t){e.error("Failed to load plugin(s). Details: "+t.message)}),void 0)}).promise()}var a,u=[],c=[];return a={title:"Application",configurePlugins:function(t,n){var i=e.keys(t);n=n||"plugins/",-1===n.indexOf("/",n.length-1)&&(n+="/");for(var r=0;r<i.length;r++){var o=i[r];u.push(n+o),c.push(t[o])}},start:function(){return e.log("Application:Starting"),this.title&&(document.title=this.title),e.defer(function(t){r(function(){o().then(function(){t.resolve(),e.log("Application:Started")})})}).promise()},setRoot:function(i,r,o){var a,u={activate:!0,transition:r};a=!o||e.isString(o)?document.getElementById(o||"applicationHost"):o,e.isString(i)?t.isViewUrl(i)?u.view=i:u.model=i:u.model=i,n.compose(a,u)}},i.includeIn(a),a});
requirejs.config({paths:{text:"../Scripts/text",durandal:"../Scripts/durandal",plugins:"../Scripts/durandal/plugins",transitions:"../Scripts/durandal/transitions"}}),define("jquery",[],function(){return jQuery}),define("knockout",ko),define("lodash",_),define('main',["durandal/app","durandal/system","durandal/viewLocator"],function(e,t,n){t.debug(!0),e.title="TGD",e.configurePlugins({router:!0,dialog:!0}),e.start().then(function(){n.useConvention(),e.setRoot("viewmodels/shell")})});
define('text',{load: function(id){throw new Error("Dynamic load not allowed: " + id);}});

define('text!modals/input.html',[],function () { return '<div class="messageBox">\r\n    <div class="modal-header">\r\n        <h3>Enter text</h3>\r\n    </div>\r\n    <div class="modal-body">\r\n        <form data-bind="submit: ok">\r\n            <p class="message">Here: </p>\r\n            <input data-bind="value: input, valueUpdate: \'afterkeydown\'" class="autofocus"/>\r\n        </form>\r\n    </div>\r\n    <div class="modal-footer">\r\n        <button class="btn btn-primary" data-bind="click: ok">Ok</button>\r\n    </div>\r\n</div>';});

define('plugins/dialog',["durandal/system","durandal/app","durandal/composition","durandal/activator","durandal/viewEngine","jquery","knockout"],function(e,t,n,i,r,o,a){function s(t){return e.defer(function(n){e.isString(t)?e.acquire(t).then(function(t){n.resolve(e.resolveObject(t))}).fail(function(n){e.error("Failed to load dialog module ("+t+"). Details: "+n.message)}):n.resolve(t)}).promise()}var c,u={},l=0,d=function(e,t,n){this.message=e,this.title=t||d.defaultTitle,this.options=n||d.defaultOptions};return d.prototype.selectOption=function(e){c.close(this,e)},d.prototype.getView=function(){return r.processMarkup(d.defaultViewMarkup)},d.setViewUrl=function(e){delete d.prototype.getView,d.prototype.viewUrl=e},d.defaultTitle=t.title||"Application",d.defaultOptions=["Ok"],d.defaultViewMarkup=['<div data-view="plugins/messageBox" class="messageBox">','<div class="modal-header">','<h3 data-bind="text: title"></h3>',"</div>",'<div class="modal-body">','<p class="message" data-bind="text: message"></p>',"</div>",'<div class="modal-footer" data-bind="foreach: options">','<button class="btn" data-bind="click: function () { $parent.selectOption($data); }, text: $data, css: { \'btn-primary\': $index() == 0, autofocus: $index() == 0 }"></button>',"</div>","</div>"].join("\n"),c={MessageBox:d,currentZIndex:1050,getNextZIndex:function(){return++this.currentZIndex},isOpen:function(){return l>0},getContext:function(e){return u[e||"default"]},addContext:function(e,t){t.name=e,u[e]=t;var n="show"+e.substr(0,1).toUpperCase()+e.substr(1);this[n]=function(t,n){return this.show(t,n,e)}},createCompositionSettings:function(e,t){var n={model:e,activate:!1,transition:!1};return t.attached&&(n.attached=t.attached),t.compositionComplete&&(n.compositionComplete=t.compositionComplete),n},getDialog:function(e){return e?e.__dialog__:void 0},close:function(e){var t=this.getDialog(e);if(t){var n=Array.prototype.slice.call(arguments,1);t.close.apply(t,n)}},show:function(t,r,o){var a=this,c=u[o||"default"];return e.defer(function(e){s(t).then(function(t){var o=i.create();o.activateItem(t,r).then(function(i){if(i){var r=t.__dialog__={owner:t,context:c,activator:o,close:function(){var n=arguments;o.deactivateItem(t,!0).then(function(i){i&&(l--,c.removeHost(r),delete t.__dialog__,0===n.length?e.resolve():1===n.length?e.resolve(n[0]):e.resolve.apply(e,n))})}};r.settings=a.createCompositionSettings(t,c),c.addHost(r),l++,n.compose(r.host,r.settings)}else e.resolve(!1)})})}).promise()},showMessage:function(t,n,i){return e.isString(this.MessageBox)?c.show(this.MessageBox,[t,n||d.defaultTitle,i||d.defaultOptions]):c.show(new this.MessageBox(t,n,i))},install:function(e){t.showDialog=function(e,t,n){return c.show(e,t,n)},t.showMessage=function(e,t,n){return c.showMessage(e,t,n)},e.messageBox&&(c.MessageBox=e.messageBox),e.messageBoxView&&(c.MessageBox.prototype.getView=function(){return e.messageBoxView})}},c.addContext("default",{blockoutOpacity:.2,removeDelay:200,addHost:function(e){var t=o("body"),n=o('<div class="modalBlockout"></div>').css({"z-index":c.getNextZIndex(),opacity:this.blockoutOpacity}).appendTo(t),i=o('<div class="modalHost"></div>').css({"z-index":c.getNextZIndex()}).appendTo(t);if(e.host=i.get(0),e.blockout=n.get(0),!c.isOpen()){e.oldBodyMarginRight=t.css("margin-right"),e.oldInlineMarginRight=t.get(0).style.marginRight;var r=o("html"),a=t.outerWidth(!0),s=r.scrollTop();o("html").css("overflow-y","hidden");var u=o("body").outerWidth(!0);t.css("margin-right",u-a+parseInt(e.oldBodyMarginRight,10)+"px"),r.scrollTop(s)}},removeHost:function(e){if(o(e.host).css("opacity",0),o(e.blockout).css("opacity",0),setTimeout(function(){a.removeNode(e.host),a.removeNode(e.blockout)},this.removeDelay),!c.isOpen()){var t=o("html"),n=t.scrollTop();t.css("overflow-y","").scrollTop(n),e.oldInlineMarginRight?o("body").css("margin-right",e.oldBodyMarginRight):o("body").css("margin-right","")}},attached:function(e){o(e).css("visibility","hidden")},compositionComplete:function(e,t,n){var i=c.getDialog(n.model),r=o(e),a=r.find("img").filter(function(){var e=o(this);return!(this.style.width&&this.style.height||e.attr("width")&&e.attr("height"))});r.data("predefinedWidth",r.get(0).style.width);var s=function(){setTimeout(function(){r.data("predefinedWidth")||r.css({width:""});var e=r.outerWidth(!1),t=r.outerHeight(!1),n=o(window).height(),a=Math.min(t,n);r.css({"margin-top":(-a/2).toString()+"px","margin-left":(-e/2).toString()+"px"}),r.data("predefinedWidth")||r.outerWidth(e),t>n?r.css("overflow-y","auto"):r.css("overflow-y",""),o(i.host).css("opacity",1),r.css("visibility","visible"),r.find(".autofocus").first().focus()},1)};s(),a.load(s),r.hasClass("autoclose")&&o(i.blockout).click(function(){i.close()})}}),c});
define('modals/input',["plugins/dialog"],function(e){var t=function(){this.input=ko.observable().extend({required:!0})};return t.prototype.ok=function(){var t=ko.validation.group(this);t.showAllMessages(!0),this.isValid()&&e.close(this,this.input())},t.show=function(){return e.show(new t)},t});
define('viewmodels/about',["durandal/system","durandal/app","modals/input","plugins/dialog"],function(e,t,n){var i=ko.observableArray([]);return{items:i,add:function(){n.show().then(function(e){i.push(e),t.trigger("event",e)})}}});
define('plugins/history',["durandal/system","jquery"],function(e,t){function n(e,t,n){if(n){var i=e.href.replace(/(javascript:|#).*$/,"");e.replace(i+"#"+t)}else e.hash="#"+t}var i=/^[#\/]|\s+$/g,r=/^\/+|\/+$/g,o=/msie [\w.]+/,a=/\/$/,s={interval:50,active:!1};return"undefined"!=typeof window&&(s.location=window.location,s.history=window.history),s.getHash=function(e){var t=(e||s).location.href.match(/#(.*)$/);return t?t[1]:""},s.getFragment=function(e,t){if(null==e)if(s._hasPushState||!s._wantsHashChange||t){e=s.location.pathname+s.location.search;var n=s.root.replace(a,"");e.indexOf(n)||(e=e.substr(n.length))}else e=s.getHash();return e.replace(i,"")},s.activate=function(n){s.active&&e.error("History has already been activated."),s.active=!0,s.options=e.extend({},{root:"/"},s.options,n),s.root=s.options.root,s._wantsHashChange=s.options.hashChange!==!1,s._wantsPushState=!!s.options.pushState,s._hasPushState=!!(s.options.pushState&&s.history&&s.history.pushState);var a=s.getFragment(),c=document.documentMode,u=o.exec(navigator.userAgent.toLowerCase())&&(!c||7>=c);s.root=("/"+s.root+"/").replace(r,"/"),u&&s._wantsHashChange&&(s.iframe=t('<iframe src="javascript:0" tabindex="-1" />').hide().appendTo("body")[0].contentWindow,s.navigate(a,!1)),s._hasPushState?t(window).on("popstate",s.checkUrl):s._wantsHashChange&&"onhashchange"in window&&!u?t(window).on("hashchange",s.checkUrl):s._wantsHashChange&&(s._checkUrlInterval=setInterval(s.checkUrl,s.interval)),s.fragment=a;var l=s.location,d=l.pathname.replace(/[^\/]$/,"$&/")===s.root;if(s._wantsHashChange&&s._wantsPushState){if(!s._hasPushState&&!d)return s.fragment=s.getFragment(null,!0),s.location.replace(s.root+s.location.search+"#"+s.fragment),!0;s._hasPushState&&d&&l.hash&&(this.fragment=s.getHash().replace(i,""),this.history.replaceState({},document.title,s.root+s.fragment+l.search))}return s.options.silent?void 0:s.loadUrl()},s.deactivate=function(){t(window).off("popstate",s.checkUrl).off("hashchange",s.checkUrl),clearInterval(s._checkUrlInterval),s.active=!1},s.checkUrl=function(){var e=s.getFragment();return e===s.fragment&&s.iframe&&(e=s.getFragment(s.getHash(s.iframe))),e===s.fragment?!1:(s.iframe&&s.navigate(e,!1),s.loadUrl(),void 0)},s.loadUrl=function(e){var t=s.fragment=s.getFragment(e);return s.options.routeHandler?s.options.routeHandler(t):!1},s.navigate=function(t,i){if(!s.active)return!1;if(void 0===i?i={trigger:!0}:e.isBoolean(i)&&(i={trigger:i}),t=s.getFragment(t||""),s.fragment!==t){s.fragment=t;var r=s.root+t;if(""===t&&"/"!==r&&(r=r.slice(0,-1)),s._hasPushState)s.history[i.replace?"replaceState":"pushState"]({},document.title,r);else{if(!s._wantsHashChange)return s.location.assign(r);n(s.location,t,i.replace),s.iframe&&t!==s.getFragment(s.getHash(s.iframe))&&(i.replace||s.iframe.document.open().close(),n(s.iframe.location,t,i.replace))}return i.trigger?s.loadUrl(t):void 0}},s.navigateBack=function(){s.history.back()},s});
define('plugins/router',["durandal/system","durandal/app","durandal/activator","durandal/events","durandal/composition","plugins/history","knockout","jquery"],function(e,t,n,i,r,o,a,s){function u(e){return e=e.replace(m,"\\$&").replace(g,"(?:$1)?").replace(p,function(e,t){return t?e:"([^/]+)"}).replace(h,"(.*?)"),new RegExp("^"+e+"$")}function c(e){var t=e.indexOf(":"),n=t>0?t-1:e.length;return e.substring(0,n)}function l(e,t){return-1!==e.indexOf(t,e.length-t.length)}function d(e,t){if(!e||!t)return!1;if(e.length!=t.length)return!1;for(var n=0,i=e.length;i>n;n++)if(e[n]!=t[n])return!1;return!0}var f,v,g=/\((.*?)\)/g,p=/(\(\?)?:\w+/g,h=/\*\w+/g,m=/[\-{}\[\]+?.,\\\^$|#\s]/g,b=/\/$/,y=function(){function r(e){return e.router&&e.router.parent==M}function s(e){O&&O.config.isActive&&O.config.isActive(e)}function g(t,n){e.log("Navigation Complete",t,n);var i=e.getModuleId(V);i&&M.trigger("router:navigation:from:"+i),V=t,s(!1),O=n,s(!0);var o=e.getModuleId(V);o&&M.trigger("router:navigation:to:"+o),r(t)||M.updateDocumentTitle(t,n),v.explicitNavigation=!1,v.navigatingBack=!1,M.trigger("router:navigation:complete",t,n,M)}function p(t,n){e.log("Navigation Cancelled"),M.activeInstruction(O),O&&M.navigate(O.fragment,!1),T(!1),v.explicitNavigation=!1,v.navigatingBack=!1,M.trigger("router:navigation:cancelled",t,n,M)}function h(t){e.log("Navigation Redirecting"),T(!1),v.explicitNavigation=!1,v.navigatingBack=!1,M.navigate(t,{trigger:!0,replace:!0})}function m(t,n,i){v.navigatingBack=!v.explicitNavigation&&V!=i.fragment,M.trigger("router:route:activating",n,i,M),t.activateItem(n,i.params).then(function(e){if(e){var o=V;if(g(n,i),r(n)){var a=i.fragment;i.queryString&&(a+="?"+i.queryString),n.router.loadUrl(a)}o==n&&(M.attached(),M.compositionComplete())}else t.settings.lifecycleData&&t.settings.lifecycleData.redirect?h(t.settings.lifecycleData.redirect):p(n,i);f&&(f.resolve(),f=null)}).fail(function(t){e.error(t)})}function w(t,n,i){var r=M.guardRoute(n,i);r?r.then?r.then(function(r){r?e.isString(r)?h(r):m(t,n,i):p(n,i)}):e.isString(r)?h(r):m(t,n,i):p(n,i)}function x(e,t,n){M.guardRoute?w(e,t,n):m(e,t,n)}function I(e){return O&&O.config.moduleId==e.config.moduleId&&V&&(V.canReuseForRoute&&V.canReuseForRoute.apply(V,e.params)||!V.canReuseForRoute&&V.router&&V.router.loadUrl)}function _(){if(!T()){var t=C.shift();C=[],t&&(T(!0),M.activeInstruction(t),I(t)?x(n.create(),V,t):e.acquire(t.config.moduleId).then(function(n){var i=e.resolveObject(n);x(N,i,t)}).fail(function(n){e.error("Failed to load routed module ("+t.config.moduleId+"). Details: "+n.message)}))}}function A(e){C.unshift(e),_()}function k(e,t,n){for(var i=e.exec(t).slice(1),r=0;r<i.length;r++){var o=i[r];i[r]=o?decodeURIComponent(o):null}var a=M.parseQueryString(n);return a&&i.push(a),{params:i,queryParams:a}}function S(t){M.trigger("router:route:before-config",t,M),e.isRegExp(t)?t.routePattern=t.route:(t.title=t.title||M.convertRouteToTitle(t.route),t.moduleId=t.moduleId||M.convertRouteToModuleId(t.route),t.hash=t.hash||M.convertRouteToHash(t.route),t.routePattern=u(t.route)),t.isActive=t.isActive||a.observable(!1),M.trigger("router:route:after-config",t,M),M.routes.push(t),M.route(t.routePattern,function(e,n){var i=k(t.routePattern,e,n);A({fragment:e,queryString:n,config:t,params:i.params,queryParams:i.queryParams})})}function D(t){if(e.isArray(t.route))for(var n=t.isActive||a.observable(!1),i=0,r=t.route.length;r>i;i++){var o=e.extend({},t);o.route=t.route[i],o.isActive=n,i>0&&delete o.nav,S(o)}else S(t);return M}var V,O,C=[],T=a.observable(!1),N=n.create(),M={handlers:[],routes:[],navigationModel:a.observableArray([]),activeItem:N,isNavigating:a.computed(function(){var e=N(),t=T(),n=e&&e.router&&e.router!=M&&e.router.isNavigating()?!0:!1;return t||n}),activeInstruction:a.observable(null),__router__:!0};return i.includeIn(M),N.settings.areSameItem=function(e,t,n,i){return e==t?d(n,i):!1},M.parseQueryString=function(e){var t,n;if(!e)return null;if(n=e.split("&"),0==n.length)return null;t={};for(var i=0;i<n.length;i++){var r=n[i];if(""!==r){var o=r.split("=");t[o[0]]=o[1]&&decodeURIComponent(o[1].replace(/\+/g," "))}}return t},M.route=function(e,t){M.handlers.push({routePattern:e,callback:t})},M.loadUrl=function(t){var n=M.handlers,i=null,r=t,a=t.indexOf("?");if(-1!=a&&(r=t.substring(0,a),i=t.substr(a+1)),M.relativeToParentRouter){var s=this.parent.activeInstruction();r=s.params.join("/"),r&&"/"==r.charAt(0)&&(r=r.substr(1)),r||(r=""),r=r.replace("//","/").replace("//","/")}r=r.replace(b,"");for(var u=0;u<n.length;u++){var c=n[u];if(c.routePattern.test(r))return c.callback(r,i),!0}return e.log("Route Not Found"),M.trigger("router:route:not-found",t,M),O&&o.navigate(O.fragment,{trigger:!1,replace:!0}),v.explicitNavigation=!1,v.navigatingBack=!1,!1},M.updateDocumentTitle=function(e,n){n.config.title?document.title=t.title?n.config.title+" | "+t.title:n.config.title:t.title&&(document.title=t.title)},M.navigate=function(e,t){return e&&-1!=e.indexOf("://")?(window.location.href=e,!0):(v.explicitNavigation=!0,o.navigate(e,t))},M.navigateBack=function(){o.navigateBack()},M.attached=function(){M.trigger("router:navigation:attached",V,O,M)},M.compositionComplete=function(){T(!1),M.trigger("router:navigation:composition-complete",V,O,M),_()},M.convertRouteToHash=function(e){if(M.relativeToParentRouter){var t=M.parent.activeInstruction(),n=t.config.hash+"/"+e;return o._hasPushState&&(n="/"+n),n=n.replace("//","/").replace("//","/")}return o._hasPushState?e:"#"+e},M.convertRouteToModuleId=function(e){return c(e)},M.convertRouteToTitle=function(e){var t=c(e);return t.substring(0,1).toUpperCase()+t.substring(1)},M.map=function(t,n){if(e.isArray(t)){for(var i=0;i<t.length;i++)M.map(t[i]);return M}return e.isString(t)||e.isRegExp(t)?(n?e.isString(n)&&(n={moduleId:n}):n={},n.route=t):n=t,D(n)},M.buildNavigationModel=function(t){for(var n=[],i=M.routes,r=t||100,o=0;o<i.length;o++){var a=i[o];a.nav&&(e.isNumber(a.nav)||(a.nav=++r),n.push(a))}return n.sort(function(e,t){return e.nav-t.nav}),M.navigationModel(n),M},M.mapUnknownRoutes=function(t,n){var i="*catchall",r=u(i);return M.route(r,function(a,s){var u=k(r,a,s),c={fragment:a,queryString:s,config:{route:i,routePattern:r},params:u.params,queryParams:u.queryParams};if(t)if(e.isString(t))c.config.moduleId=t,n&&o.navigate(n,{trigger:!1,replace:!0});else if(e.isFunction(t)){var l=t(c);if(l&&l.then)return l.then(function(){M.trigger("router:route:before-config",c.config,M),M.trigger("router:route:after-config",c.config,M),A(c)}),void 0}else c.config=t,c.config.route=i,c.config.routePattern=r;else c.config.moduleId=a;M.trigger("router:route:before-config",c.config,M),M.trigger("router:route:after-config",c.config,M),A(c)}),M},M.reset=function(){return O=V=void 0,M.handlers=[],M.routes=[],M.off(),delete M.options,M},M.makeRelative=function(t){return e.isString(t)&&(t={moduleId:t,route:t}),t.moduleId&&!l(t.moduleId,"/")&&(t.moduleId+="/"),t.route&&!l(t.route,"/")&&(t.route+="/"),t.fromParent&&(M.relativeToParentRouter=!0),M.on("router:route:before-config").then(function(e){t.moduleId&&(e.moduleId=t.moduleId+e.moduleId),t.route&&(e.route=""===e.route?t.route.substring(0,t.route.length-1):t.route+e.route)}),M},M.createChildRouter=function(){var e=y();return e.parent=M,e},M};return v=y(),v.explicitNavigation=!1,v.navigatingBack=!1,v.targetIsThisWindow=function(e){var t=s(e.target).attr("target");return!t||t===window.name||"_self"===t||"top"===t&&window===window.top?!0:!1},v.activate=function(t){return e.defer(function(n){if(f=n,v.options=e.extend({routeHandler:v.loadUrl},v.options,t),o.activate(v.options),o._hasPushState)for(var i=v.routes,r=i.length;r--;){var a=i[r];a.hash=a.hash.replace("#","")}s(document).delegate("a","click",function(e){if(o._hasPushState){if(!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&v.targetIsThisWindow(e)){var t=s(this).attr("href");null==t||"#"===t.charAt(0)||/^[a-z]+:/i.test(t)||(v.explicitNavigation=!0,e.preventDefault(),o.navigate(t))}}else v.explicitNavigation=!0}),o.options.silent&&f&&(f.resolve(),f=null)}).promise()},v.deactivate=function(){o.deactivate()},v.install=function(){a.bindingHandlers.router={init:function(){return{controlsDescendantBindings:!0}},update:function(e,t,n,i,o){var s=a.utils.unwrapObservable(t())||{};if(s.__router__)s={model:s.activeItem(),attached:s.attached,compositionComplete:s.compositionComplete,activate:!1};else{var u=a.utils.unwrapObservable(s.router||i.router)||v;s.model=u.activeItem(),s.attached=u.attached,s.compositionComplete=u.compositionComplete,s.activate=!1}r.compose(e,s,o)}},a.virtualElements.allowedBindings.router=!0},v});
define('viewmodels/edit',["durandal/app","plugins/router"],function(){var e=ko.observable();return{activate:function(t){e("Id: "+t)},idDisplay:e}});
define('viewmodels/footer',["durandal/app"],function(e){return{footerText:"Sample text",subscription:ko.observable(null),messages:ko.observableArray([]),sub:function(){var t=e.on("event").then(function(e){this.messages.push(e)},this);this.subscription(t)},unsub:function(){this.subscription().off(),this.subscription(null)}}});
define('viewmodels/home',["durandal/system","plugins/router"],function(e,t){return{canActivate:function(){return e.log("canActivate"),!0},activate:function(){e.log("activate")},binding:function(){e.log("binding")},bindingComplete:function(){e.log("bindingComplete")},attached:function(){e.log("attached")},compositionComplete:function(){e.log("compositionComplete")},canDeactivate:function(){return e.log("canDeactivate"),!0},deactivate:function(){e.log("deactivate")},detached:function(){e.log("detached")},go:function(){t.navigateBack()}}});
define('viewmodels/master',["plugins/router","durandal/app"],function(e){var t=e.createChildRouter().makeRelative({fromParent:!0}).map([{route:"",moduleId:"viewmodels/master/firstchild",title:"First child",nav:!0},{route:"secondchild",moduleId:"viewmodels/master/secondchild",title:"Second child",nav:!0}]).buildNavigationModel();return{router:t}});
define('viewmodels/master/firstchild',[],function(){return{}});
define('viewmodels/master/secondchild',[],function(){return{}});
define('viewmodels/not-found',[],function(){return{}});
define('viewmodels/shell',["durandal/app","plugins/router","durandal/system"],function(e,t,n){return t.map([{route:"",moduleId:"viewmodels/home",title:"Home",nav:!0},{route:"about",moduleId:"viewmodels/about",title:"About",nav:!0},{route:"edit(/:id)",moduleId:"viewmodels/edit",hash:"#edit",title:"Edit",nav:!0},{route:"master*submodule",moduleId:"viewmodels/master",hash:"#master",title:"Master",nav:!0}]).buildNavigationModel(),t.mapUnknownRoutes("viewmodels/not-found","not-found"),{router:t,activate:function(){return n.defer(function(e){setTimeout(function(){t.activate().then(e.resolve)},1e3)})}}});

define('text!views/about.html',[],function () { return '<div>\r\n    <h2>About</h2>\r\n    <p>\r\n        Lorem ipsum\r\n    </p>\r\n    \r\n    <a href="#" data-bind="click: add" >Add item</a>\r\n    <ul data-bind="foreach: items">\r\n        <li data-bind="text: $data"></li>\r\n    </ul>\r\n</div>';});


define('text!views/edit.html',[],function () { return '<h2>Edit</h2>\r\n\r\n<p data-bind="text: idDisplay"></p>';});


define('text!views/footer.html',[],function () { return '<footer>\r\n    <div class="container" style="margin-top: 20px">\r\n        <p data-bind="text: footerText"></p>\r\n        <p>\r\n            <button class="btn" data-bind="click: sub, enable: !subscription()">Subscribe</button>\r\n            <button class="btn" data-bind="click: unsub, enable: subscription()">Unsubscribe</button>\r\n        </p>\r\n        <ul data-bind="foreach: messages">\r\n            <li data-bind="text: $data"></li>\r\n        </ul>\r\n    </div>\r\n</footer>';});


define('text!views/home.html',[],function () { return '<div>\n    <h2>Home</h2>\n    <button data-bind="click: go">Got to other view</button>\n</div>';});


define('text!views/master.html',[],function () { return '<div class="container-fluid">\r\n    <div class="row">\r\n        <div class="col-xs-6 col-md-4">\r\n            <ul class="nav nav-pills nav-stacked" data-bind="foreach: router.navigationModel">\r\n                <li data-bind="css: { active: isActive }">\r\n                    <a data-bind="attr: { href: hash }, text: title"></a>\r\n                </li>\r\n            </ul>\r\n        </div>        \r\n        <div class="col-xs-12 col-md-8">\r\n            <!--ko router: { transition:\'entrance\', cacheViews:true }--><!--/ko-->\r\n        </div>\r\n    </div>\r\n</div>';});


define('text!views/master/firstchild.html',[],function () { return '<h2>First child</h2>\r\n\r\n<p>Lorem ipsum bleble</p>';});


define('text!views/master/secondchild.html',[],function () { return '<h2>Second child</h2>\r\n\r\n<p>Lorem ipsum bleble second</p>';});


define('text!views/not-found.html',[],function () { return '<h2>Not found</h2>';});


define('text!views/shell.html',[],function () { return '<div>\r\n    <header class="navbar navbar-static-top">\r\n        <div class="container">\r\n            <nav class="collapse navbar-collapse navbar-default">\r\n                <ul class="nav navbar-nav" data-bind="foreach: router.navigationModel">\r\n                    <li data-bind="css: { active: isActive }">\r\n                        <a data-bind="attr: { href: hash }, html: title"></a>\r\n                    </li>\r\n                </ul>\r\n                <p class="navbar-text navbar-right" data-bind="if: router.isNavigating">\r\n                    Loading...\r\n                </p>\r\n            </nav>\r\n        </div>\r\n    </header>\r\n    \r\n    <div class="container" data-bind="router: { transition: \'entrance\', cacheViews: true }"></div>\r\n    \r\n    <!-- ko compose: \'viewmodels/footer\'--><!-- /ko -->\r\n</div>';});

define('plugins/http',["jquery","knockout"],function(e,t){return{callbackParam:"callback",get:function(t,n){return e.ajax(t,{data:n})},jsonp:function(t,n,i){return-1==t.indexOf("=?")&&(i=i||this.callbackParam,t+=-1==t.indexOf("?")?"?":"&",t+=i+"=?"),e.ajax({url:t,dataType:"jsonp",data:n})},post:function(n,i){return e.ajax({url:n,data:t.toJSON(i),type:"POST",contentType:"application/json",dataType:"json"})}}});
define('plugins/observable',["durandal/system","durandal/binder","knockout"],function(e,t,n){function i(e){var t=e[0];return"_"===t||"$"===t}function r(t){return!(!t||void 0===t.nodeType||!e.isNumber(t.nodeType))}function o(e){if(!e||r(e)||e.ko===n||e.jquery)return!1;var t=f.call(e);return-1==v.indexOf(t)&&!(e===!0||e===!1)}function a(e,t){var n=e.__observable__,i=!0;if(!n||!n.__full__){n=n||(e.__observable__={}),n.__full__=!0,g.forEach(function(n){e[n]=function(){i=!1;var e=b[n].apply(t,arguments);return i=!0,e}}),p.forEach(function(n){e[n]=function(){i&&t.valueWillMutate();var r=m[n].apply(e,arguments);return i&&t.valueHasMutated(),r}}),h.forEach(function(n){e[n]=function(){for(var r=0,o=arguments.length;o>r;r++)s(arguments[r]);i&&t.valueWillMutate();var a=m[n].apply(e,arguments);return i&&t.valueHasMutated(),a}}),e.splice=function(){for(var n=2,r=arguments.length;r>n;n++)s(arguments[n]);i&&t.valueWillMutate();var o=m.splice.apply(e,arguments);return i&&t.valueHasMutated(),o};for(var r=0,o=e.length;o>r;r++)s(e[r])}}function s(t){var r,s;if(o(t)&&(r=t.__observable__,!r||!r.__full__)){if(r=r||(t.__observable__={}),r.__full__=!0,e.isArray(t)){var c=n.observableArray(t);a(t,c)}else for(var l in t)i(l)||r[l]||(s=t[l],e.isFunction(s)||u(t,l,s));y&&e.log("Converted",t)}}function c(e,t,n){var i;e(t),i=e.peek(),n?i?i.destroyAll||a(i,e):(i=[],e(i),a(i,e)):s(i)}function u(t,i,r){var o,u,l=t.__observable__||(t.__observable__={});if(void 0===r&&(r=t[i]),e.isArray(r))o=n.observableArray(r),a(r,o),u=!0;else if("function"==typeof r){if(!n.isObservable(r))return null;o=r}else e.isPromise(r)?(o=n.observable(),r.then(function(t){if(e.isArray(t)){var i=n.observableArray(t);a(t,i),t=i}o(t)})):(o=n.observable(r),s(r));return Object.defineProperty(t,i,{configurable:!0,enumerable:!0,get:o,set:n.isWriteableObservable(o)?function(t){t&&e.isPromise(t)?t.then(function(t){c(o,t,e.isArray(t))}):c(o,t,u)}:void 0}),l[i]=o,o}function l(t,i,r){var o,a={owner:t,deferEvaluation:!0};return"function"==typeof r?a.read=r:("value"in r&&e.error('For defineProperty, you must not specify a "value" for the property. You must provide a "get" function.'),"function"!=typeof r.get&&e.error('For defineProperty, the third parameter must be either an evaluator function, or an options object containing a function called "get".'),a.read=r.get,a.write=r.set),o=n.computed(a),t[i]=o,u(t,i,o)}var d,f=Object.prototype.toString,v=["[object Function]","[object String]","[object Boolean]","[object Number]","[object Date]","[object RegExp]"],g=["remove","removeAll","destroy","destroyAll","replace"],p=["pop","reverse","sort","shift","splice"],h=["push","unshift"],m=Array.prototype,b=n.observableArray.fn,y=!1;return d=function(e,t){var i,r,o;return e?(i=e.__observable__,i&&(r=i[t])?r:(o=e[t],n.isObservable(o)?o:u(e,t,o))):null},d.defineProperty=l,d.convertProperty=u,d.convertObject=s,d.install=function(e){var n=t.binding;t.binding=function(e,t,i){i.applyBindings&&!i.skipConversion&&s(e),n(e,t)},y=e.logConversion},d});
define('plugins/serializer',["durandal/system"],function(e){return{typeAttribute:"type",space:void 0,replacer:function(e,t){if(e){var n=e[0];if("_"===n||"$"===n)return void 0}return t},serialize:function(t,n){return n=void 0===n?{}:n,(e.isString(n)||e.isNumber(n))&&(n={space:n}),JSON.stringify(t,n.replacer||this.replacer,n.space||this.space)},getTypeId:function(e){return e?e[this.typeAttribute]:void 0},typeMap:{},registerType:function(){var t=arguments[0];if(1==arguments.length){var n=t[this.typeAttribute]||e.getModuleId(t);this.typeMap[n]=t}else this.typeMap[t]=arguments[1]},reviver:function(e,t,n,i){var r=n(t);if(r){var o=i(r);if(o)return o.fromJSON?o.fromJSON(t):new o(t)}return t},deserialize:function(e,t){var n=this;t=t||{};var i=t.getTypeId||function(e){return n.getTypeId(e)},r=t.getConstructor||function(e){return n.typeMap[e]},o=t.reviver||function(e,t){return n.reviver(e,t,i,r)};return JSON.parse(e,o)}}});
define('plugins/widget',["durandal/system","durandal/composition","jquery","knockout"],function(e,t,n,i){function r(e,n){var r=i.utils.domData.get(e,u);r||(r={parts:t.cloneNodes(i.virtualElements.childNodes(e))},i.virtualElements.emptyNode(e),i.utils.domData.set(e,u,r)),n.parts=r.parts}var o={},a={},s=["model","view","kind"],u="durandal-widget-data",c={getSettings:function(t){var n=i.utils.unwrapObservable(t())||{};if(e.isString(n))return{kind:n};for(var r in n)n[r]=-1!=i.utils.arrayIndexOf(s,r)?i.utils.unwrapObservable(n[r]):n[r];return n},registerKind:function(e){i.bindingHandlers[e]={init:function(){return{controlsDescendantBindings:!0}},update:function(t,n,i,o,a){var s=c.getSettings(n);s.kind=e,r(t,s),c.create(t,s,a,!0)}},i.virtualElements.allowedBindings[e]=!0,t.composeBindings.push(e+":")},mapKind:function(e,t,n){t&&(a[e]=t),n&&(o[e]=n)},mapKindToModuleId:function(e){return o[e]||c.convertKindToModulePath(e)},convertKindToModulePath:function(e){return"widgets/"+e+"/viewmodel"},mapKindToViewId:function(e){return a[e]||c.convertKindToViewPath(e)},convertKindToViewPath:function(e){return"widgets/"+e+"/view"},createCompositionSettings:function(e,t){return t.model||(t.model=this.mapKindToModuleId(t.kind)),t.view||(t.view=this.mapKindToViewId(t.kind)),t.preserveContext=!0,t.activate=!0,t.activationData=t,t.mode="templated",t},create:function(e,n,i,r){r||(n=c.getSettings(function(){return n},e));var o=c.createCompositionSettings(e,n);t.compose(e,o,i)},install:function(e){if(e.bindingName=e.bindingName||"widget",e.kinds)for(var n=e.kinds,o=0;o<n.length;o++)c.registerKind(n[o]);i.bindingHandlers[e.bindingName]={init:function(){return{controlsDescendantBindings:!0}},update:function(e,t,n,i,o){var a=c.getSettings(t);r(e,a),c.create(e,a,o,!0)}},t.composeBindings.push(e.bindingName+":"),i.virtualElements.allowedBindings[e.bindingName]=!0}};return c});
define('transitions/entrance',["durandal/system","durandal/composition","jquery"],function(e,t,n){var i=100,r={marginRight:0,marginLeft:0,opacity:1},o={marginLeft:"",marginRight:"",opacity:"",display:""},a=function(t){return e.defer(function(e){function a(){e.resolve()}function u(){t.keepScrollPosition||n(document).scrollTop(0)}function s(){u(),t.triggerAttach();var e={marginLeft:l?"0":"20px",marginRight:l?"0":"-20px",opacity:0,display:"block"},i=n(t.child);i.css(e),i.animate(r,{duration:c,easing:"swing",always:function(){i.css(o),a()}})}if(t.child){var c=t.duration||500,l=!!t.fadeOnly;t.activeView?n(t.activeView).fadeOut({duration:i,always:s}):s()}else n(t.activeView).fadeOut(i,a)}).promise()};return a});

require(["main"]);
}());