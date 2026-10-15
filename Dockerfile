# ==============================================================================
# Dockerfile - Multi-stage build cho "Cô Dương dạy văn dễ thương"
# Đóng gói hoàn chỉnh Frontend (React + Vite) và Backend (Node.js + Express)
# ==============================================================================

# STAGE 1: Build Frontend & Backend
FROM node:22-alpine AS builder

WORKDIR /app

# Sao chép package manifests
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Cài đặt toàn bộ dependencies (bao gồm devDependencies cho TypeScript & Vite)
RUN npm run install:all

# Sao chép toàn bộ source code
COPY . .

# Build frontend (tạo frontend/dist) và backend (tạo backend/dist)
RUN npm run build

# STAGE 2: Runtime Production Image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Cài đặt chỉ production dependencies cho backend
COPY backend/package*.json ./
RUN npm install --omit=dev

# Sao chép artifacts đã build
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# Tạo thư mục tạm an toàn cho uploads
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node

EXPOSE 4000

CMD ["node", "dist/index.js"]
