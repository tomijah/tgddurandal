define(['durandal/app', 'plugins/router'], function (app, router) {
    var idDisplay = ko.observable();

    return {
        activate: function (id) {
            idDisplay("Id: " + id);
        },
        idDisplay: idDisplay
    };
});