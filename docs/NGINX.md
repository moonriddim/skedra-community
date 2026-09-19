# NGINX and collaboration

Board contents use HTTP requests for the durable update log. Logged-in clients
also use Server-Sent Events (SSE) to learn when to fetch updates; periodic polling
recovers missed notifications. Live cursors and presence use WebSockets.

The Community app container already configures its internal NGINX for these
transports. An additional reverse proxy in front of host port `5174` must also
allow streaming and WebSocket upgrades.

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

To diagnose a connection, check the browser's Network panel:

- `/api/boards/<id>/live` should remain open and receive `ready` followed by
  `ping` or `update` events. Share-link guests use polling instead.
- `/api/boards/<id>/presence` should receive HTTP `101` for logged-in users.
- `whiteboard.listServerUpdates` or `whiteboard.listE2eeUpdates` should return
  fresh responses after a second client edits. Failed append requests indicate
  that local changes have not yet reached the server.

Sources: [NGINX WebSocket proxying](https://nginx.org/en/docs/http/websocket.html)
and [NGINX proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).
