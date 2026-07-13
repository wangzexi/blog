# Stage 1: Generate blog content (sidebar, posts.json, home.md)
FROM python:3.12-alpine AS generator
WORKDIR /app
COPY . .
RUN python3 scripts/generate.py /app \
    && rm -rf scripts Dockerfile

# Stage 2: Vendor browser dependencies into the image.  The reader must not
# depend on a third-party CDN just to render the first page.
FROM node:22-alpine AS frontend-deps
WORKDIR /deps
RUN npm install --no-audit --no-fund docsify@4.13.1 mermaid@11.12.2

# Stage 3: Serve the fully self-contained static site with busybox httpd
FROM busybox:stable
COPY --from=generator /app /usr/share/nginx/html
COPY --from=frontend-deps /deps/node_modules/docsify/lib/docsify.min.js /usr/share/nginx/html/assets/docsify.min.js
COPY --from=frontend-deps /deps/node_modules/docsify/lib/themes/vue.css /usr/share/nginx/html/assets/docsify-vue.css
COPY --from=frontend-deps /deps/node_modules/mermaid/dist /usr/share/nginx/html/assets/mermaid
EXPOSE 80
CMD ["httpd", "-f", "-p", "80", "-h", "/usr/share/nginx/html"]
