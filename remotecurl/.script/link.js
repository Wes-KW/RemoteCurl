// link.js

window.onload = function(){
    var element_set = [
        {"class": HTMLImageElement, "property": "src"},
        {"class": HTMLScriptElement, "property": "src"},
        {"class": HTMLInputElement, "property": "src"},
        {"class": HTMLEmbedElement, "property": "src"},
        {"class": HTMLVideoElement, "property": "src"},
        {"class": HTMLAudioElement, "property": "src"},
        {"class": HTMLSourceElement, "property": "src"},
        {"class": HTMLTrackElement, "property": "src"},
        {"class": HTMLIFrameElement, "property": "src"},
        {"class": HTMLLinkElement, "property": "href"},
        {"class": HTMLAnchorElement, "property": "href"},
        {"class": HTMLBaseElement, "property": "href"},
        {"class": HTMLAreaElement, "property": "href"},
    ];

    for(var i = 0; i < element_set.length; i++) {
        const element = element_set[i];
        Object.defineProperty(
            element["class"].prototype, element["property"], {
                enumerable: true,
                configurable: true,
                get: function() {
                    return this.getAttribute(element["property"]);
                },
                set: function(value) {
                    var new_value = get_absolute_path(value);
                    log(element["class"].name + "." + element["property"], value, new_value);
                    this.setAttribute(element["property"], new_value);
                }
            }
        );
    }
}
