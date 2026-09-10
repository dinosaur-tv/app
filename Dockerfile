FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html landing.css control-state.js event-cue.js config.js /usr/share/nginx/html/
COPY console /usr/share/nginx/html/console
COPY tv /usr/share/nginx/html/tv
COPY assets /usr/share/nginx/html/assets
