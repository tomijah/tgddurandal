define(["durandal/app"],function(e){return{footerText:"Sample text",subscription:ko.observable(null),messages:ko.observableArray([]),sub:function(){var t=e.on("event").then(function(e){this.messages.push(e)},this);this.subscription(t)},unsub:function(){this.subscription().off(),this.subscription(null)}}});