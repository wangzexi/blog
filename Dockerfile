# Stage 1: Compile Markdown and Astro templates to static HTML.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# Stage 2: Serve the self-contained static output with BusyBox httpd.
FROM busybox:stable
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["httpd", "-f", "-p", "80", "-h", "/usr/share/nginx/html"]
