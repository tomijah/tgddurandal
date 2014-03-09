define(['durandal/app', 'plugins/router'], function(app, router) {
    return {
        router: router,
        activeTitle: ko.computed(function() {
            var current = _.find(router.navigationModel(), function(item) {
                return item.isActive();
            });

            return current ? current.title : '';
        }),
        activate: function () {
            router.map([
                { route: '', moduleId: 'viewmodels/home', title: 'Home', nav: true },
                { route: 'about', moduleId: 'viewmodels/about', title: 'About', nav: true }
            ]).buildNavigationModel();

            return router.activate();
        }
    };
});