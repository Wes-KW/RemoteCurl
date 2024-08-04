// worker.wrapper.js

const create_proxied_worker = function(_worker) {
    const extra_overwrite = [
        "self", "location", "importScripts"
    ];

    const worker = create_proxied_web_object(_worker, extra_overwrite);
}