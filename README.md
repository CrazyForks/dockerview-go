# DockerView-Go

A beautiful terminal-based Docker container monitoring tool built with Go and bubbletea, featuring a gorgeous real-time web dashboard.

## Demo

![DockerView Go Demo](assets/demo.gif)

## Features

- **Real-time Monitoring**: Updates every second.
- **Beautiful TUI**: Built with [bubbletea](https://github.com/charmbracelet/bubbletea) and [lipgloss](https://github.com/charmbracelet/lipgloss) with keybindings for start, stop, restart, and inline logs viewing.
- **Real-Time Web Dashboard**: Enable the HTTP server (`-server`) to broadcast real-time container telemetry using Server-Sent Events (SSE) `/stream` and host a gorgeous glassmorphism web console with live SVG sparkline history, status filters, search highlighting, and 3D hover effects.
- **Web Container Controls**: Start, stop, and restart containers directly from the Web Dashboard.
- **Inline Logs Modal**: Read container logs from TUI or in a clean web modal with auto-scroll and 3-second auto-polling updates (properly demultiplexed to avoid header garbage characters).
- **Token Security**: Secured control API and log endpoints with token verification. Automatically generates secure startup keys, supports guest/read-only mode, and stores session tokens in localStorage.
- **Color-coded Status**: Green for running, red for stopped/exited containers.
- **CPU Alerts**: High CPU usage (>50%) highlighted in red.
- **Auto-detection**: Automatically detects Docker socket (including Unix sockets, WSL, Colima, OrbStack, Podman, Rancher Desktop, etc.).

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

# Set a custom security token
./build/dockerview -server -token my-secret-token
```

Once started, navigate to `http://localhost:8080` (or your custom port) in your web browser to access the interactive web console.

#### Security & Guest View Mode

- **Guest View (Read-Only)**: Anyone can open the dashboard to view real-time telemetry (CPU/Memory loads, network, block I/O) without entering a token.
- **Authenticated Controls (Admin)**: Modifying actions (Start, Stop, Restart) and viewing container Logs are protected and require a security token.
- **Token Management**:
  - If no token is specified via the `-token` flag or the `DOCKERVIEW_TOKEN` environment variable, a 16-byte random hex token is securely generated on startup and printed in the console.
  - When clicking an admin action or logs for the first time, a secure input overlay modal will appear. Once entered, the token is saved in the browser's `localStorage`.
  - Visiting the dashboard via the auto-generated URL `http://localhost:8080/?token=<token>` automatically authenticates your session and cleans up the address bar for clean sharing.

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
│   ├── server.go             # Server logic & API endpoints
│   └── web/                  # Web Embed Directory
│       └── dist/             # Precompiled React UI assets (embedded automatically)
├── frontend/                 # React + TypeScript Frontend Application
│   ├── src/                  # React source files (App.tsx, index.css, main.tsx, etc.)
│   ├── index.html            # Vite template index file
│   ├── vite.config.ts        # Vite build configurations (generates output in internal/server/web)
│   └── package.json          # Node modules, Tailwind v4 and React dependencies
├── .github/                  # CI/CD
├── Makefile                  # Build commands (automatically runs build-ui when building Go)
├── go.mod/go.sum             # Go modules
└── README.md                 # This file
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Author

[Suroy](https://suroy.cn)
