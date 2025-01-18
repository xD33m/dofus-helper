FROM node:20-alpine as build
WORKDIR /server
COPY ./package*.json ./
RUN npm install --no-audit
COPY ./ ./
RUN npm run build
RUN rm -rf node_modules


FROM arm64v8/node:20-alpine
LABEL name="dofus-helper"
WORKDIR /server

# Install dotenvx
RUN apk --no-cache add curl
RUN curl -fsS https://dotenvx.sh/ | sh

COPY ./package*.json ./
RUN npm ci --omit=dev
COPY --from=build /server/dist ./src
RUN npm install pm2 -g
EXPOSE 3000
CMD ["pm2-runtime", "src/index.js", "--node-args='--es-module-specifier-resolution=node'"]