# NGINX and collaboration

Board contents use HTTP requests for the durable update log. Logged-in clients
also use Server-Sent Events (SSE) to learn when to fetch updates; periodic polling
recovers missed notifications. Live cursors and presence use WebSockets.

The Community app container already configures its internal NGINX for these
transports. An additional reverse proxy in front of host port `5174` must also
allow streaming and WebSocket upgrades.

## NGINX Proxy Manager

Use the Proxy Host UI rather than pasting a complete `server` or `location`
block into its Advanced field:

1. Set the forwarding scheme to `http`, the address to the Skedra host, and the
   port to `5174` (or your published app port).
2. Enable **Websockets Support**, disable **Cache Assets**, and configure your
   certificate and **Force SSL** in the SSL tab.
   Enable **HTTP/2 Support** on the public HTTPS listener, especially when
   opening several board tabs. The upstream can still use HTTP/1.1.
3. In **Advanced**, use only these additional directives. Remove previously
   added `map`, `location`, and duplicate `proxy_set_header` directives from
   that field; keep unrelated settings that your installation needs.

```nginx
client_max_body_size 100m;
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

NGINX Proxy Manager generates the upstream and WebSocket headers for its
location. Its Advanced field is inside `server`, where `map` is not valid.
Do not paste the plain-NGINX example below into that field. Check the generated
configuration with `nginx -t` inside the NGINX Proxy Manager container if saving
the host fails. When using existing custom locations, check their effective
settings too; location-level directives can override server-level settings.

## Plain NGINX

Add this map in the NGINX `http` context, outside the `server` block:

```nginx
map $http_upgrade $skedra_connection_upgrade {
    default upgrade;
    '' close;
}
```

In the existing server block that serves Skedra, use the following API location.
Adjust the upstream address if Skedra runs on another host or Docker network.
Keep the existing HTTPS configuration and frontend routing.

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:5174;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $skedra_connection_upgrade;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    client_max_body_size 100m;
}
```

Setting `Connection ""` for WebSocket requests prevents the required upgrade.
Setting a *request* header with `proxy_set_header Cache-Control ...` does not
disable NGINX's response cache; use `proxy_cache off` on the API location. The
API also sends `Cache-Control: private, no-store` for tRPC and REST update reads.

## Diagnosing failed sync requests

Check the browser's Network panel:

- `/api/boards/<id>/live` should remain open and receive `ready` followed by
  `ping` or `update` events. Share-link guests use polling instead.
- `/api/boards/<id>/presence` should receive HTTP `101` for logged-in users.
- `whiteboard.listServerUpdates` or `whiteboard.listE2eeUpdates` should return
  fresh responses after a second client edits. Failed append requests indicate
  that local changes have not yet reached the server.

- **HTML instead of JSON:** inspect the failed request's HTTP status and
  response headers. A proxy can return an HTML error page before the request
  reaches Skedra. HTTP `413` indicates a request-size limit; `502`/`503`/`504`
  point to upstream availability or timeout problems. HTML with HTTP `200`
  suggests incorrect routing or a redirect, such as to a login page.
- **HTTP `413`:** the body-size limit must allow the request at *every* hop.
  Skedra v0.1.37 shipped without an explicit internal NGINX limit, leaving
  NGINX's 1 MB default in effect even if the outer proxy allowed `100m`.
  Server sync batches can exceed 3 MB after base64 encoding. The internal API
  locations now allow `100m`; application payload validation still applies.
- **HTTP `405` on `appendServerUpdate`:** writes require `POST`. Opening the
  URL in the address bar sends `GET`, so that alone is not evidence of a sync
  defect. For an actual failed app request, inspect its method and redirect
  chain. `301`/`302`/`303` can turn a `POST` into `GET`. Prefer the final HTTPS
  API origin directly; redirects that must preserve writes need `307`/`308`.
  For a same-origin deployment, leave `SKEDRA_PUBLIC_FRONTEND_API_URL` empty
  in both the standalone and split-container images. The browser-visible
  `/config.js` should then contain an empty `API_URL` value.
- **"The operation timed out" / "signal timed out":** sync requests have a
  30-second client deadline, including the response body. Raising only NGINX's
  timeout does not change it. Check whether the request is queued/stalled in
  the browser, waiting for response headers, or downloading a stalled body,
  and correlate its time with proxy and API logs. With HTTP/1.1 and several
  open board tabs, long-lived SSE connections can also occupy connection
  slots; compare with a single tab or HTTP/2 enabled at the outer HTTPS proxy.
  In a Chrome reproduction with six open board SSE connections, a sync write
  timed out after 30 seconds over HTTP/1.1; the same test passed over HTTP/2.
  This is a diagnostic condition, not proof that every timeout has this cause.

When reporting a problem, include the image tag and standalone/split-container
setup, board encryption mode, and the failed app request's method, HTTP status,
content type, timing, and redirect statuses. Include matching proxy/API log
errors, but omit cookies, input query strings, share tokens, and encryption keys.
Keep browser site data intact while edits are pending: it contains the local
retry queue.

Sources: [NGINX WebSocket proxying](https://nginx.org/en/docs/http/websocket.html)
and [NGINX proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html),
[NGINX request-size limit](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size),
[HTTP redirects](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Redirections),
and [NGINX Proxy Manager's host template](https://github.com/NginxProxyManager/nginx-proxy-manager/blob/develop/backend/templates/proxy_host.conf).
