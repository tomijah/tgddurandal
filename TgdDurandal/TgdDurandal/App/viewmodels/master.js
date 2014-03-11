define(['plugins/router', 'durandal/app'], function(router, app) {
    var childRouter = router.createChildRouter()
        .makeRelative({
            fromParent: true
        }).map([
            { route: '', moduleId: 'viewmodels/master/firstchild', title: 'First child', nav: true },
            { route: 'secondchild', moduleId: 'viewmodels/master/secondchild', title: 'Second child', nav: true }
        ]).buildNavigationModel();
    
    return {
        router: childRouter
    };
});