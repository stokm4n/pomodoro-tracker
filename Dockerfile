FROM node:24-alpine AS frontend-build

WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.26-alpine AS backend-build

WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.22

RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app/backend

COPY --from=backend-build /out/server ./server
COPY --from=frontend-build /src/frontend/dist /app/frontend/dist
COPY database/migrations /app/database/migrations

ENV PORT=10000
EXPOSE 10000

CMD ["./server"]
