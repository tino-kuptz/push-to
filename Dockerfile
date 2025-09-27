# Build stage
# 1) install node
# 2) install all dependencies
# 3) copy source code
# 4) run webpack build
# 5) install production dependencies
FROM alpine:latest AS builder
RUN apk add --no-cache nodejs npm
WORKDIR /app
COPY package*.json ./
RUN npm install --development
COPY . .
RUN npm run build
WORKDIR /app/dist
RUN npm install

# Release stage
# 1) install node
# 2) add node user
# 3) copy dist from builder stage
# 4) set working directory to /drone/src
# 5) set default command to run node with index.js
FROM alpine:latest AS release
RUN apk add --no-cache nodejs npm
RUN addgroup -g 1000 node && \
    adduser -D -s /bin/sh -u 1000 -G node node

COPY --chown=node:node --from=builder /app/dist .

USER node
WORKDIR /drone/src
CMD ["node", "/home/node/index.js"]
