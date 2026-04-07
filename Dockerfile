FROM node:lts-alpine AS build
ARG VITE_CALDAV_USERNAME
ENV VITE_CALDAV_USERNAME=$VITE_CALDAV_USERNAME
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1
