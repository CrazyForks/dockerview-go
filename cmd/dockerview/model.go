package main

import (
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/zsuroy/dockerview-go/internal/docker"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type model struct {
	mu         sync.RWMutex
	containers []docker.ContainerInfo
	err        error
}

var (
	styleBorder = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#444444")).
			Padding(1, 2)

	styleHeader = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#FFA500"))

	styleTitle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#00D9FF"))

	styleSubtitle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#666666"))

	styleID        = lipgloss.NewStyle().Foreground(lipgloss.Color("#00D9FF")).Width(14)
	styleName      = lipgloss.NewStyle().Width(20)
	styleMemory    = lipgloss.NewStyle().Foreground(lipgloss.Color("#00D9FF")).Width(10)
	styleBlkio     = lipgloss.NewStyle().Foreground(lipgloss.Color("#00D9FF")).Width(18)
	styleNetwork   = lipgloss.NewStyle().Foreground(lipgloss.Color("#00FF00")).Width(18)
	styleCPUOk     = lipgloss.NewStyle().Foreground(lipgloss.Color("#00FF00")).Width(8)
	styleCPUHot    = lipgloss.NewStyle().Foreground(lipgloss.Color("#FF4444")).Width(8)
	styleStatusOk  = lipgloss.NewStyle().Foreground(lipgloss.Color("#00FF00")).Width(18)
	styleStatusBad = lipgloss.NewStyle().Foreground(lipgloss.Color("#FF4444")).Width(18)

	styleError = lipgloss.NewStyle().Foreground(lipgloss.Color("#FF4444"))
	styleEmpty = lipgloss.NewStyle().Foreground(lipgloss.Color("#888888"))
)

type tickMsg struct {
	time.Time
}

func (m *model) Init() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg {
		return tickMsg{t}
	})
}

func (m *model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tickMsg:
		return m, tea.Tick(time.Second, func(t time.Time) tea.Msg {
			return tickMsg{t}
		})
	case tea.KeyMsg:
		if msg.Type == tea.KeyCtrlC {
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m *model) View() string {
	m.mu.RLock()
	containers := m.containers
	err := m.err
	m.mu.RUnlock()

	title := styleTitle.Render("DockerView Monitor " + Version)
	subtitle := styleSubtitle.Render("Press Ctrl+C to exit")

	header := lipgloss.JoinHorizontal(
		lipgloss.Top,
		styleHeader.Width(14).Render("ID"),
		styleHeader.Width(20).Render("Name"),
		styleHeader.Width(8).Render("CPU"),
		styleHeader.Width(10).Render("Memory"),
		styleHeader.Width(18).Render("Storage"),
		styleHeader.Width(18).Render("Network"),
		styleHeader.Width(18).Render("Status"),
	)

	var rows []string
	for _, c := range containers {
		name := c.Name
		if len(name) > 20 {
			name = name[:18] + ".."
		}

		status := c.Status
		if len(status) > 18 {
			status = status[:16] + ".."
		}

		cpuVal, _ := strconv.ParseFloat(strings.TrimSuffix(c.CPU, "%"), 64)

		cpuStyle := styleCPUOk
		if cpuVal >= 50 {
			cpuStyle = styleCPUHot
		}

		statusStyle := styleStatusOk
		if strings.Contains(strings.ToLower(c.Status), "exit") {
			statusStyle = styleStatusBad
		}

		row := lipgloss.JoinHorizontal(
			lipgloss.Top,
			styleID.Render(c.ID),
			styleName.Render(name),
			cpuStyle.Render(c.CPU),
			styleMemory.Render(c.Memory),
			styleBlkio.Render(c.Blkio),
			styleNetwork.Render(c.Network),
			statusStyle.Render(status),
		)
		rows = append(rows, row)
	}

	if len(rows) == 0 {
		if err != nil {
			rows = append(rows, styleError.Render("Error: "+err.Error()))
		} else {
			rows = append(rows, styleEmpty.Render("No containers running"))
		}
	}

	content := fmt.Sprintf("%s\n%s\n\n%s\n%s\n%s",
		title,
		subtitle,
		header,
		strings.Repeat("─", 102),
		strings.Join(rows, "\n"),
	)

	return styleBorder.Render(content)
}
