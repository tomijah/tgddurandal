define(['plugins/dialog'], function(dialog) {
    var CustomModal = function() {
        this.input = ko.observable().extend({ required: true });
    };

    CustomModal.prototype.ok = function () {
        var group = ko.validation.group(this);
        group.showAllMessages(true);
        if (this.isValid()) {
            dialog.close(this, this.input());
        }
    };
    
    CustomModal.show = function () {
        return dialog.show(new CustomModal());
    };

    return CustomModal;
})