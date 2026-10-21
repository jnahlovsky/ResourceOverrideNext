/* global bgapp, chrome */
{
    bgapp.util = {};

    bgapp.util.simpleError = function(err) {
        if (err.stack) {
            console.error("=== Printing Stack ===");
            console.error(err.stack);
        }
        console.error(err);
    };
}
