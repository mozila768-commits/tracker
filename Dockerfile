# --- 1. сборка сайта (React/Vite) ---
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npx vite build

# --- 2. сборка Go-сервера ---
FROM golang:1.25-alpine AS build
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -o /tracker-server ./cmd/server

# --- 3. итоговый образ ---
FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata
ENV ADDR=:10000
ENV STATIC_DIR=/static
ENV TZ=Asia/Bishkek
EXPOSE 10000
COPY --from=build /tracker-server /tracker-server
COPY --from=web /web/dist /static
USER nobody
CMD ["/tracker-server"]
