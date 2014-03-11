define(['durandal/app'], function(app) {
    return {
        footerText: 'Sample text',
        subscription: ko.observable(null),
        messages: ko.observableArray([]),
        sub: function() {
            var s = app.on('event').then(function(eventData) {
                this.messages.push(eventData);
            }, this);

            this.subscription(s);
        },
        unsub: function() {
            this.subscription().off();
            this.subscription(null);
        }
    };
});