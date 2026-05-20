# DockerView-Go

A beautiful terminal-based Docker container monitoring tool built with Go and bubbletea.

## Features

- **Real-time Monitoring**: Updates every second
- **Beautiful UI**: Built with [bubbletea](https://github.com/charmbracelet/bubbletea) and [lipgloss](https://github.com/charmbracelet/lipgloss)
- **Color-coded Status**: Green for running, red for stopped/exited containers
- **CPU Alerts**: High CPU usage (>50%) highlighted in red
- **Auto-detection**: Automatically detects Docker socket (including Colima)
- **Web Dashboard**: Enable the HTTP server (`-server`) to broadcast real-time container telemetry using Server-Sent Events (SSE) `/stream` and host a gorgeous glassmorphism web console with live SVG sparkline history, status filters, search highlighting, and 3D hover effects.

## Requirements

- Go 1.21+
- Docker daemon running
- Terminal with true color support (recommended)

## Installation

### Using `go install`

```bash
go install github.com/zsuroy/dockerview-go/cmd/dockerview@latest
```

Make sure `$GOPATH/bin` (or `$HOME/go/bin`) is in your `PATH`.

### From Source

```bash
git clone https://github.com/zsuroy/dockerview-go.git
cd dockerview-go
make build
./build/dockerview
```

### Quick Run

```bash
go run ./cmd/dockerview/
```

## Usage

```bash
./dockerview
```

Press `Ctrl+C` to exit the application.

### Web Dashboard & Server Mode

You can run `dockerview` with an HTTP server enabled to view a real-time web dashboard from any browser:

```bash
# Enable HTTP server on default port 8080
./build/dockerview -server

# Customize the HTTP server port (e.g. 8023)
./build/dockerview -server -port 8023
```

Once started, navigate to `http://localhost:8080` (or your custom port) in your web browser to access the interactive web console.

### Docker Socket

DockerView-Go automatically detects Docker sockets:

- Standard Docker socket (`/var/run/docker.sock`)
- Colima (`~/.colima/default/docker.sock`)
- Custom socket via `DOCKER_HOST` environment variable

```bash
DOCKER_HOST=unix:///path/to/docker.sock ./dockerview
```

## Build Commands

```bash
make build      # Build binary to ./build/dockerview
make install    # Install to $GOPATH/bin
make test       # Run tests
make fmt        # Format code
make vet        # Run go vet
make deps       # Download and tidy dependencies
make release    # Build for all platforms (macOS, Linux, Windows)
make run        # Build and run
make clean      # Clean build directory
```

## Project Structure

```txt
dockerview-go/
├── cmd/dockerview/           # Main application
│   ├── main.go               # Entry point
│   ├── model.go              # TUI model
│   ├── update.go             # Self-update
│   ├── utils.go              # Utilities
│   └── version.go            # Version info
├── internal/docker/          # Docker client
│   ├── client.go             # Docker API client
│   └── client_test.go        # Tests
├── internal/server/          # HTTP & SSE Server
│   ├── server.go             # SSE connection broadcaster and server logic
│   └── web/                  # Web Assets
│       └── index.html        # Embedded Premium Web Dashboard UI/UX
├── .github/                  # CI/CD
├── Makefile                  # Build commands
├── go.mod/go.sum             # Go modules
└── README.md                 # This file
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Author

[Suroy](https://suroy.cn)
