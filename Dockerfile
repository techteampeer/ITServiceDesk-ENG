# ==========================================
# Etapa 1: Compilar el Frontend (React) | MVP
# ==========================================
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ==========================================
# Etapa 2: Configurar el Backend (Node.js)
# ==========================================
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --only=production
COPY backend/ ./

# Copiar los archivos estáticos de React al entorno de Node.js
# (Asegúrate de que tu backend use: app.use(express.static('public')))
COPY --from=frontend-builder /app/frontend/dist ./public

EXPOSE 8787
ENV PORT=8787
ENV NODE_ENV=production

CMD ["node", "server.js"]