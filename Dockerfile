# Stage 1: build
FROM node:18 AS builder
WORKDIR /app
COPY CalculateService/package*.json ./
RUN npm install --legacy-peer-deps
COPY CalculateService/ ./
RUN npm run build

# Stage 2: runtime
FROM node:20 AS runner
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "start"]

