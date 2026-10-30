FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV VITE_DEMO_TOOLS=false
ENV VITE_API_URL=
ARG VITE_BRAND=sambung
ENV VITE_BRAND=${VITE_BRAND}
RUN npm run build:client

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
