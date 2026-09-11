FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

# Vite replaces every import.meta.env.VITE_* reference at build time, so these
# values must be baked in during `npm run build`, not injected at runtime.
# They are passed from docker-compose as build args (see docker-compose.yml).
ARG VITE_API_BASE_URL
ARG VITE_CONTAINER_IDS
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_CONTAINER_IDS=$VITE_CONTAINER_IDS

COPY . .
RUN npm run build

EXPOSE 3000
# vite preview serves the compiled dist/ folder.
# --host binds to 0.0.0.0 so Docker's port-mapping exposes it on the host.
CMD ["npx", "vite", "preview", "--port", "3000", "--host"]
