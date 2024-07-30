// window.wrapper.js

const create_proxied_window = function(window) {
    const extra_overwrite = [
        "window", "self", "top", "parent", "open",
        "document", "navigator", "history", "SharedWorker" 
    ];

    const window = create_proxied_web_object(window, extra_overwrite);
}