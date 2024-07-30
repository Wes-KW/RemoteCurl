// worker.wrapper.js

const create_proxied_worker = function(worker) {
    const extra_overwrite = [
        "self", "location", "importScripts"
    ];

    const worker = create_proxied_web_object(worker, extra_overwrite);
}