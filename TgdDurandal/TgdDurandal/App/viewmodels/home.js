define(['durandal/system', 'plugins/router'], function (system, router) {
    return {
        canActivate: function() {
            system.log('canActivate');
            return true;
        },
        activate: function() {
            system.log('activate');
        },
        binding: function(view) {
            system.log('binding');
        },
        bindingComplete: function(view) {
            system.log('bindingComplete');
        },
        attached: function(view, parent) {
            system.log('attached');
        },
        compositionComplete: function(view, parent) {
            system.log('compositionComplete');
        },
        canDeactivate: function() {
            system.log('canDeactivate');
            return true;
        },
        deactivate: function() {
            system.log('deactivate');
        },
        detached: function(view, parent) {
            system.log('detached');
        },
        go: function() {
            router.navigateBack();
        }
    };
});