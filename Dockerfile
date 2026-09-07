FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.js control-state.js style.css manifest.webmanifest /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
COPY tv /usr/share/nginx/html/tv
