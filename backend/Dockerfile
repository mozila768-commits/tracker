FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /tracker-server ./cmd/server

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
ENV ADDR=:8080
ENV STATIC_DIR=/static
ENV TZ=Asia/Bishkek
EXPOSE 8080
COPY --from=build /tracker-server /tracker-server
USER nobody
CMD ["/tracker-server"]
