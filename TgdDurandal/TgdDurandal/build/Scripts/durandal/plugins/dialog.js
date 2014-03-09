define(["durandal/system","durandal/app","durandal/composition","durandal/activator","durandal/viewEngine","jquery","knockout"],function(t,e,i,n,o,a,r){function s(e){return t.defer(function(i){t.isString(e)?t.acquire(e).then(function(e){i.resolve(t.resolveObject(e))}).fail(function(i){t.error("Failed to load dialog module ("+e+"). Details: "+i.message)}):i.resolve(e)}).promise()}var c,l={},u=0,d=function(t,e,i){this.message=t,this.title=e||d.defaultTitle,this.options=i||d.defaultOptions};return d.prototype.selectOption=function(t){c.close(this,t)},d.prototype.getView=function(){return o.processMarkup(d.defaultViewMarkup)},d.setViewUrl=function(t){delete d.prototype.getView,d.prototype.viewUrl=t},d.defaultTitle=e.title||"Application",d.defaultOptions=["Ok"],d.defaultViewMarkup=['<div data-view="plugins/messageBox" class="messageBox">','<div class="modal-header">','<h3 data-bind="text: title"></h3>',"</div>",'<div class="modal-body">','<p class="message" data-bind="text: message"></p>',"</div>",'<div class="modal-footer" data-bind="foreach: options">','<button class="btn" data-bind="click: function () { $parent.selectOption($data); }, text: $data, css: { \'btn-primary\': $index() == 0, autofocus: $index() == 0 }"></button>',"</div>","</div>"].join("\n"),c={MessageBox:d,currentZIndex:1050,getNextZIndex:function(){return++this.currentZIndex},isOpen:function(){return u>0},getContext:function(t){return l[t||"default"]},addContext:function(t,e){e.name=t,l[t]=e;var i="show"+t.substr(0,1).toUpperCase()+t.substr(1);this[i]=function(e,i){return this.show(e,i,t)}},createCompositionSettings:function(t,e){var i={model:t,activate:!1,transition:!1};return e.attached&&(i.attached=e.attached),e.compositionComplete&&(i.compositionComplete=e.compositionComplete),i},getDialog:function(t){return t?t.__dialog__:void 0},close:function(t){var e=this.getDialog(t);if(e){var i=Array.prototype.slice.call(arguments,1);e.close.apply(e,i)}},show:function(e,o,a){var r=this,c=l[a||"default"];return t.defer(function(t){s(e).then(function(e){var a=n.create();a.activateItem(e,o).then(function(n){if(n){var o=e.__dialog__={owner:e,context:c,activator:a,close:function(){var i=arguments;a.deactivateItem(e,!0).then(function(n){n&&(u--,c.removeHost(o),delete e.__dialog__,0===i.length?t.resolve():1===i.length?t.resolve(i[0]):t.resolve.apply(t,i))})}};o.settings=r.createCompositionSettings(e,c),c.addHost(o),u++,i.compose(o.host,o.settings)}else t.resolve(!1)})})}).promise()},showMessage:function(e,i,n){return t.isString(this.MessageBox)?c.show(this.MessageBox,[e,i||d.defaultTitle,n||d.defaultOptions]):c.show(new this.MessageBox(e,i,n))},install:function(t){e.showDialog=function(t,e,i){return c.show(t,e,i)},e.showMessage=function(t,e,i){return c.showMessage(t,e,i)},t.messageBox&&(c.MessageBox=t.messageBox),t.messageBoxView&&(c.MessageBox.prototype.getView=function(){return t.messageBoxView})}},c.addContext("default",{blockoutOpacity:.2,removeDelay:200,addHost:function(t){var e=a("body"),i=a('<div class="modalBlockout"></div>').css({"z-index":c.getNextZIndex(),opacity:this.blockoutOpacity}).appendTo(e),n=a('<div class="modalHost"></div>').css({"z-index":c.getNextZIndex()}).appendTo(e);if(t.host=n.get(0),t.blockout=i.get(0),!c.isOpen()){t.oldBodyMarginRight=e.css("margin-right"),t.oldInlineMarginRight=e.get(0).style.marginRight;var o=a("html"),r=e.outerWidth(!0),s=o.scrollTop();a("html").css("overflow-y","hidden");var l=a("body").outerWidth(!0);e.css("margin-right",l-r+parseInt(t.oldBodyMarginRight,10)+"px"),o.scrollTop(s)}},removeHost:function(t){if(a(t.host).css("opacity",0),a(t.blockout).css("opacity",0),setTimeout(function(){r.removeNode(t.host),r.removeNode(t.blockout)},this.removeDelay),!c.isOpen()){var e=a("html"),i=e.scrollTop();e.css("overflow-y","").scrollTop(i),t.oldInlineMarginRight?a("body").css("margin-right",t.oldBodyMarginRight):a("body").css("margin-right","")}},attached:function(t){a(t).css("visibility","hidden")},compositionComplete:function(t,e,i){var n=c.getDialog(i.model),o=a(t),r=o.find("img").filter(function(){var t=a(this);return!(this.style.width&&this.style.height||t.attr("width")&&t.attr("height"))});o.data("predefinedWidth",o.get(0).style.width);var s=function(){setTimeout(function(){o.data("predefinedWidth")||o.css({width:""});var t=o.outerWidth(!1),e=o.outerHeight(!1),i=a(window).height(),r=Math.min(e,i);o.css({"margin-top":(-r/2).toString()+"px","margin-left":(-t/2).toString()+"px"}),o.data("predefinedWidth")||o.outerWidth(t),e>i?o.css("overflow-y","auto"):o.css("overflow-y",""),a(n.host).css("opacity",1),o.css("visibility","visible"),o.find(".autofocus").first().focus()},1)};s(),r.load(s),o.hasClass("autoclose")&&a(n.blockout).click(function(){n.close()})}}),c});