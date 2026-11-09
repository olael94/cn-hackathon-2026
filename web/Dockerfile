FROM node:24-alpine AS build
WORKDIR /web
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_DASH0_ENDPOINT=
ARG VITE_DASH0_AUTH_TOKEN=
RUN pnpm build

FROM nginxinc/nginx-unprivileged:1.29-alpine
ENV BACKEND_URL=http://backend.team-the-mok-team.svc.cluster.local
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /web/dist /usr/share/nginx/html
EXPOSE 8080
