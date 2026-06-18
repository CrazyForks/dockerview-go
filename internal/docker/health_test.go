package docker

import (
	"testing"
	"time"
)

func TestCalculateHealthScore_RunningHealthy(t *testing.T) {
	result := CalculateHealthScore(
		20.0, // CPU 20% - normal
		30.0, // Memory 30% - normal
		10e6, // Disk IO 10 MB/s - normal
		50e6, // Network 50 MB/s - normal
		0,    // 0 restarts
		7200, // 2 hours uptime
		true, // running
	)

	if result.Score < 80 {
		t.Errorf("expected healthy score (>=80), got %d", result.Score)
	}
	if result.Status != HealthStatusHealthy {
		t.Errorf("expected healthy status, got %s", result.Status)
	}
	if result.Score < 0 || result.Score > 100 {
		t.Errorf("score out of range [0,100]: %d", result.Score)
	}
}

func TestCalculateHealthScore_StoppedContainer(t *testing.T) {
	result := CalculateHealthScore(0, 0, 0, 0, 0, 0, false)

	if result.Score != 0 {
		t.Errorf("expected score 0 for stopped container, got %d", result.Score)
	}
	if result.Status != HealthStatusDangerous {
		t.Errorf("expected dangerous status for stopped container, got %s", result.Status)
	}
}

func TestCalculateHealthScore_HighCPUMemory(t *testing.T) {
	result := CalculateHealthScore(
		90.0, // CPU 90% - very high
		85.0, // Memory 85% - very high
		10e6, // Disk IO normal
		50e6, // Network normal
		0,    // 0 restarts
		7200, // 2 hours uptime
		true, // running
	)

	// High CPU + high memory should reduce score to warning range
	if result.Score >= HealthyThreshold {
		t.Errorf("expected warning/dangerous score (<%d) with high CPU+memory, got %d",
			HealthyThreshold, result.Score)
	}
	if result.Status == HealthStatusHealthy {
		t.Errorf("expected non-healthy status with high CPU+memory, got %s", result.Status)
	}
	if result.Score < 0 || result.Score > 100 {
		t.Errorf("score out of range [0,100]: %d", result.Score)
	}
}

func TestCalculateHealthScore_ManyRestarts(t *testing.T) {
	result := CalculateHealthScore(
		30.0, // CPU normal
		40.0, // Memory normal
		5e6,  // Disk IO normal
		10e6, // Network normal
		5,    // 5 restarts
		7200, // 2 hours uptime
		true, // running
	)

	// 5 restarts * 5 penalty = 25 points lost from restart dimension
	if result.Breakdown.Restart > 0 {
		t.Errorf("expected restart score of 0 with 5 restarts, got %d", result.Breakdown.Restart)
	}
	if result.Score < 0 || result.Score > 100 {
		t.Errorf("score out of range [0,100]: %d", result.Score)
	}
}

func TestCalculateHealthScore_ShortUptime(t *testing.T) {
	result := CalculateHealthScore(
		20.0, // CPU normal
		30.0, // Memory normal
		1e6,  // Disk IO normal
		5e6,  // Network normal
		0,    // 0 restarts
		30,   // 30 seconds uptime - very short
		true, // running
	)

	// Short uptime should reduce uptime score significantly
	if result.Breakdown.Uptime >= WeightUptime {
		t.Errorf("expected low uptime score with 30s uptime, got %d (weight: %d)",
			result.Breakdown.Uptime, WeightUptime)
	}
	if result.Score < 0 || result.Score > 100 {
		t.Errorf("score out of range [0,100]: %d", result.Score)
	}
}

func TestCalculateHealthScore_HighDiskIO(t *testing.T) {
	result := CalculateHealthScore(
		30.0,  // CPU normal
		40.0,  // Memory normal
		300e6, // Disk IO 300 MB/s - very high
		10e6,  // Network normal
		0,     // 0 restarts
		3600,  // 1 hour uptime
		true,  // running
	)

	if result.Breakdown.DiskIO >= WeightDiskIO {
		t.Errorf("expected reduced disk IO score with 300MB/s, got %d (weight: %d)",
			result.Breakdown.DiskIO, WeightDiskIO)
	}
}

func TestCalculateHealthScore_LowNetwork(t *testing.T) {
	result := CalculateHealthScore(
		30.0, // CPU normal
		40.0, // Memory normal
		1e6,  // Disk IO normal
		500,  // Network 500 B/s - very low
		0,    // 0 restarts
		3600, // 1 hour uptime
		true, // running
	)

	// Very low network should get ~70% of network weight
	weightNet := float64(WeightNetwork)
	expectedMin := int(weightNet * 0.65)
	expectedMax := int(weightNet * 0.75)
	if result.Breakdown.Network < expectedMin || result.Breakdown.Network > expectedMax {
		t.Errorf("expected network score around 70%% of weight (%d-%d), got %d",
			expectedMin, expectedMax, result.Breakdown.Network)
	}
}

func TestGetHealthStatus(t *testing.T) {
	tests := []struct {
		score    int
		expected HealthStatus
	}{
		{100, HealthStatusHealthy},
		{90, HealthStatusHealthy},
		{80, HealthStatusHealthy},
		{79, HealthStatusWarning},
		{60, HealthStatusWarning},
		{50, HealthStatusWarning},
		{49, HealthStatusDangerous},
		{20, HealthStatusDangerous},
		{0, HealthStatusDangerous},
	}

	for _, tt := range tests {
		status := GetHealthStatus(tt.score)
		if status != tt.expected {
			t.Errorf("GetHealthStatus(%d) = %s, want %s", tt.score, status, tt.expected)
		}
	}
}

func TestScoreCPU(t *testing.T) {
	tests := []struct {
		cpu      float64
		minScore int
		maxScore int
		desc     string
	}{
		{10, WeightCPU, WeightCPU, "low CPU should be full score"},
		{50, WeightCPU, WeightCPU, "50% CPU should be full score"},
		{65, WeightCPU / 2, WeightCPU, "65% CPU should be medium"},
		{80, WeightCPU / 3, WeightCPU / 2, "80% CPU should be lower"},
		{95, 0, WeightCPU / 2, "95% CPU should be very low"},
	}

	for _, tt := range tests {
		score := scoreCPU(tt.cpu)
		if score < tt.minScore || score > tt.maxScore {
			t.Errorf("scoreCPU(%.0f%%) = %d, expected range [%d,%d] (%s)",
				tt.cpu, score, tt.minScore, tt.maxScore, tt.desc)
		}
	}
}

func TestScoreRestart(t *testing.T) {
	tests := []struct {
		restarts int
		expected int
	}{
		{0, WeightRestart},
		{1, WeightRestart - RestartPenaltyPerCount},
		{2, WeightRestart - 2*RestartPenaltyPerCount},
		{3, WeightRestart - 3*RestartPenaltyPerCount},
		{10, 0}, // clamped to 0
	}

	for _, tt := range tests {
		score := scoreRestart(tt.restarts)
		if score != tt.expected {
			t.Errorf("scoreRestart(%d) = %d, want %d", tt.restarts, score, tt.expected)
		}
	}
}

func TestScoreUptime(t *testing.T) {
	// Very short uptime -> low score
	shortScore := scoreUptime(30) // 30 seconds
	if shortScore >= WeightUptime/3 {
		t.Errorf("30s uptime score should be < 1/3 weight, got %d", shortScore)
	}

	// Moderate uptime -> medium score
	modScore := scoreUptime(300) // 5 minutes
	if modScore <= shortScore || modScore >= WeightUptime {
		t.Errorf("5min uptime score should be between short and full, got %d (short: %d)", modScore, shortScore)
	}

	// Long uptime -> full score
	longScore := scoreUptime(7200) // 2 hours
	if longScore != WeightUptime {
		t.Errorf("2h uptime score should be full (%d), got %d", WeightUptime, longScore)
	}

	// Zero uptime -> zero score
	zeroScore := scoreUptime(0)
	if zeroScore != 0 {
		t.Errorf("0s uptime score should be 0, got %d", zeroScore)
	}
}

func TestHealthBreakdown_SumMatchesScore(t *testing.T) {
	// The total score should approximately equal the sum of breakdown scores
	// (minor rounding differences allowed)
	result := CalculateHealthScore(
		25.0, // CPU
		35.0, // Memory
		5e6,  // Disk IO
		10e6, // Network
		1,    // 1 restart
		1800, // 30 minutes
		true, // running
	)

	breakdownSum := result.Breakdown.CPU + result.Breakdown.Memory +
		result.Breakdown.DiskIO + result.Breakdown.Network +
		result.Breakdown.Restart + result.Breakdown.Uptime

	// Score is clamped, so sum might differ if out of range
	expectedScore := breakdownSum
	if expectedScore > 100 {
		expectedScore = 100
	}
	if expectedScore < 0 {
		expectedScore = 0
	}

	if result.Score != expectedScore {
		t.Errorf("score %d != breakdown sum %d (clamped to %d)",
			result.Score, breakdownSum, expectedScore)
	}
}

func TestClampInt(t *testing.T) {
	tests := []struct {
		val, min, max, expected int
	}{
		{50, 0, 100, 50},
		{-5, 0, 100, 0},
		{150, 0, 100, 100},
		{0, 0, 100, 0},
		{100, 0, 100, 100},
	}

	for _, tt := range tests {
		result := clampInt(tt.val, tt.min, tt.max)
		if result != tt.expected {
			t.Errorf("clampInt(%d, %d, %d) = %d, want %d",
				tt.val, tt.min, tt.max, result, tt.expected)
		}
	}
}

func TestCalculateAverageRate(t *testing.T) {
	rate := CalculateAverageRate(3600, time.Second)
	if rate != 3600 {
		t.Errorf("expected 3600 bytes/sec, got %f", rate)
	}

	rate = CalculateAverageRate(10000, 2*time.Second)
	if rate != 5000 {
		t.Errorf("expected 5000 bytes/sec, got %f", rate)
	}

	rate = CalculateAverageRate(1000, 0)
	if rate != 0 {
		t.Errorf("expected 0 with zero duration, got %f", rate)
	}
}
