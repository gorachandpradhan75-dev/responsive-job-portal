# ---- Stage 1: build the React frontend ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: run the API (serves the built frontend too) ----
FROM node:22-alpine
ENV NODE_ENV=production PORT=5000 DATABASE_PATH=/data/jobportal.db
WORKDIR /app
COPY backend ./backend
COPY --from=build /app/dist ./dist
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 5000
# JWT_SECRET must be supplied at runtime:  docker run -e JWT_SECRET=... -p 5000:5000 -v jobportal-data:/data <image>
CMD ["node", "--disable-warning=ExperimentalWarning", "backend/src/server.js"]
