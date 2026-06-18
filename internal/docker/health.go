package docker

import (
	"math"
	"time"
)

// HealthStatus represents the health level of a container.
type HealthStatus string

const (
	HealthStatusHealthy   HealthStatus = "healthy"
	HealthStatusWarning   HealthStatus = "warning"
	HealthStatusDangerous HealthStatus = "dangerous"
)

// HealthScoreThresholds defines the score boundaries for health status levels.
const (
	HealthyThreshold = 80
	WarningThreshold = 50
	MaxHealthScore   = 100
	MinHealthScore   = 0
)

// HealthWeights defines the weight of each dimension in the total score (sum = 100).
const (
	WeightCPU     = 20
	WeightMemory  = 20
	WeightDiskIO  = 15
	WeightNetwork = 15
	WeightRestart = 15
	WeightUptime  = 15
)

// Health thresholds for each dimension.
const (
	// CPU thresholds (percentage)
	CPUNormalMax  = 50.0
	CPUWarningMax = 80.0

	// Memory thresholds (percentage)
	MemoryNormalMax  = 50.0
	MemoryWarningMax = 80.0

	// Disk IO thresholds (bytes per second) - total read+write
	DiskIONormalMax  = 50 * 1024 * 1024  // 50 MB/s
	DiskIOWarningMax = 200 * 1024 * 1024 // 200 MB/s

	// Network thresholds (bytes per second) - total rx+tx
	NetworkLowThreshold = 1024              // 1 KB/s (too low for active containers)
	NetworkNormalMax    = 100 * 1024 * 1024 // 100 MB/s
	NetworkWarningMax   = 500 * 1024 * 1024 // 500 MB/s

	// Restart count thresholds
	RestartPenaltyPerCount = 5 // points deducted per restart

	// Uptime thresholds (seconds)
	UptimeStable   = 3600 // 1 hour - fully stable
	UptimeModerate = 600  // 10 minutes
	UptimeMinimal  = 60   // 1 minute
)

// HealthResult holds the computed health score and status.
type HealthResult struct {
	Score     int
	Status    HealthStatus
	Breakdown HealthBreakdown
}

// HealthBreakdown contains scores for each dimension for debugging/display.
type HealthBreakdown struct {
	CPU     int
	Memory  int
	DiskIO  int
	Network int
	Restart int
	Uptime  int
}

// CalculateHealthScore computes a 0-100 health score from container metrics.
//
// Parameters:
//   - cpuPercent: current CPU usage percentage (0-100+)
//   - memoryPercent: current memory usage percentage (0-100+)
//   - diskIOBytesPerSec: average disk IO rate (read + write) in bytes per second
//   - networkBytesPerSec: average network rate (rx + tx) in bytes per second
//   - restartCount: number of times the container has restarted
//   - uptimeSeconds: how long the container has been running in seconds
//   - isRunning: whether the container is currently running
//
// Returns a HealthResult with score clamped to [0, 100] and corresponding status.
func CalculateHealthScore(
	cpuPercent, memoryPercent float64,
	diskIOBytesPerSec, networkBytesPerSec float64,
	restartCount int,
	uptimeSeconds float64,
	isRunning bool,
) HealthResult {
	if !isRunning {
		return HealthResult{
			Score:  MinHealthScore,
			Status: HealthStatusDangerous,
		}
	}

	breakdown := HealthBreakdown{
		CPU:     scoreCPU(cpuPercent),
		Memory:  scoreMemory(memoryPercent),
		DiskIO:  scoreDiskIO(diskIOBytesPerSec),
		Network: scoreNetwork(networkBytesPerSec),
		Restart: scoreRestart(restartCount),
		Uptime:  scoreUptime(uptimeSeconds),
	}

	total := breakdown.CPU + breakdown.Memory + breakdown.DiskIO +
		breakdown.Network + breakdown.Restart + breakdown.Uptime

	// Clamp score to valid range
	score := clampInt(total, MinHealthScore, MaxHealthScore)

	return HealthResult{
		Score:     score,
		Status:    GetHealthStatus(score),
		Breakdown: breakdown,
	}
}

// GetHealthStatus converts a numeric score to a HealthStatus level.
func GetHealthStatus(score int) HealthStatus {
	if score >= HealthyThreshold {
		return HealthStatusHealthy
	}
	if score >= WarningThreshold {
		return HealthStatusWarning
	}
	return HealthStatusDangerous
}

// scoreCPU calculates CPU dimension score (0-WeightCPU).
func scoreCPU(cpuPercent float64) int {
	return scoreUsageDimension(cpuPercent, CPUNormalMax, CPUWarningMax, WeightCPU)
}

// scoreMemory calculates memory dimension score (0-WeightMemory).
func scoreMemory(memoryPercent float64) int {
	return scoreUsageDimension(memoryPercent, MemoryNormalMax, MemoryWarningMax, WeightMemory)
}

// scoreUsageDimension computes a usage-based score with a 3-tier model:
//   - 0 to normalMax: full score
//   - normalMax to warningMax: linear decline to ~50% of weight
//   - warningMax+: linear decline to 0
func scoreUsageDimension(percent, normalMax, warningMax float64, weight int) int {
	if percent <= normalMax {
		return weight
	}
	if percent <= warningMax {
		// Linear decline from full weight to half weight
		ratio := (percent - normalMax) / (warningMax - normalMax)
		score := float64(weight) * (1.0 - ratio*0.5)
		return int(math.Round(score))
	}
	// Above warning: linear decline from half weight to 0 over "double warning" range
	excessRange := warningMax - normalMax
	if excessRange <= 0 {
		excessRange = 20 // fallback
	}
	excess := percent - warningMax
	if excess >= excessRange*2 {
		return 0
	}
	ratio := excess / (excessRange * 2)
	score := float64(weight) * 0.5 * (1.0 - ratio)
	return int(math.Round(math.Max(0, score)))
}

// scoreDiskIO calculates disk IO dimension score (0-WeightDiskIO).
// Penalizes abnormally high disk IO rates.
func scoreDiskIO(bytesPerSec float64) int {
	if bytesPerSec <= DiskIONormalMax {
		return WeightDiskIO
	}
	if bytesPerSec <= DiskIOWarningMax {
		ratio := (bytesPerSec - DiskIONormalMax) / (DiskIOWarningMax - DiskIONormalMax)
		score := float64(WeightDiskIO) * (1.0 - ratio*0.6)
		return int(math.Round(score))
	}
	// Severe: rapid decline to 0
	excess := bytesPerSec - DiskIOWarningMax
	excessRange := float64(DiskIOWarningMax - DiskIONormalMax)
	if excessRange <= 0 {
		excessRange = float64(DiskIONormalMax)
	}
	if excess >= excessRange {
		return 0
	}
	ratio := excess / excessRange
	score := float64(WeightDiskIO) * 0.4 * (1.0 - ratio)
	return int(math.Round(math.Max(0, score)))
}

// scoreNetwork calculates network dimension score (0-WeightNetwork).
// Penalizes both abnormally low and abnormally high network traffic.
func scoreNetwork(bytesPerSec float64) int {
	// Too low traffic (container may be isolated or stalled)
	if bytesPerSec < NetworkLowThreshold {
		// Give ~70% of weight - not fatal, but worth noting
		return int(math.Round(float64(WeightNetwork) * 0.7))
	}
	// Normal range
	if bytesPerSec <= NetworkNormalMax {
		return WeightNetwork
	}
	// Warning range
	if bytesPerSec <= NetworkWarningMax {
		ratio := (bytesPerSec - NetworkNormalMax) / (NetworkWarningMax - NetworkNormalMax)
		score := float64(WeightNetwork) * (1.0 - ratio*0.6)
		return int(math.Round(score))
	}
	// Severe: rapid decline to 0
	excess := bytesPerSec - NetworkWarningMax
	excessRange := float64(NetworkWarningMax - NetworkNormalMax)
	if excess >= excessRange {
		return 0
	}
	ratio := excess / excessRange
	score := float64(WeightNetwork) * 0.4 * (1.0 - ratio)
	return int(math.Round(math.Max(0, score)))
}

// scoreRestart calculates restart count dimension score (0-WeightRestart).
// 0 restarts = full score; each restart deducts a fixed penalty.
func scoreRestart(restartCount int) int {
	if restartCount <= 0 {
		return WeightRestart
	}
	penalty := restartCount * RestartPenaltyPerCount
	score := WeightRestart - penalty
	return clampInt(score, 0, WeightRestart)
}

// scoreUptime calculates uptime dimension score (0-WeightUptime).
// Very short uptimes suggest instability; longer uptimes indicate stability.
func scoreUptime(uptimeSeconds float64) int {
	if uptimeSeconds >= UptimeStable {
		return WeightUptime
	}
	if uptimeSeconds >= UptimeModerate {
		// 10 min - 1 hour: linear from ~67% to 100%
		ratio := (uptimeSeconds - UptimeModerate) / (UptimeStable - UptimeModerate)
		minScore := float64(WeightUptime) * 0.67
		score := minScore + float64(WeightUptime)*0.33*ratio
		return int(math.Round(score))
	}
	if uptimeSeconds >= UptimeMinimal {
		// 1 min - 10 min: linear from ~33% to ~67%
		ratio := (uptimeSeconds - UptimeMinimal) / (UptimeModerate - UptimeMinimal)
		minScore := float64(WeightUptime) * 0.33
		score := minScore + float64(WeightUptime)*0.34*ratio
		return int(math.Round(score))
	}
	// < 1 minute: very low score
	if uptimeSeconds <= 0 {
		return 0
	}
	ratio := uptimeSeconds / UptimeMinimal
	score := float64(WeightUptime) * 0.33 * ratio
	return int(math.Round(score))
}

// clampInt clamps an integer value between min and max (inclusive).
func clampInt(val, min, max int) int {
	if val < min {
		return min
	}
	if val > max {
		return max
	}
	return val
}

// CalculateAverageRate computes bytes-per-second from cumulative bytes and uptime.
// Returns 0 if uptime is non-positive.
func CalculateAverageRate(cumulativeBytes uint64, uptime time.Duration) float64 {
	if uptime.Seconds() <= 0 {
		return 0
	}
	return float64(cumulativeBytes) / uptime.Seconds()
}
