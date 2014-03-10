define(['durandal/app', 'plugins/router'], function(app, router) {
    return {
        router: router,
        activate: function () {
            router.map([
                { route: '', moduleId: 'viewmodels/home', title: 'Home', nav: true },
                { route: 'about', moduleId: 'viewmodels/about', title: 'About', nav: true },
                { route: 'edit(/:id)', moduleId: 'viewmodels/edit', hash: '#edit', title: 'Edit', nav: true }
            ]).buildNavigationModel();

            router.mapUnknownRoutes('viewmodels/not-found', 'not-found');
            
            return router.activate();
        }
    };
});