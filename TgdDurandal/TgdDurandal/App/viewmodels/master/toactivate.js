define(['plugins/dialog'], function(dialog) {
    var ctor = function (message) {
        this.message = ko.observable(message);
    };
    
    ctor.prototype.canActivate = function () {
        return dialog.showMessage("Are you sure?", "??", ["Yes", "NO"]);
    };

    return ctor;
});