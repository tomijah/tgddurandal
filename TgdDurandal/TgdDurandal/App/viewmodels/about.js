define(['durandal/system', 'durandal/app'], function (system, app) {
    var view = function () {
        var self = this;

        self.activate = function () {
            return system.defer(function (d) {
                setTimeout(d.resolve, 1000);
            }).promise();
        };

        self.canDeactivate = function() {
            return app.showMessage('Are you sure you want to leave this page?', 'Navigate', ['Yes', 'No']);
        };
    };

    return view;
});