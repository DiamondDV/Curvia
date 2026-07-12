FROM node:20-slim

# VTracer binary — the only non-npm dependency
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -L https://github.com/visioncortex/vtracer/releases/download/0.6.3/vtracer-linux-x86_64 \
       -o /usr/local/bin/vtracer \
    && chmod +x /usr/local/bin/vtracer \
    && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Sharp uses prebuilt binaries — no compilation needed
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production
ENV TEMP_DIR=/tmp
CMD ["node", "server.js"]
