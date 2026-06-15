# Stage 1: Generate blog content (sidebar, posts.json, home.md)
FROM python:3.12-alpine AS generator
WORKDIR /app
COPY . .
RUN python3 scripts/generate.py /app \
    && rm -rf scripts Dockerfile

# Stage 2: Serve with busybox httpd
FROM busybox:stable
COPY --from=generator /app /usr/share/nginx/html
EXPOSE 80
CMD ["httpd", "-f", "-p", "80", "-h", "/usr/share/nginx/html"]
