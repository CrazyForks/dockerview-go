package version

import (
	"testing"
)

func TestCompareSemver(t *testing.T) {
	tests := []struct {
		a, b string
		want int
	}{
		{"0.1.11", "0.1.12", -1},
		{"0.1.12", "0.1.11", 1},
		{"0.1.12", "0.1.12", 0},
		{"v0.1.11", "v0.1.12", -1},
		{"v0.2.0", "0.1.12", 1},
		{"1.0.0", "0.9.9", 1},
		{"0.1.0", "0.1.0", 0},
		{"0.0.1", "0.0.2", -1},
		{"10.0.0", "9.9.9", 1},
	}

	for _, tt := range tests {
		got := CompareSemver(tt.a, tt.b)
		if got != tt.want {
			t.Errorf("CompareSemver(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.want)
		}
	}
}

func TestDetectInstallMethod(t *testing.T) {
	method := DetectInstallMethod()
	// Just ensure it doesn't panic and returns a valid value
	if method != InstallMethodGoInstall && method != InstallMethodBinary {
		t.Errorf("DetectInstallMethod() returned invalid method: %s", method)
	}
}
