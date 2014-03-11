define(['durandal/app', 'plugins/router', 'durandal/system'], function (app, router, system) {
    router.map([
                { route: '', moduleId: 'viewmodels/home', title: 'Home', nav: true },
                { route: 'about', moduleId: 'viewmodels/about', title: 'About', nav: true },
                { route: 'edit(/:id)', moduleId: 'viewmodels/edit', hash: '#edit', title: 'Edit', nav: true },
                { route: 'master*submodule', moduleId: 'viewmodels/master', hash: '#master', title: 'Master', nav: true }

    ]).buildNavigationModel();
    router.mapUnknownRoutes('viewmodels/not-found', 'not-found');

    return {
        router: router,
        activate: function () {
            return system.defer(function (d) {
                setTimeout(function () {
                    router.activate().then(d.resolve);
                }, 1000);
            });
        }
    };
});