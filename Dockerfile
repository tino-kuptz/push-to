# Build stage
# 1) install node
# 2) install all dependencies
# 3) copy source code
# 4) run webpack build
# Webpack will exclude native modules. As npm install will only
# be rune once in multi platform build, we dont install production dependencies here
FROM node:22-alpine3.22 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Release stage
# 1) install node + npm
# 2) copy dist from builder stage
# 3) install production dependencies
#    --> this will be done here so the correct architecture is used
# 4) set working directory to /drone/src
# 5) set default command to run node with index.js
FROM node:22-alpine3.22 AS release

COPY --from=builder /app/start.sh /home/node
RUN chmod +x /home/node/start.sh

WORKDIR /home/node
COPY --from=builder /app/dist/package.json /home/node
RUN npm install && npm install -g pino-pretty

COPY --from=builder /app/dist /home/node

WORKDIR /drone/src
CMD ["/home/node/start.sh"]