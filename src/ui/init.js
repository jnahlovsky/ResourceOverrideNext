(function() {
    "use strict";

    /* globals $ */

    const ui = {};

    function initUI() {
        // pre-fetch all major ui.
        $("[id]").each(function(idx, el) {
            ui[el.id] = $(el);
        });

        // Ensure app object exists
        window.app = window.app || {};
        window.app.ui = ui;
    }

    // Expose init function
    window.initLegacyUI = initUI;
})();
