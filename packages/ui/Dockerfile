FROM node:26-alpine AS build
RUN apk add --no-cache git
WORKDIR /app
COPY packages/ui/package.json packages/ui/package-lock.json /app/packages/ui/
COPY packages/shared /app/packages/shared
WORKDIR /app/packages/ui
RUN npm ci
COPY packages/ui /app/packages/ui
ARG VITE_API_BASE_URL=http://localhost:4010
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:alpine
COPY packages/ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/ui/dist /usr/share/nginx/html
EXPOSE 80
