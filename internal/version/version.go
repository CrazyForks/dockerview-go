package version

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/minio/selfupdate"
)

const (
	githubRepo    = "zsuroy/dockerview-go"
	githubAPIBase = "https://api.github.com/repos/" + githubRepo + "/releases/latest"
	modulePath    = "github.com/zsuroy/dockerview-go/cmd/dockerview"
)

var (
	defaultGOPATH = os.ExpandEnv("$HOME/go")
)

// InstallMethod describes how the binary was installed.
type InstallMethod string

const (
	InstallMethodGoInstall InstallMethod = "go_install"
	InstallMethodBinary    InstallMethod = "binary"
)

// Info holds version information.
type Info struct {
	CurrentVersion  string        `json:"current_version"`
	LatestVersion   string        `json:"latest_version"`
	UpdateAvailable bool          `json:"update_available"`
	InstallMethod   InstallMethod `json:"install_method"`
	Commit          string        `json:"commit"`
	BuildDate       string        `json:"build_date"`
}

// Release represents a GitHub release.
type Release struct {
	TagName string `json:"tag_name"`
	Name    string `json:"name"`
}

// CompareSemver returns:
//
//	-1 if a < b
//	 0 if a == b
//	 1 if a > b
//
// Versions may have an optional "v" prefix.
func CompareSemver(a, b string) int {
	a = strings.TrimPrefix(a, "v")
	b = strings.TrimPrefix(b, "v")

	aParts := strings.Split(a, ".")
	bParts := strings.Split(b, ".")

	for i := 0; i < 3; i++ {
		var aNum, bNum int
		if i < len(aParts) {
			aNum, _ = strconv.Atoi(aParts[i])
		}
		if i < len(bParts) {
			bNum, _ = strconv.Atoi(bParts[i])
		}
		if aNum < bNum {
			return -1
		}
		if aNum > bNum {
			return 1
		}
	}
	return 0
}

// DetectInstallMethod determines how the binary was installed.
func DetectInstallMethod() InstallMethod {
	exePath, err := os.Executable()
	if err != nil {
		return InstallMethodBinary
	}
	exePath, err = filepath.EvalSymlinks(exePath)
	if err != nil {
		return InstallMethodBinary
	}

	gopath := os.Getenv("GOPATH")
	if gopath == "" {
		gopath = defaultGOPATH
	}
	gopathBin := filepath.Join(gopath, "bin")

	// Check if binary is under $GOPATH/bin
	if strings.HasPrefix(exePath, gopathBin+string(os.PathSeparator)) {
		return InstallMethodGoInstall
	}

	// Also check $HOME/go/bin as fallback
	home, err := os.UserHomeDir()
	if err == nil {
		homeGoBin := filepath.Join(home, "go", "bin")
		if strings.HasPrefix(exePath, homeGoBin+string(os.PathSeparator)) {
			return InstallMethodGoInstall
		}
	}

	return InstallMethodBinary
}

// FetchLatestRelease queries the GitHub API for the latest release version.
func FetchLatestRelease(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, githubAPIBase, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "dockerview-go")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("network error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("GitHub API returned %s", resp.Status)
	}

	var release Release
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return "", fmt.Errorf("failed to parse response: %v", err)
	}

	return strings.TrimPrefix(release.TagName, "v"), nil
}

// GetInfo returns current version info and checks for updates.
func GetInfo(ctx context.Context, currentVersion, commit, buildDate string) Info {
	info := Info{
		CurrentVersion: currentVersion,
		Commit:         commit,
		BuildDate:      buildDate,
		InstallMethod:  DetectInstallMethod(),
	}

	latest, err := FetchLatestRelease(ctx)
	if err != nil {
		info.LatestVersion = currentVersion
		info.UpdateAvailable = false
		return info
	}

	info.LatestVersion = latest
	info.UpdateAvailable = CompareSemver(currentVersion, latest) < 0
	return info
}

// ProgressCallback receives upgrade progress messages.
// status is one of: "downloading", "applying", "success", "error"
type ProgressCallback func(status, message string)

// DoUpgrade performs the upgrade based on install method.
// It calls cb with progress updates.
func DoUpgrade(ctx context.Context, method InstallMethod, cb ProgressCallback) {
	defer func() {
		if r := recover(); r != nil {
			cb("error", fmt.Sprintf("Unexpected error: %v", r))
		}
	}()

	switch method {
	case InstallMethodGoInstall:
		upgradeViaGoInstall(ctx, cb)
	default:
		upgradeViaBinary(ctx, cb)
	}
}

func upgradeViaGoInstall(ctx context.Context, cb ProgressCallback) {
	cb("downloading", "Downloading and installing latest version via go install...")

	goBin, err := exec.LookPath("go")
	if err != nil {
		cb("error", "Go toolchain not found in PATH. Please install Go to use this upgrade method, or download the binary from GitHub Releases.")
		return
	}

	target := modulePath + "@latest"
	cmd := exec.CommandContext(ctx, goBin, "install", target)
	cmd.Env = os.Environ()
	output, err := cmd.CombinedOutput()
	if err != nil {
		cb("error", fmt.Sprintf("go install failed: %v\n%s", err, strings.TrimSpace(string(output))))
		return
	}

	cb("success", "Upgrade successful! Please restart dockerview to use the new version.")
}

func upgradeViaBinary(ctx context.Context, cb ProgressCallback) {
	assetsName := fmt.Sprintf("dockerview-%s-%s", runtime.GOOS, runtime.GOARCH)
	if runtime.GOOS == "windows" {
		assetsName += ".exe"
	}

	url := fmt.Sprintf("https://github.com/%s/releases/latest/download/%s", githubRepo, assetsName)
	cb("downloading", "Downloading latest binary...")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		cb("error", fmt.Sprintf("Failed to create request: %v", err))
		return
	}

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		cb("error", fmt.Sprintf("Download failed: %v (check your network connection)", err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		cb("error", fmt.Sprintf("Server returned error: %s", resp.Status))
		return
	}

	cb("applying", "Applying update (replacing binary)...")

	err = selfupdate.Apply(resp.Body, selfupdate.Options{})
	if err != nil {
		errMsg := fmt.Sprintf("Apply update failed: %v", err)
		if strings.Contains(err.Error(), "permission denied") || strings.Contains(err.Error(), "access is denied") {
			errMsg += " (hint: insufficient permissions to replace binary)"
		}
		cb("error", errMsg)
		return
	}

	cb("success", "Upgrade successful! Please restart dockerview to use the new version.")
}
