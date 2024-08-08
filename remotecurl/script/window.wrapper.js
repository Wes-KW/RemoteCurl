// window.wrapper.js

const get_proxied_window = function(_window) {
    try{
        if ("__env__" in _window) {
            return _window["__env__"];
        } else {
            return _window;
        }
    } catch {
        return _window;
    }
}

const create_proxied_document = function(window, _document) {
    const document = create_proxied_event_obj(_document, ["location"]);
    
    let location = window.location;
    set_obj_prop_desc(document, "location", {
        enumerable: true,
        configurable: false,
        get: function() {
            return location;
        },
        set: function(value) {
            return location = value;
        }
    });

    set_obj_prop_desc(document.documentElement, "parentNode", {
        enumerable: true,
        configurable: true,
        get: function(){
            return document;
        },
    });
    return document;
}

const create_proxied_window = function(_window) {
    const extra_overwrite = [
        "window", "self", "parent", "top", "open",
        "document", "navigator", "history", "SharedWorker" 
    ];

    const window = create_proxied_web_object(_window, extra_overwrite);
    const func_reg = {};

    // # self
    proxy_prop(_window, window, "self", _window, window, func_reg);

    // # parent AND top
    for (let item of ["parent", "top"]) {
        if (_window[item] === _window.self) {
            proxy_prop(_window, window, item, _window, window, func_reg);
        } else {
            proxy_prop(_window, window, item, _window[item], get_proxied_window(_window[item]), func_reg);
        }
    }

    // # open
    
}