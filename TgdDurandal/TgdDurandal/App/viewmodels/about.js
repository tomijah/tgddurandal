define(['durandal/system', 'durandal/app', 'modals/input', 'plugins/dialog'], function (system, app, InputModal, dialog) {

    var items = ko.observableArray([]);

    return {
        items: items,
        add: function() {
            InputModal.show().then(function(response) {
                items.push(response);
            });
        }
    };
});