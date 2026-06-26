// Command ipod is the iPod Shuffle device engine. It runs as a stateless HTTP
// service (ipod serve) or as one-shot commands. It is the backing service the
// Moleculer product layer orchestrates.
package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/davidroman0O/ipod-shuffle/engine/internal/config"
)

func main() {
	root := &cobra.Command{
		Use:   "ipod",
		Short: "iPod Shuffle device engine",
		Long: "A stateless iPod Shuffle device engine: discovers volumes, syncs " +
			"audio, and writes the iTunesSD/iTunesStats databases. Run as a service " +
			"(ipod serve) or via one-shot subcommands.",
	}
	root.AddCommand(serveCmd())
	root.AddCommand(devicesCmd())
	root.AddCommand(syncCmd())

	if err := root.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

// loadConfig is shared by subcommands.
func loadConfig() config.Config {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, "config error:", err)
		os.Exit(1)
	}
	return cfg
}
