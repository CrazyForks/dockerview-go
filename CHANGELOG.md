# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
