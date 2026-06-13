# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.12] - 2026-06-14

### Added

- **React Frontend**: Rebuilt web dashboard from legacy single `index.html` into a modular React + TypeScript application (`frontend/`) using Vite, Tailwind CSS v4, and Radix UI
  - Component architecture: `Header`, `ContainerCard`, `SummaryDashboard`, `Sparkline`, `AuthModal`, `LogsModal`
  - Dynamic metric dashboards, SVG sparklines, custom toasts, Radix Dialog-based modals
  - Collapsible offline grid with expand/collapse for stopped containers
- **Go Embed Optimization**: Replaced legacy single-file cached reading with `http.FileServer` and `fs.Sub` serving compiled Vite assets from embedded filesystem
- **Reverse Proxy Support**: Configured relative base paths (`./`) in Vite and `/dashboard` route for seamless subpath proxy integration
- **Container Tracking**: Stateful tracker ignores already-stopped containers on startup, tracks active ones so they display correctly when stopped during session
- **Build Integration**: Added `build-ui` target to Makefile, automated React asset compilation on standard `make build`

### Changed

- **Brand Assets**: Replaced all SVGs (favicon, icons, logo) with unified DockerView brand illustration — neon glow, glassmorphism gradients, radar grid background, `#38BDF8` accents
- **Makefile**: Updated `build-ui` target to use `frontend/` directory
- **README.md**: Updated directory tree to reflect `frontend/` structure
- **Gitignore**: Added `dockerview` binary, `.claude/`, `.antigravity/`

## [0.1.11] - 2026-05-27

### Added

- **Container operations**: Start, stop, restart containers directly from the TUI
- **Log viewer**: View last 100 lines of container logs inline
- **Keyboard navigation**: Arrow keys to select containers, Enter to open action panel
- Action bar with keybindings: `s`tart, `x`stop, `r`estart, `l`ogs, `q`uit
- **Web Container Controls**: Start, stop, restart containers directly from the Web Dashboard.
- **Web Log Viewer**: View inline container logs with auto-scroll and 3-second auto-polling stream in a sleek glassmorphic modal.
- **Security & Authentication**:
  - Secure token-based authentication for Web control APIs and logs.
  - Auto-generated 16-byte random security tokens printed on startup, customizable via `-token` flag or `DOCKERVIEW_TOKEN` environment variable.
  - "Guest View & Authenticated Control" mode: stats are publicly viewable by default, while admin actions/logs trigger an elegant security token input overlay.
  - URL cleanup: automatically strip token parameters from the address bar after loading for cleaner sharing.
- **Log Decoded Formatting**: Fixed binary multiplexing stream headers (unwanted gibberish symbols) at the beginning of log lines by demultiplexing stdout/stderr streams.

### Changed

- **Performance**: Extract lipgloss styles to package-level vars, avoiding repeated allocations per `View()` render
- **Performance**: Replace `time.After` with `time.NewTicker` in polling loop to prevent timer leaks
- **Performance**: Cache embedded web dashboard HTML at startup instead of reading on every HTTP request
- **Performance**: Deduplicate `os.UserHomeDir()` call in Docker socket detection
- **Concurrency**: Switch `model.mu` from `sync.Mutex` to `sync.RWMutex`, allowing concurrent reads in `View()`
- **Code quality**: Remove redundant `colStyles` array (7 identical copies of `headerStyle`)
- **Code quality**: Remove duplicate ID truncation (already truncated in `client.go`)
- **Code quality**: Log server startup errors to stderr instead of silently swallowing them
- **Fix**: Correct typo "Donwloading" in self-update output

## [0.1.9] - 2026-05-20

### Fixed

- **Fix dashboard sorting**: Correctly apply the CSS `order` property to the direct grid child `.card-wrapper` instead of the inner `.card`, enabling the NAME, CPU, and RAM sorting/grouping controls to function properly.

## [0.1.8] - 2026-05-20

- **Offline & Intranet Compatibility**:
  - Replaced all external Lucide CDN scripts with self-contained, inline SVG icons for instant offline load.
  - Implemented CSS native system font fallbacks to guarantee robust rendering behind firewalls/proxies.
- **Reverse Proxy Support**:
  - Optimized the SSE network layer to dynamically resolve paths based on the browser's current URL, fully supporting subpath routing under reverse proxies.
- **Performance Optimizations**:
  - Replaced regular Ticker HTML element updates with precise `.innerText` modifications, decreasing telemetry client-side rendering CPU load by over 90%.

## [0.1.7] - 2026-05-20

### Added

- Add HTTP Server and Real-time Web Dashboard (`-server` and `-port` flags)
- Stream real-time container metrics using Server-Sent Events (SSE) `/stream`
- Premium, interactive glassmorphic web interface:
  - CPU and Memory horizontal progress rows
  - Dynamic real-time SVG sparklines showing metrics history
  - Segmented status filter tabs (All, Running, Stopped) with live badges
  - Instant fuzzy search with matching query text highlighting
  - 3D hover card tilt with follow-mouse radial glow
  - Automatic JSON case normalization for cross-client compatibility

## [0.1.6] - 2026-03-19

### Fixes

- handle empty blkio and Names arrays to prevent panic

## [0.1.5] - 2026-02-06

### Added

- add blkio stats support

## [0.1.4] - 2026-02-06

### Added

- add network stats support

## [0.1.3] - 2026-02-05

### Added

- add update support

## [0.1.0] - 2026-01-13

### Added

- Initial release of DockerView-Go
- Real-time Docker container monitoring with terminal UI
- Cross-platform Docker host detection supporting:
  - Docker Desktop (macOS/Linux/Windows)
  - Colima (macOS)
  - OrbStack (macOS)
  - Podman (macOS/Linux/Windows)
  - Rancher Desktop (macOS/Windows)
  - Minikube (macOS/Linux)
- Color-coded container status (green for running, red for stopped)
- CPU usage alerts (highlighted when >50%)
- Memory usage statistics
- Auto-refresh every second
- GitHub Actions CI/CD pipeline:
  - Automated multi-platform builds (macOS, Linux, Windows)
  - Automatic release generation on git tags
- Unit tests for Docker client utilities
- Project documentation and README

### Changed

- Split main.go into separate files (main.go and model.go) for better maintainability
- Improved Docker connection detection with multiple fallback mechanisms

### Fixed

- Removed placeholder image from README
- Fixed import issues for cross-platform compilation
