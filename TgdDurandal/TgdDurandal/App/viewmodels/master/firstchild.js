define(['durandal/activator', './toactivate', 'plugins/dialog', 'modals/input'], function(activator, ToActivate, dialog, InputModal) {
    return {
        currentView: activator.create(),
        activateView: function () {
            var self = this;
            dialog.show(new InputModal()).then(function(input) {
                self.currentView.activateItem(new ToActivate(input));
            });
        }
    };
});